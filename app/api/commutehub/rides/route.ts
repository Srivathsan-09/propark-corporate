import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import mongoose from "mongoose";
import Hub from "@/models/Hub";
import Ride from "@/models/Ride";
import Vehicle from "@/models/Vehicle";

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
    const hubIdParam = searchParams.get("hubId");
    const dateParam = searchParams.get("date");
    const timeParam = searchParams.get("time");

    const isSuperAdmin = session.user.role === "admin";
    const isCampusAdmin = session.user.role === "campus_admin";
    const isAdmin = isSuperAdmin || isCampusAdmin;

    let targetHub: any = null;
    const rideQuery: Record<string, any> = {};

    if (hubIdParam && hubIdParam.trim()) {
      const hubQuery: Record<string, any> = mongoose.Types.ObjectId.isValid(hubIdParam)
        ? { $or: [{ _id: new mongoose.Types.ObjectId(hubIdParam) }, { hubId: hubIdParam.toUpperCase() }] }
        : { hubId: hubIdParam.toUpperCase() };

      targetHub = await Hub.findOne(hubQuery).lean();
      if (!targetHub) {
        return NextResponse.json(
          { success: false, error: "Hub not found." },
          { status: 404 }
        );
      }
      rideQuery.hubId = targetHub._id;
    } else {
      // No hubId specified
      if (isAdmin) {
        if (isCampusAdmin && session.user.campusId) {
          const campusHubs = await Hub.find({ campusId: session.user.campusId.toLowerCase() }).select("_id").lean();
          const hubIds = campusHubs.map((h: any) => h._id);
          rideQuery.hubId = { $in: hubIds };
        } else {
          rideQuery.hubId = { $ne: null };
        }
      } else {
        // Employee without hub specified - find active hubs in their campus
        const campusFilter: Record<string, any> = { status: "active" };
        if (session.user.campusId) {
          campusFilter.campusId = session.user.campusId.toLowerCase();
        }
        const campusHubs = await Hub.find(campusFilter).select("_id").lean();
        const hubIds = campusHubs.map((h: any) => h._id);
        rideQuery.hubId = { $in: hubIds };
      }
    }

    if (!isAdmin) {
      rideQuery.status = "scheduled";
      rideQuery.availableSeats = { $gt: 0 };
    }

    if (dateParam && dateParam.trim()) {
      rideQuery.departureDate = dateParam.trim();
    }

    const rides = await Ride.find(rideQuery)
      .populate("hubId", "hubId name corridor status origin destination campusName campusId")
      .populate("driver", "name email phone profileImage department companyName employeeId")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto seatingCapacity")
      .populate("requests.passenger", "name email profileImage employeeId department")
      .sort({ departureDate: 1, departureTime: 1 })
      .lean();

    // Attach request status for current user if logged in
    const currentUserId = session.user.id;
    const ridesWithUserStatus = rides.map((ride: any) => {
      const myRequest = (ride.requests || []).find(
        (r: any) => (r.passenger?._id || r.passenger)?.toString() === currentUserId
      );

      return {
        ...ride,
        hub: targetHub || ride.hubId,
        userRequestStatus: myRequest ? myRequest.status : null,
        myRequestId: myRequest ? myRequest._id?.toString() : null,
      };
    });

    return NextResponse.json({
      success: true,
      hub: targetHub,
      rides: ridesWithUserStatus,
    });
  } catch (error: any) {
    console.error("CommuteHub Rides GET Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load rides for hub." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const body = await req.json();
    const {
      hubId,
      vehicleId,
      departureDate,
      departureTime,
      availableSeats,
      basePrice = 0,
      notes = "",
    } = body;

    if (!hubId) {
      return NextResponse.json(
        { success: false, error: "Please select a hub for this ride." },
        { status: 400 }
      );
    }

    // Resolve Hub
    const hubQuery: Record<string, any> = mongoose.Types.ObjectId.isValid(hubId)
      ? { $or: [{ _id: new mongoose.Types.ObjectId(hubId) }, { hubId: hubId.toUpperCase() }] }
      : { hubId: hubId.toUpperCase() };

    const hub = await Hub.findOne(hubQuery);
    if (!hub) {
      return NextResponse.json(
        { success: false, error: "Selected hub not found." },
        { status: 404 }
      );
    }

    if (hub.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Cannot create rides on an inactive hub corridor." },
        { status: 400 }
      );
    }

    if (!departureDate || !departureTime) {
      return NextResponse.json(
        { success: false, error: "Departure date and time are required." },
        { status: 400 }
      );
    }

    const seats = Number(availableSeats);
    if (isNaN(seats) || seats < 1 || seats > 10) {
      return NextResponse.json(
        { success: false, error: "Available seats must be between 1 and 10." },
        { status: 400 }
      );
    }

    // Verify Vehicle
    let targetVehicle = null;
    if (vehicleId) {
      targetVehicle = await Vehicle.findOne({
        _id: vehicleId,
        owner: session.user.id,
      });
    } else {
      // Fall back to user's first approved active vehicle
      targetVehicle = await Vehicle.findOne({
        owner: session.user.id,
        status: "active",
      });
    }

    if (!targetVehicle) {
      return NextResponse.json(
        {
          success: false,
          error: "You need a registered vehicle to offer a ride. Please add a vehicle in 'My Vehicles'.",
        },
        { status: 400 }
      );
    }

    const newRide = await Ride.create({
      driver: session.user.id,
      vehicle: targetVehicle._id,
      vehicleType: targetVehicle.vehicleType || "Car",
      rideType: "pickup",
      startingLocation: hub.origin.name,
      destination: hub.destination.name,
      startLocation: {
        address: hub.origin.address || hub.origin.name,
        latitude: hub.origin.latitude,
        longitude: hub.origin.longitude,
      },
      endLocation: {
        address: hub.destination.address || hub.destination.name,
        latitude: hub.destination.latitude,
        longitude: hub.destination.longitude,
      },
      departureDate: departureDate.trim(),
      departureTime: departureTime.trim(),
      totalSeats: seats,
      availableSeats: seats,
      basePrice: Number(basePrice) || 0,
      stops: [],
      notes: notes?.trim() || `CommuteHub corridor: ${hub.name} (${hub.corridor})`,
      campusId: hub.campusId,
      hubId: hub._id,
      status: "scheduled",
      acceptedPassengers: [],
      requests: [],
      distanceKm: hub.distanceKm || 0,
      durationMinutes: hub.durationMinutes || 0,
    });

    return NextResponse.json({
      success: true,
      message: `Ride created successfully under ${hub.name}!`,
      ride: newRide,
    });
  } catch (error: any) {
    console.error("CommuteHub Ride Creation POST Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to create ride under hub." },
      { status: 500 }
    );
  }
}
