import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import mongoose from "mongoose";
import Ride from "@/models/Ride";
import User from "@/models/User";
import Vehicle from "@/models/Vehicle";

export const dynamic = "force-dynamic";

export interface IFinancialTransactionItem {
  id: string;
  rideId: string;
  type: "earning" | "spending";
  date: string;
  time: string;
  startingLocation: string;
  destination: string;
  pickupStop: string;
  dropStop: string;
  seats: number;
  fare: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: "paid" | "partially_paid" | "not_paid";
  rideStatus: string;
  isBoarded: boolean;
  counterpart: {
    id?: string;
    name: string;
    email?: string;
    companyName?: string;
    department?: string;
    profileImage?: string;
    employeeId?: string;
  };
  vehicle?: any;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (!session.user?.id && !session.user?.email)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    // Ensure models are registered in Mongoose schema cache for populate
    const _models = [User, Vehicle, Ride];
    void _models;

    let dbUserId = session.user.id;
    if (session.user.email) {
      const userDoc = await User.findOne({ email: session.user.email.toLowerCase().trim() })
        .select("_id")
        .lean();
      if (userDoc) {
        dbUserId = userDoc._id.toString();
      }
    }

    const driverQuery: any[] = [];
    if (dbUserId) {
      driverQuery.push({ driver: dbUserId });
      if (mongoose.Types.ObjectId.isValid(dbUserId)) {
        driverQuery.push({ driver: new mongoose.Types.ObjectId(dbUserId) });
      }
    }
    if (session.user?.id && session.user.id !== dbUserId) {
      driverQuery.push({ driver: session.user.id });
      if (mongoose.Types.ObjectId.isValid(session.user.id)) {
        driverQuery.push({ driver: new mongoose.Types.ObjectId(session.user.id) });
      }
    }

