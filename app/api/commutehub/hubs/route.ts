import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Hub from "@/models/Hub";
import Ride from "@/models/Ride";
import Campus from "@/models/Campus";
import { routingService } from "@/lib/services/routing";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const { searchParams } = new URL(req.url);
    const filterStatus = searchParams.get("status"); // "active" | "inactive" | "all"
    const filterCampus = searchParams.get("campusId");
    const search = searchParams.get("search");

    const query: Record<string, any> = {};

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";
    const isEmployee = !isSuperAdmin && !isCampusAdmin;

    // Role-based campus restrictions
    if (isEmployee) {
      // Employees only see active hubs for their campus
      query.status = "active";
      if (session.user.campusId) {
        query.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      }
    } else if (isCampusAdmin) {
      // Campus Admins only manage hubs for their campus
      if (session.user.campusId) {
        query.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      }
      if (filterStatus && filterStatus !== "all") {
        query.status = filterStatus;
      }
    } else if (isSuperAdmin) {
      // Super Admin can filter by campus if provided
      if (filterCampus && filterCampus !== "all") {
        query.campusId = new RegExp(`^${filterCampus}$`, "i");
      }
      if (filterStatus && filterStatus !== "all") {
        query.status = filterStatus;
      }
    }

    // Search query filter
    if (search && search.trim()) {
      const s = search.trim();
      query.$or = [
        { name: { $regex: s, $options: "i" } },
        { corridor: { $regex: s, $options: "i" } },
        { "origin.name": { $regex: s, $options: "i" } },
        { "destination.name": { $regex: s, $options: "i" } },
        { campusName: { $regex: s, $options: "i" } },
      ];
    }

    const hubs = await Hub.find(query).sort({ createdAt: -1 }).lean();

    // Aggregate active rides and commuter metrics per hub
    const hubIds = hubs.map((h) => h._id);
    const activeRides = await Ride.find({
      hubId: { $in: hubIds },
      status: "scheduled",
    })
      .select("hubId driver acceptedPassengers requests")
      .lean();

    const ridesCountMap: Record<string, number> = {};
    const commutersMap: Record<string, Set<string>> = {};

    activeRides.forEach((ride: any) => {
      const hId = ride.hubId?.toString();
      if (!hId) return;

      ridesCountMap[hId] = (ridesCountMap[hId] || 0) + 1;

      if (!commutersMap[hId]) {
        commutersMap[hId] = new Set();
      }
      if (ride.driver) commutersMap[hId].add(ride.driver.toString());
      (ride.acceptedPassengers || []).forEach((p: any) => {
        commutersMap[hId].add(p.toString());
      });
    });

    const enrichedHubs = hubs.map((hub) => {
      const hId = hub._id.toString();
      return {
        ...hub,
        activeRidesCount: ridesCountMap[hId] || 0,
        commutersCount: commutersMap[hId]?.size || 0,
      };
    });

    return NextResponse.json({
      success: true,
      hubs: enrichedHubs,
    });
  } catch (error: any) {
    console.error("CommuteHub GET Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load hubs." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const {
      name,
      corridor,
      origin,
      commonPoint,
      destination,
      status = "active",
    } = body;

    // Determine target campus
    let targetCampusId = body.campusId;
    if (isCampusAdmin) {
      // Force Campus Admin's own campus
      targetCampusId = session.user.campusId;
    }

    // Validation
    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Hub name is required (e.g. 'Hub 1')." },
        { status: 400 }
      );
    }

    if (!origin || !origin.name || typeof origin.latitude !== "number" || typeof origin.longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid origin with coordinates is required." },
        { status: 400 }
      );
    }

    if (!destination || !destination.name || typeof destination.latitude !== "number" || typeof destination.longitude !== "number") {
      return NextResponse.json(
        { success: false, error: "Valid destination with coordinates is required." },
        { status: 400 }
      );
    }

    if (
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001
    ) {
      return NextResponse.json(
        { success: false, error: "Origin and Destination cannot be the exact same location." },
        { status: 400 }
      );
    }

    if (!targetCampusId) {
      return NextResponse.json(
        { success: false, error: "Campus ID is required." },
        { status: 400 }
      );
    }

    // Resolve campus name
    const campusDoc = await Campus.findOne({
      campusId: new RegExp(`^${targetCampusId.trim()}$`, "i"),
    }).lean();

    const campusName = campusDoc?.name || targetCampusId;

    // Calculate route geometry and travel statistics (via commonPoint if assigned)
    let routeCoordinates: [number, number][] = [];
    let distanceKm = 0;
    let durationMinutes = 0;

    const hasCommonPoint =
      Boolean(
        commonPoint &&
        commonPoint.name &&
        typeof commonPoint.latitude === "number" &&
        Math.abs(commonPoint.latitude) > 0.01 &&
        typeof commonPoint.longitude === "number" &&
        Math.abs(commonPoint.longitude) > 0.01
      );

    const waypoints = [
      { latitude: origin.latitude, longitude: origin.longitude },
      ...(hasCommonPoint ? [{ latitude: commonPoint.latitude, longitude: commonPoint.longitude }] : []),
      { latitude: destination.latitude, longitude: destination.longitude },
    ];

    try {
      const routeResult = await routingService.calculateRoute(waypoints);

      if (routeResult) {
        routeCoordinates = routeResult.coordinates || [];
        distanceKm = routeResult.distanceKm || 0;
        durationMinutes = routeResult.durationMinutes || 0;
      }
    } catch (routeErr) {
      console.warn("Hub route calculation warning:", routeErr);
      // Fallback straight segments if routing service unavailable
      routeCoordinates = waypoints.map((w) => [w.latitude, w.longitude] as [number, number]);
    }

    // Auto-generate hub ID
    const count = await Hub.countDocuments();
    const formattedHubId = `HUB-${String(count + 1).padStart(3, "0")}`;
    const corridorLabel =
      corridor?.trim() ||
      (hasCommonPoint
        ? `${origin.name} → ${commonPoint.name} → ${destination.name}`
        : `${origin.name} → ${destination.name}`);

    const newHub = await Hub.create({
      hubId: formattedHubId,
      name: name.trim(),
      corridor: corridorLabel,
      origin: {
        name: origin.name.trim(),
        address: origin.address || origin.name,
        latitude: origin.latitude,
        longitude: origin.longitude,
      },
      commonPoint: hasCommonPoint
        ? {
            name: commonPoint.name.trim(),
            address: commonPoint.address || commonPoint.name,
            latitude: commonPoint.latitude,
            longitude: commonPoint.longitude,
          }
        : null,
      destination: {
        name: destination.name.trim(),
        address: destination.address || destination.name,
        latitude: destination.latitude,
        longitude: destination.longitude,
      },
      campusId: targetCampusId.toUpperCase().trim(),
      campusName,
      routeCoordinates,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationMinutes: Math.round(durationMinutes),
      status: status === "inactive" ? "inactive" : "active",
      createdBy: session.user.id,
      createdByName: session.user.name || "Admin",
      createdByRole: isSuperAdmin ? "admin" : "campus_admin",
    });

    return NextResponse.json({
      success: true,
      message: `Hub "${newHub.name}" created successfully.`,
      hub: newHub,
    });
  } catch (error: any) {
    console.error("CommuteHub POST Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create hub." },
      { status: 500 }
    );
  }
}
