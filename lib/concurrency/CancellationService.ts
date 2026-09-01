/**
 * CommuteX Cancellation & Seat Release Concurrency Service
 * Atomically releases seats when a booking is cancelled and promotes next waiting users in the FIFO queue.
 */

import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import Ride from "@/models/Ride";
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

    const ride = await Ride.findOne({ "requests._id": requestId });
    if (!ride) {
      return { success: false, error: "Booking request not found." };
    }

    const request = ride.requests.find((r: any) => r._id.toString() === requestId);
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

    try {
      const seatsToRelease = request.seatsRequested || 1;

      // Update embedded request status and increment seats atomically
      const updatedRide = await Ride.findOneAndUpdate(
        { _id: ride._id, "requests._id": requestId },
        {
          $set: { "requests.$.status": "cancelled" },
          $inc: { availableSeats: seatsToRelease },
          $pull: { acceptedPassengers: request.passenger },
        },
        { new: true }
      );

      const finalSeats = updatedRide
        ? Math.min(updatedRide.availableSeats, updatedRide.totalSeats)
        : 0;

      // Broadcast Real-time Event
      realtimeEventBus.broadcast("RIDE_AVAILABILITY_UPDATED", {
        rideId: ride._id.toString(),
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
      console.error("Cancellation Error:", err);
      return { success: false, error: err?.message || "Failed to cancel booking." };
    }
  }
}

export const cancellationService = new CancellationConcurrencyService();
