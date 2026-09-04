import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import Hub from "@/models/Hub";
import Ride from "@/models/Ride";

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

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";

    if (!isSuperAdmin && !isCampusAdmin) {
      return NextResponse.json(
        { success: false, error: "Access denied. Administrator privileges required." },
        { status: 403 }
      );
    }

    await connectToDatabase();

    const hubFilter: Record<string, any> = {};
    if (isCampusAdmin && session.user.campusId) {
      hubFilter.campusId = new RegExp(`^${session.user.campusId}$`, "i");
    }

    const totalHubs = await Hub.countDocuments(hubFilter);
    const activeHubs = await Hub.countDocuments({ ...hubFilter, status: "active" });
    const inactiveHubs = await Hub.countDocuments({ ...hubFilter, status: "inactive" });

    // Hub IDs matching the admin's scope
    const matchingHubs = await Hub.find(hubFilter).select("_id").lean();
    const matchingHubIds = matchingHubs.map((h) => h._id);

    // Active rides under these hubs
    const activeRides = await Ride.find({
      hubId: { $in: matchingHubIds },
      status: "scheduled",
    })
      .select("driver acceptedPassengers requests")
      .lean();

    const commuterSet = new Set<string>();
    activeRides.forEach((ride: any) => {
      if (ride.driver) commuterSet.add(ride.driver.toString());
      (ride.acceptedPassengers || []).forEach((p: any) => commuterSet.add(p.toString()));
      (ride.requests || []).forEach((r: any) => {
        if (r.passenger) commuterSet.add(r.passenger.toString());
      });
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalHubs,
        activeHubs,
        inactiveHubs,
        activeRidesCount: activeRides.length,
        participatingCommutersCount: commuterSet.size,
      },
    });
  } catch (error: any) {
    console.error("CommuteHub Stats Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load stats." },
      { status: 500 }
    );
  }
}
