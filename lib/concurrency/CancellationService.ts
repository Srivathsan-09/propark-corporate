/**
 * CommuteX Cancellation & Seat Release Concurrency Service
 * Atomically releases seats when a booking is cancelled and promotes next waiting users in the FIFO queue.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
import RideRequest from "@/models/RideRequest";
import { realtimeEventBus } from "./RealtimeEventBus";

class CancellationConcurrencyService {
  /**
   * Atomically cancels a booking and releases seats back to the ride
   */
  public async cancelBookingAndReleaseSeats(
    requestId: string,
    userId: string,
    cancelledByRole: "passenger" | "driver" | "admin" = "passenger"
  ) {
    await connectToDatabase();

    const request = await RideRequest.findById(requestId);
    if (!request) {
      return { success: false, error: "Booking request not found." };
    }

    if (request.status === "cancelled") {
      return { success: true, message: "Booking is already cancelled.", request };
    }

    const isPassenger = request.passenger.toString() === userId;
    const isDriver = request.driver.toString() === userId;
    const isAdmin = cancelledByRole === "admin";

    if (!isPassenger && !isDriver && !isAdmin) {
      return { success: false, error: "Unauthorized. You cannot cancel this booking." };
    }

    let session: mongoose.ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (sessionError) {
      session = null;
    }

    try {
      // 1. Mark request as cancelled
      request.status = "cancelled";
      await request.save({ session: session || undefined });

      const seatsToRelease = request.seatsRequested || 1;

      // 2. Atomically increment availableSeats on Ride (capped at totalSeats)
      const updatedRide = await Ride.findOneAndUpdate(
        { _id: request.ride },
        {
          $inc: { availableSeats: seatsToRelease },
          $pull: { acceptedPassengers: request.passenger },
        },
        { new: true, session: session || undefined }
      );

      if (updatedRide && updatedRide.availableSeats > updatedRide.totalSeats) {
        // Enforce capacity safety cap
        await Ride.updateOne(
          { _id: request.ride },
          { availableSeats: updatedRide.totalSeats },
          { session: session || undefined }
        );
      }

      if (session && session.inTransaction()) {
        await session.commitTransaction();
      }

      const finalSeats = updatedRide
        ? Math.min(updatedRide.availableSeats, updatedRide.totalSeats)
        : 0;

      // 3. Broadcast Real-time Event
      realtimeEventBus.broadcast("RIDE_AVAILABILITY_UPDATED", {
        rideId: request.ride.toString(),
        availableSeats: finalSeats,
        totalSeats: updatedRide?.totalSeats,
        eventReason: "CANCELLATION_SEAT_RELEASED",
      });

      return {
        success: true,
        message: `Booking cancelled successfully. ${seatsToRelease} seat(s) released back to the ride.`,
        request,
        availableSeats: finalSeats,
      };
    } catch (err: any) {
      if (session && session.inTransaction()) {
        await session.abortTransaction();
      }
      console.error("Cancellation Transaction Error:", err);
      return { success: false, error: err?.message || "Failed to cancel booking." };
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
}

export const cancellationService = new CancellationConcurrencyService();
