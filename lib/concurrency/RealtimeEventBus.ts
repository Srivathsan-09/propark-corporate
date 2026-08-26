/**
 * CommuteX Real-Time Event Bus (WebSockets / SSE Event Publisher)
 * Broadcasts live seat availability updates, queue position shifts, and metrics to connected UI clients.
 */

import { EventEmitter } from "events";

export interface IRealtimeEvent {
  type:
    | "RIDE_AVAILABILITY_UPDATED"
    | "QUEUE_POSITION_UPDATED"
    | "BOOKING_STATUS_UPDATED"
    | "CONCURRENCY_METRICS_UPDATED";
  payload: any;
  timestamp: Date;
}

class RealtimeEventBusService extends EventEmitter {
  private sseClients: Set<(event: IRealtimeEvent) => void> = new Set();

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  /**
   * Broadcasts an event to all connected WebSockets / SSE clients
   */
  public broadcast(type: IRealtimeEvent["type"], payload: any) {
    const event: IRealtimeEvent = {
      type,
      payload,
      timestamp: new Date(),
    };

    // Emit via EventEmitter
    this.emit(type, event);
    this.emit("ANY", event);

    // Send to active SSE streams
    this.sseClients.forEach((clientCallback) => {
      try {
        clientCallback(event);
      } catch (err) {
        // Client disconnected
      }
    });
  }

  /**
   * Registers a Server-Sent Events client stream listener
   */
  public subscribeSSE(callback: (event: IRealtimeEvent) => void) {
    this.sseClients.add(callback);
    return () => {
      this.sseClients.delete(callback);
    };
  }

  /**
   * Active SSE subscriber count
   */
  public getClientCount(): number {
    return this.sseClients.size;
  }
}

// Export Singleton Instance
export const realtimeEventBus = new RealtimeEventBusService();
