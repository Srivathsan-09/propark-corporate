import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
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

export interface IMonthlyFinancialSummary {
  month: string;
  earned: number;
  spent: number;
  net: number;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    await connectToDatabase();

    let dbUserId = session.user.id;
    if (session.user.email) {
      const userDoc = await User.findOne({ email: session.user.email.toLowerCase().trim() })
        .select("_id")
        .lean();
      if (userDoc) {
        dbUserId = userDoc._id.toString();
      }
    }

    const driverQuery: any[] = [
      { driver: dbUserId },
      { driver: session.user.id },
    ];
    if (dbUserId !== session.user.id) {
      try {
        const { ObjectId } = require("mongoose").Types;
        driverQuery.push({ driver: new ObjectId(dbUserId) });
      } catch {}
    }

    // 1. Fetch rides where user is Driver
    const driverRides = await Ride.find({
      $or: driverQuery,
    })
      .populate("vehicle", "vehicleModel vehicleType registrationNumber vehiclePhoto")
      .populate("requests.passenger", "name email phone companyName department profileImage employeeId")
      .sort({ createdAt: -1 })
      .lean();

    const passengerQuery = [
      { "requests.passenger": dbUserId },
      { "requests.passenger": session.user.id },
    ];

    // 2. Fetch rides where user is Passenger
    const passengerRides = await Ride.find({
      $or: passengerQuery,
    })
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

    // Group by Month (YYYY-MM)
    const monthlyMap: Record<string, { earned: number; spent: number }> = {};
    allTransactions.forEach((tx) => {
      const d = new Date(tx.date);
      const key = !isNaN(d.getTime())
        ? `${d.toLocaleString("default", { month: "short" })} ${d.getFullYear()}`
        : "Recent";

      if (!monthlyMap[key]) {
        monthlyMap[key] = { earned: 0, spent: 0 };
      }
      if (tx.type === "earning") {
        monthlyMap[key].earned += tx.amountPaid;
      } else {
        monthlyMap[key].spent += tx.amountPaid;
      }
    });

    const monthlyTrends: IMonthlyFinancialSummary[] = Object.keys(monthlyMap).map((m) => ({
      month: m,
      earned: Math.round(monthlyMap[m].earned),
      spent: Math.round(monthlyMap[m].spent),
      net: Math.round(monthlyMap[m].earned - monthlyMap[m].spent),
    }));

    // If no monthly data, provide current month empty placeholder
    if (monthlyTrends.length === 0) {
      const nowMonth = new Date().toLocaleString("default", { month: "short" }) + " " + new Date().getFullYear();
      monthlyTrends.push({ month: nowMonth, earned: 0, spent: 0, net: 0 });
    }

    const netBalance = Math.round((totalDriverCollected - totalPassengerSpent) * 100) / 100;

    // Solo cab comparison savings (typical urban solo cab is 2.5x carpool fare or min ₹140)
    const estimatedSoloCost = Math.round(
      passengerSpendingsList.reduce(
        (sum, item) => sum + Math.max(item.fare * 2.4, 120),
        0
      )
    );
    const savingsVsSoloCab = Math.max(0, estimatedSoloCost - totalPassengerSpent);

    return NextResponse.json({
      success: true,
      summary: {
        // Driver
        totalDriverEarningsCommitted: Math.round(totalDriverEarningsCommitted),
        totalDriverCollected: Math.round(totalDriverCollected),
        totalDriverPending: Math.round(totalDriverPending),
        ridesOfferedCount: driverRides.length,
        passengersCarriedCount: totalPassengersCarried,

        // Passenger
        totalPassengerCommitted: Math.round(totalPassengerCommitted),
        totalPassengerSpent: Math.round(totalPassengerSpent),
        totalPassengerDue: Math.round(totalPassengerDue),
        carpoolsTakenCount: totalCarpoolsTaken,

        // Net & Savings
        netBalance,
        estimatedSoloCost,
        savingsVsSoloCab,
      },
      monthlyTrends,
      driverEarnings: driverEarningsList,
      passengerSpendings: passengerSpendingsList,
      allTransactions,
    });
  } catch (error: any) {
    console.error("Finances API Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to retrieve financial overview." },
      { status: 500 }
    );
  }
}