    // 1. Fetch rides where user is Driver
    const driverRides = await Ride.find(
      driverQuery.length > 0 ? { $or: driverQuery } : { driver: dbUserId }
    )
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto")
      .populate("requests.passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const passengerQuery: any[] = [];
    if (dbUserId) {
      passengerQuery.push({ "requests.passenger": dbUserId });
      if (mongoose.Types.ObjectId.isValid(dbUserId)) {
        passengerQuery.push({ "requests.passenger": new mongoose.Types.ObjectId(dbUserId) });
      }
    }
    if (session.user?.id && session.user.id !== dbUserId) {
      passengerQuery.push({ "requests.passenger": session.user.id });
      if (mongoose.Types.ObjectId.isValid(session.user.id)) {
        passengerQuery.push({ "requests.passenger": new mongoose.Types.ObjectId(session.user.id) });
      }
    }

    // 2. Fetch rides where user is Passenger
    const passengerRides = await Ride.find(
      passengerQuery.length > 0 ? { $or: passengerQuery } : { "requests.passenger": dbUserId }
    )
      .populate("driver", "name email phone companyName department profileImage employeeId")
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto")
      .populate("requests.passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    // -------------------------------------------------------------
    // Aggregate Driver Earnings
    // -------------------------------------------------------------
    let totalDriverEarningsCommitted = 0;
    let totalDriverCollected = 0;
    let totalDriverPending = 0;
    let totalPassengersCarried = 0;
    const driverEarningsList: IFinancialTransactionItem[] = [];

    driverRides.forEach((ride: any) => {
      const acceptedRequests = (ride.requests || []).filter(
        (r: any) => r.status === "accepted"
      );

      acceptedRequests.forEach((req: any) => {
        const fare = Number(req.fare) || 0;
        const amountPaid =
          req.paymentStatus === "paid" ? fare : Number(req.amountPaid) || 0;
        const remaining = Math.max(0, fare - amountPaid);

        totalDriverEarningsCommitted += fare;
        totalDriverCollected += amountPaid;
        totalDriverPending += remaining;
        totalPassengersCarried++;

        driverEarningsList.push({
          id: req._id?.toString() || Math.random().toString(),
          rideId: ride._id?.toString(),
          type: "earning",
          date: ride.departureDate || (ride.createdAt ? new Date(ride.createdAt).toISOString().split("T")[0] : "2026-01-01"),
          time: ride.departureTime || "09:00 AM",
          startingLocation: ride.startingLocation,
          destination: ride.destination,
          pickupStop: req.pickupStop,
          dropStop: req.dropStop,
          seats: req.seatsRequested || 1,
          fare,
          amountPaid,
          remainingAmount: remaining,
          paymentStatus: (req.paymentStatus as any) || "not_paid",
          rideStatus: ride.status,
          isBoarded: Boolean(req.isBoarded),
          counterpart: {
            id: req.passenger?._id?.toString(),
            name: req.passenger?.name || "Coworker",
            email: req.passenger?.email,
            companyName: req.passenger?.companyName,
            department: req.passenger?.department,
            profileImage: req.passenger?.profileImage,
            employeeId: req.passenger?.employeeId,
          },
          vehicle: ride.vehicle,
        });
      });
    });

    // -------------------------------------------------------------
    // Aggregate Passenger Spendings
    // -------------------------------------------------------------
    let totalPassengerCommitted = 0;
    let totalPassengerSpent = 0;
    let totalPassengerDue = 0;
    let totalCarpoolsTaken = 0;
    const passengerSpendingsList: IFinancialTransactionItem[] = [];

    passengerRides.forEach((ride: any) => {
      const myRequests = (ride.requests || []).filter((r: any) => {
        const pId = (r.passenger?._id || r.passenger)?.toString();
        return (pId === dbUserId || pId === session.user.id) && r.status === "accepted";
      });

      myRequests.forEach((req: any) => {
        const fare = Number(req.fare) || 0;
        const amountPaid =
          req.paymentStatus === "paid" ? fare : Number(req.amountPaid) || 0;
        const remaining = Math.max(0, fare - amountPaid);

        totalPassengerCommitted += fare;
        totalPassengerSpent += amountPaid;
        totalPassengerDue += remaining;
        totalCarpoolsTaken++;

        passengerSpendingsList.push({
          id: req._id?.toString() || Math.random().toString(),
          rideId: ride._id?.toString(),
          type: "spending",
          date: ride.departureDate || (ride.createdAt ? new Date(ride.createdAt).toISOString().split("T")[0] : "2026-01-01"),
          time: ride.departureTime || "09:00 AM",
          startingLocation: ride.startingLocation,
          destination: ride.destination,
          pickupStop: req.pickupStop,
          dropStop: req.dropStop,
          seats: req.seatsRequested || 1,
          fare,
          amountPaid,
          remainingAmount: remaining,
          paymentStatus: (req.paymentStatus as any) || "not_paid",
          rideStatus: ride.status,
          isBoarded: Boolean(req.isBoarded),
          counterpart: {
            id: ride.driver?._id?.toString(),
            name: ride.driver?.name || "Driver",
            email: ride.driver?.email,
            companyName: ride.driver?.companyName,
            department: ride.driver?.department,
            profileImage: ride.driver?.profileImage,
            employeeId: ride.driver?.employeeId,
          },
          vehicle: ride.vehicle,
        });
      });
    });

    // -------------------------------------------------------------
    // Combined Chronological Activity & Monthly Trends
    // -------------------------------------------------------------
    const allTransactions: IFinancialTransactionItem[] = [
      ...driverEarningsList,
      ...passengerSpendingsList,
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const netBalance = Math.round((totalDriverCollected - totalPassengerSpent) * 100) / 100;

    return NextResponse.json({
      success: true,
      summary: {
        totalDriverEarningsCommitted: Math.round(totalDriverEarningsCommitted),
        totalDriverCollected: Math.round(totalDriverCollected),
        totalDriverPending: Math.round(totalDriverPending),
        ridesOfferedCount: driverRides.length,
        passengersCarriedCount: totalPassengersCarried,
        totalPassengerCommitted: Math.round(totalPassengerCommitted),
        totalPassengerSpent: Math.round(totalPassengerSpent),
        totalPassengerDue: Math.round(totalPassengerDue),
        carpoolsTakenCount: totalCarpoolsTaken,
        netBalance,
      },
      driverEarnings: driverEarningsList,
      passengerSpendings: passengerSpendingsList,
      allTransactions,
    });
  } catch (error: any) {
    console.error("Finances API Error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to retrieve financial overview." },
      { status: 500 }
    );
  }
}
