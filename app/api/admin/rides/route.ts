import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";
import Vehicle from "@/models/Vehicle";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user || (session.user.role !== "admin" && session.user.role !== "campus_admin")) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const isSuperAdmin = session.user.role === "admin";
    let driverFilter: Record<string, any> = {};

    if (!isSuperAdmin) {
      const campusQuery = session.user.campusId
        ? { campusId: new RegExp(`^${session.user.campusId}$`, "i") }
        : {};
      const campusUsers = await User.find(campusQuery).select("_id");
      const campusUserIds = campusUsers.map((u) => u._id);
      driverFilter = { driver: { $in: campusUserIds } };
    }

    // 1. Fetch rides with populated driver and vehicle
    const rides = await Ride.find(driverFilter)
      .populate("driver", "name email employeeId department companyName campusId phone profileImage")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber seatingCapacity")
      .populate("acceptedPassengers", "name email employeeId department companyName phone profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // 2. Fetch all passenger requests for full tracking audit
    const rideIds = rides.map((r) => r._id);
    const allRequests = await RideRequest.find({ ride: { $in: rideIds } })
      .populate("passenger", "name email employeeId department companyName phone profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // Group requests by ride ID
    const requestsByRideId = new Map<string, any[]>();
    allRequests.forEach((req) => {
      const rId = req.ride.toString();
      if (!requestsByRideId.has(rId)) {
        requestsByRideId.set(rId, []);
      }
      requestsByRideId.get(rId)!.push(req);
    });

    // 3. Attach full requests manifest to each ride
    const enrichedRides = rides.map((ride) => {
      const rideRequests = requestsByRideId.get(ride._id.toString()) || [];
      const acceptedReqs = rideRequests.filter((r) => r.status === "accepted");
      const totalSeatsBooked = acceptedReqs.reduce((acc, curr) => acc + (curr.seatsRequested || 1), 0);
      const totalFareGenerated = acceptedReqs.reduce((acc, curr) => acc + (curr.fare || 0), 0);

      return {
        ...ride,
        requests: rideRequests,
        totalSeatsBooked,
        totalFareGenerated,
      };
    });

    // 4. Calculate campus mobility stats
    const totalRides = enrichedRides.length;
    const scheduledRides = enrichedRides.filter((r) => r.status === "scheduled").length;
    const totalPassengersJoined = allRequests.filter((r) => r.status === "accepted").length;
    const totalRevenueGenerated = allRequests
      .filter((r) => r.status === "accepted")
      .reduce((sum, r) => sum + (r.fare || 0), 0);

    return NextResponse.json({
      success: true,
      stats: {
        totalRides,
        scheduledRides,
        totalPassengersJoined,
        totalRevenueGenerated,
      },
      rides: enrichedRides,
    });
  } catch (error: unknown) {
    console.error("Admin Rides Oversight GET error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load corporate rides oversight data." },
      { status: 500 }
    );
  }
}
