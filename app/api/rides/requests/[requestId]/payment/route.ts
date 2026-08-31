import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/db/mongodb";
import RideRequest from "@/models/RideRequest";
import Ride from "@/models/Ride";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Please log in." },
        { status: 401 }
      );
    }

    const { requestId } = params;
    const body = await req.json();
    const { paymentStatus, amountPaid: inputAmountPaid } = body;

    if (!paymentStatus || !["paid", "partially_paid", "not_paid"].includes(paymentStatus)) {
      return NextResponse.json(
        { success: false, error: "Invalid payment status. Must be 'paid', 'partially_paid', or 'not_paid'." },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const rideRequest = await RideRequest.findById(requestId);
    if (!rideRequest) {
      return NextResponse.json(
        { success: false, error: "Ride request not found." },
        { status: 404 }
      );
    }

    const ride = await Ride.findById(rideRequest.ride);
    if (!ride) {
      return NextResponse.json(
        { success: false, error: "Associated ride not found." },
        { status: 404 }
      );
    }

    // ACCESS CONTROL: Only the Driver who owns the completed ride can modify payment status
    if (ride.driver.toString() !== session.user.id) {
      return NextResponse.json(
        { success: false, error: "Access denied. Only the Driver who offered this ride can manage passenger payment status." },
        { status: 403 }
      );
    }

    // RIDE STATUS CONTROL: Payment status can ONLY be managed after the ride is marked completed
    if (ride.status !== "completed") {
      return NextResponse.json(
        { success: false, error: "Payment status can only be updated for completed rides." },
        { status: 400 }
      );
    }

    const totalFare = rideRequest.fare || 0;
    let finalAmountPaid = 0;

    if (paymentStatus === "paid") {
      finalAmountPaid = totalFare;
    } else if (paymentStatus === "not_paid") {
      finalAmountPaid = 0;
    } else if (paymentStatus === "partially_paid") {
      const numericAmount = Number(inputAmountPaid);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return NextResponse.json(
          { success: false, error: "For Partial Payment, amount paid must be greater than ₹0." },
          { status: 400 }
        );
      }
      if (numericAmount >= totalFare) {
        return NextResponse.json(
          { success: false, error: `For Partial Payment, amount paid must be less than the total fare of ₹${totalFare}. Select 'Paid' for full payment.` },
          { status: 400 }
        );
      }
      finalAmountPaid = numericAmount;
    }

    // Persist payment status to MongoDB
    rideRequest.paymentStatus = paymentStatus;
    rideRequest.amountPaid = finalAmountPaid;
    rideRequest.paymentUpdatedAt = new Date();
    await rideRequest.save();

    const remainingAmount = Math.max(0, totalFare - finalAmountPaid);

    return NextResponse.json({
      success: true,
      message: `Payment status updated to ${paymentStatus.replace("_", " ").toUpperCase()} (Paid: ₹${finalAmountPaid}, Remaining: ₹${remainingAmount}).`,
      request: rideRequest,
    });
  } catch (error: any) {
    console.error("Payment status update error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update fare payment status." },
      { status: 500 }
    );
  }
}
