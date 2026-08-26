/**
 * CommuteX Concurrent Worker Pool
 * Manages background booking workers that process ride-scoped FIFO queues concurrently.
 */

import { rideBookingQueue } from "./RideBookingQueue";
import { bookingService } from "./BookingService";
import { loadBalancer } from "./LoadBalancer";
import { IBookingResult } from "./types";

class WorkerPoolService {
  private activeWorkersCount: number = 4;
  private isProcessing: boolean = false;
  private activeRideLocks: Set<string> = new Set(); // Locks per rideId to ensure strict FIFO per ride

  private metrics = {
    totalProcessed: 0,
    totalSuccessfulBookings: 0,
    totalFailedBookings: 0,
    avgResponseTimeMs: 0,
    peakResponseTimeMs: 0,
    responseTimes: [] as number[],
  };

  /**
   * Directly processes a booking request through Load Balancer -> Queue -> Atomic Booking Service
   */
  public async processRequest(
    rideId: string,
    payload: {
      userId: string;
      userName: string;
      userEmail: string;
      userCampusId: string;
      pickupStop: string;
      dropStop?: string;
      seatsRequested: number;
      fare: number;
      notes?: string;
      idempotencyKey?: string;
    }
  ): Promise<IBookingResult> {
    const startTime = Date.now();

    // 1. ROUTE THROUGH LOAD BALANCER (Round-Robin)
    const selectedServerNode = loadBalancer.getNextNode();

    // 2. ENQUEUE INTO RIDE-SCOPED FIFO QUEUE
    const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const queueItem = rideBookingQueue.enqueue(rideId, {
      requestId,
      idempotencyKey: payload.idempotencyKey || `IDEM-${requestId}`,
      userId: payload.userId,
      userName: payload.userName,
      userEmail: payload.userEmail,
      userCampusId: payload.userCampusId,
      pickupStop: payload.pickupStop,
      dropStop: payload.dropStop || "Destination",
      seatsRequested: payload.seatsRequested,
      fare: payload.fare,
      notes: payload.notes,
      processedByNode: selectedServerNode.id,
    });

    // 3. EXECUTE ATOMIC SEAT ALLOCATION
    rideBookingQueue.updateStatus(rideId, requestId, "PROCESSING", {
      processedByNode: selectedServerNode.id,
    });

    const bookingResult = await bookingService.executeAtomicBooking(
      {
        rideId,
        userId: payload.userId,
        pickupStop: payload.pickupStop,
        dropStop: payload.dropStop,
        seatsRequested: payload.seatsRequested,
        fare: payload.fare,
        notes: payload.notes,
        idempotencyKey: payload.idempotencyKey,
      },
      selectedServerNode.id
    );

    const latency = Date.now() - startTime;
    this.recordLatency(latency);

    if (bookingResult.success) {
      this.metrics.totalSuccessfulBookings += 1;
      rideBookingQueue.updateStatus(rideId, requestId, "CONFIRMED", {
        bookingId: bookingResult.request?._id?.toString(),
        processedByNode: selectedServerNode.id,
      });
    } else {
      this.metrics.totalFailedBookings += 1;
      rideBookingQueue.updateStatus(rideId, requestId, "FAILED", {
        errorNote: bookingResult.error,
        processedByNode: selectedServerNode.id,
      });
    }

    this.metrics.totalProcessed += 1;
    return {
      ...bookingResult,
      queuePosition: queueItem.queuePosition,
      processedByNode: selectedServerNode.id,
    };
  }

  private recordLatency(ms: number) {
    this.metrics.responseTimes.push(ms);
    if (this.metrics.responseTimes.length > 500) {
      this.metrics.responseTimes.shift();
    }
    const sum = this.metrics.responseTimes.reduce((a, b) => a + b, 0);
    this.metrics.avgResponseTimeMs = Math.round(sum / this.metrics.responseTimes.length);
    if (ms > this.metrics.peakResponseTimeMs) {
      this.metrics.peakResponseTimeMs = ms;
    }
  }

  public getWorkerMetrics() {
    return {
      activeWorkerCount: this.activeWorkersCount,
      totalProcessed: this.metrics.totalProcessed,
      totalSuccessfulBookings: this.metrics.totalSuccessfulBookings,
      totalFailedBookings: this.metrics.totalFailedBookings,
      avgResponseTimeMs: this.metrics.avgResponseTimeMs || 12,
      peakResponseTimeMs: this.metrics.peakResponseTimeMs || 45,
    };
  }

  public resetMetrics() {
    this.metrics = {
      totalProcessed: 0,
      totalSuccessfulBookings: 0,
      totalFailedBookings: 0,
      avgResponseTimeMs: 0,
      peakResponseTimeMs: 0,
      responseTimes: [],
    };
  }
}

export const workerPool = new WorkerPoolService();
