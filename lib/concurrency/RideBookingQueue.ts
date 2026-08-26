/**
 * CommuteX Ride-Scoped FIFO Queue Manager
 * Maintains isolated, concurrency-safe FIFO queues for each ride (rideId).
 * Ensures requests for Ride A do NOT block Ride B or Ride C.
 */

import { IQueueItem, QueueItemStatus } from "./types";
import { realtimeEventBus } from "./RealtimeEventBus";

class RideBookingQueueManager {
  // Map of rideId -> Array of IQueueItem
  private queues: Map<string, IQueueItem[]> = new Map();
  private totalQueuedCount: number = 0;

  /**
   * Enqueues a high-demand booking request into the ride's isolated FIFO queue.
   */
  public enqueue(
    rideId: string,
    itemData: Omit<IQueueItem, "queuePosition" | "requestedAt" | "status" | "rideId">
  ): IQueueItem {
    let queue = this.queues.get(rideId);
    if (!queue) {
      queue = [];
      this.queues.set(rideId, queue);
    }

    const waitingItems = queue.filter((i) => i.status === "WAITING" || i.status === "PROCESSING");
    const queuePosition = waitingItems.length + 1;

    const queueItem: IQueueItem = {
      ...itemData,
      rideId,
      requestedAt: new Date(),
      status: "WAITING",
      queuePosition,
    };

    queue.push(queueItem);
    this.totalQueuedCount += 1;

    // Broadcast Realtime Queue Position Update
    realtimeEventBus.broadcast("QUEUE_POSITION_UPDATED", {
      rideId,
      requestId: queueItem.requestId,
      queuePosition: queueItem.queuePosition,
      status: queueItem.status,
      userId: queueItem.userId,
    });

    return queueItem;
  }

  /**
   * Fetches the next WAITING item in a ride's queue for worker processing
   */
  public dequeueNext(rideId: string): IQueueItem | null {
    const queue = this.queues.get(rideId);
    if (!queue || queue.length === 0) return null;

    const nextWaiting = queue.find((i) => i.status === "WAITING");
    if (!nextWaiting) return null;

    nextWaiting.status = "PROCESSING";

    realtimeEventBus.broadcast("QUEUE_POSITION_UPDATED", {
      rideId,
      requestId: nextWaiting.requestId,
      queuePosition: 1,
      status: "PROCESSING",
      userId: nextWaiting.userId,
    });

    return nextWaiting;
  }

  /**
   * Updates an item's status in the queue and recalculates queue positions for waiting items
   */
  public updateStatus(
    rideId: string,
    requestId: string,
    status: QueueItemStatus,
    details?: { errorNote?: string; bookingId?: string; processedByNode?: string }
  ) {
    const queue = this.queues.get(rideId);
    if (!queue) return;

    const item = queue.find((i) => i.requestId === requestId);
    if (!item) return;

    item.status = status;
    if (details?.errorNote) item.errorNote = details.errorNote;
    if (details?.bookingId) item.bookingId = details.bookingId;
    if (details?.processedByNode) item.processedByNode = details.processedByNode;

    // Recalculate remaining waiting positions
    let pos = 1;
    queue.forEach((qItem) => {
      if (qItem.status === "WAITING") {
        qItem.queuePosition = pos++;
        realtimeEventBus.broadcast("QUEUE_POSITION_UPDATED", {
          rideId,
          requestId: qItem.requestId,
          queuePosition: qItem.queuePosition,
          status: qItem.status,
          userId: qItem.userId,
        });
      }
    });

    realtimeEventBus.broadcast("BOOKING_STATUS_UPDATED", {
      rideId,
      requestId: item.requestId,
      status: item.status,
      bookingId: item.bookingId,
      errorNote: item.errorNote,
      userId: item.userId,
    });
  }

  /**
   * Returns current queue array for a specific ride
   */
  public getQueue(rideId: string): IQueueItem[] {
    return this.queues.get(rideId) || [];
  }

  /**
   * Returns item by requestId
   */
  public getItem(rideId: string, requestId: string): IQueueItem | undefined {
    const queue = this.queues.get(rideId);
    return queue?.find((i) => i.requestId === requestId);
  }

  /**
   * Returns overall queue metrics
   */
  public getQueueMetrics() {
    let totalWaiting = 0;
    let totalProcessing = 0;
    let activeRides = 0;

    this.queues.forEach((queue) => {
      const activeInRide = queue.filter(
        (i) => i.status === "WAITING" || i.status === "PROCESSING"
      );
      if (activeInRide.length > 0) activeRides++;

      queue.forEach((i) => {
        if (i.status === "WAITING") totalWaiting++;
        if (i.status === "PROCESSING") totalProcessing++;
      });
    });

    return {
      totalActiveRides: activeRides,
      totalQueuedRequests: this.totalQueuedCount,
      totalWaiting,
      totalProcessing,
    };
  }

  /**
   * Clears all queues (used in load testing resets)
   */
  public resetQueues() {
    this.queues.clear();
    this.totalQueuedCount = 0;
  }
}

// Export Singleton Instance
export const rideBookingQueue = new RideBookingQueueManager();
