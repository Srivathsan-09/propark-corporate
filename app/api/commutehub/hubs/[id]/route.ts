import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import mongoose from "mongoose";
import Hub from "@/models/Hub";
import Ride from "@/models/Ride";
import Campus from "@/models/Campus";
import { routingService } from "@/lib/services/routing";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { id } = params;
    const query: Record<string, any> = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { hubId: id.toUpperCase() }] }
      : { hubId: id.toUpperCase() };

    const hub = await Hub.findOne(query).lean();
    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Hub not found." },
        { status: 404 }
      );
    }

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";
    const isEmployee = !isSuperAdmin && !isCampusAdmin;

    // Campus isolation check
    if (isCampusAdmin || isEmployee) {
      if (
        session.user.campusId &&
        hub.campusId.toLowerCase() !== session.user.campusId.toLowerCase()
      ) {
        return NextResponse.json(
          { success: false, error: "Access denied. Hub belongs to another campus." },
          { status: 403 }
        );
      }
    }

    // Fetch rides associated with this hub
    const hubRides = await Ride.find({
      hubId: hub._id,
      status: { $in: ["scheduled", "in_progress"] },
    })
      .populate("driver", "name email phone profileImage employeeId department companyName")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity")
      .populate("requests.passenger", "name email profileImage employeeId department")
      .sort({ departureDate: 1, departureTime: 1 })
      .lean();

    // Unique employees participating
    const employeeSet = new Set<string>();
    hubRides.forEach((r: any) => {
      if (r.driver?._id) employeeSet.add(r.driver._id.toString());
      (r.requests || []).forEach((req: any) => {
        if (req.passenger?._id) employeeSet.add(req.passenger._id.toString());
      });
    });

    return NextResponse.json({
      success: true,
      hub: {
        ...hub,
        activeRidesCount: hubRides.length,
        employeesUsingHubCount: employeeSet.size,
        rides: hubRides,
      },
    });
  } catch (error: any) {
    console.error("Hub Details GET Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load hub details." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";

    if (!isSuperAdmin && !isCampusAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { id } = params;
    const query: Record<string, any> = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { hubId: id.toUpperCase() }] }
      : { hubId: id.toUpperCase() };

    const hub = await Hub.findOne(query);
    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Hub not found." },
        { status: 404 }
      );
    }

    // Campus isolation check
    if (
      isCampusAdmin &&
      session.user.campusId &&
      hub.campusId.toLowerCase() !== session.user.campusId.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied. You can only modify hubs for your campus." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, corridor, status, origin, commonPoint, destination, campusId } = body;

    if (name && name.trim()) hub.name = name.trim();
    if (corridor && corridor.trim()) hub.corridor = corridor.trim();
    if (status && (status === "active" || status === "inactive")) hub.status = status;
    if (commonPoint !== undefined) hub.commonPoint = commonPoint;

    if (isSuperAdmin && campusId && campusId.trim()) {
      const trimmedCampus = campusId.toUpperCase().trim();
      hub.campusId = trimmedCampus;
      const campusDoc = await Campus.findOne({ campusId: trimmedCampus }).lean();
      if (campusDoc) {
        hub.campusName = (campusDoc as any).name;
      }
    }

    // If locations changed, re-calculate route
    if (origin || destination || commonPoint !== undefined) {
      if (origin) hub.origin = origin;
      if (destination) hub.destination = destination;

      const activeOrigin = hub.origin;
      const activeDest = hub.destination;
      const activeCommonPoint = hub.commonPoint;

      const waypoints = [
        { latitude: activeOrigin.latitude, longitude: activeOrigin.longitude },
        ...(activeCommonPoint &&
        typeof activeCommonPoint.latitude === "number" &&
        Math.abs(activeCommonPoint.latitude) > 0.01 &&
        typeof activeCommonPoint.longitude === "number" &&
        Math.abs(activeCommonPoint.longitude) > 0.01
          ? [{ latitude: activeCommonPoint.latitude, longitude: activeCommonPoint.longitude }]
          : []),
        { latitude: activeDest.latitude, longitude: activeDest.longitude },
      ];

      try {
        const routeResult = await routingService.calculateRoute(waypoints);
        if (routeResult) {
          hub.routeCoordinates = routeResult.coordinates;
          hub.distanceKm = Math.round(routeResult.distanceKm * 10) / 10;
          hub.durationMinutes = Math.round(routeResult.durationMinutes);
        }
      } catch (err) {
        console.warn("Route recalculation failed on hub update:", err);
      }
    }

    await hub.save();

    return NextResponse.json({
      success: true,
      message: `Hub "${hub.name}" updated successfully.`,
      hub,
    });
  } catch (error: any) {
    console.error("Hub Update PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update hub." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";

    if (!isSuperAdmin && !isCampusAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const { id } = params;
    const query: Record<string, any> = mongoose.Types.ObjectId.isValid(id)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(id) }, { hubId: id.toUpperCase() }] }
      : { hubId: id.toUpperCase() };

    const hub = await Hub.findOne(query);
    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Hub not found." },
        { status: 404 }
      );
    }

    // Campus isolation check
    if (
      isCampusAdmin &&
      session.user.campusId &&
      hub.campusId.toLowerCase() !== session.user.campusId.toLowerCase()
    ) {
      return NextResponse.json(
        { success: false, error: "Access denied. You can only delete hubs for your campus." },
        { status: 403 }
      );
    }

    // Prevent deletion if active rides exist
    const activeRideCount = await Ride.countDocuments({
      hubId: hub._id,
      status: { $in: ["scheduled", "in_progress"] },
    });

    if (activeRideCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete hub with ${activeRideCount} active scheduled rides. Deactivate the hub instead.`,
        },
        { status: 400 }
      );
    }

    await Hub.findByIdAndDelete(hub._id);

    return NextResponse.json({
      success: true,
      message: `Hub "${hub.name}" deleted successfully.`,
    });
  } catch (error: any) {
    console.error("Hub DELETE Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to delete hub." },
      { status: 500 }
    );
  }
}
