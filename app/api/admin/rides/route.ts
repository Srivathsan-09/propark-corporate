import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
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
    const testExclusion = {
      campusId: { $nin: ["CAMP-LOADTEST-01", "CAMP-LOADTEST"] },
      notes: { $not: /^TestRunID:/ },
    };

    let driverFilter: Record<string, any> = { ...testExclusion };

    if (!isSuperAdmin) {
      const userFilter: Record<string, any> = {
        email: { $ne: "driver.loadtest@corporate.com" },
      };
      if (session.user.campusId) {
        userFilter.campusId = new RegExp(`^${session.user.campusId}$`, "i");
      } else {
        userFilter.campusId = { $nin: ["CAMP-LOADTEST-01", "CAMP-LOADTEST"] };
      }
      const campusUsers = await User.find(userFilter).select("_id");
      const campusUserIds = campusUsers.map((u) => u._id);
      driverFilter = { driver: { $in: campusUserIds }, ...testExclusion };
    }

    // 1. Fetch rides with populated driver, vehicle, and requests.passenger
    const rawRides = await Ride.find(driverFilter)
      .populate("driver", "name email employeeId department companyName campusId phone profileImage")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber seatingCapacity")
      .populate("acceptedPassengers", "name email employeeId department companyName phone profileImage")
      .populate("requests.passenger", "name email employeeId department companyName phone profileImage")
      .sort({ createdAt: -1 })
      .lean();

    // Exclude any load test rides that might still be executing
    const rides = rawRides.filter(
      (r: any) =>
        r.driver &&
        r.driver.email !== "driver.loadtest@corporate.com" &&
        r.campusId !== "CAMP-LOADTEST-01"
    );

    // 2. Attach full requests manifest to each ride
    let totalPassengersJoined = 0;
    let totalRevenueGenerated = 0;

    const enrichedRides = rides.map((ride: any) => {
      const rideRequests = ride.requests || [];
      const acceptedReqs = rideRequests.filter((r: any) => r.status === "accepted");
      const totalSeatsBooked = acceptedReqs.reduce((acc: number, curr: any) => acc + (curr.seatsRequested || 1), 0);
      const totalFareGenerated = acceptedReqs.reduce((acc: number, curr: any) => acc + (curr.fare || 0), 0);

      totalPassengersJoined += acceptedReqs.length;
      totalRevenueGenerated += totalFareGenerated;

      return {
        ...ride,
        requests: rideRequests,
        totalSeatsBooked,
        totalFareGenerated,
      };
    });

    // 3. Calculate campus mobility stats
    const totalRides = enrichedRides.length;
    const scheduledRides = enrichedRides.filter((r: any) => r.status === "scheduled").length;

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
