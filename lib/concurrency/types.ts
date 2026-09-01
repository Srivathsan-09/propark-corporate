/**
 * CommuteX High-Concurrency Ride Booking & Load Balancing Type Definitions
 */

export type QueueItemStatus = "WAITING" | "PROCESSING" | "CONFIRMED" | "FAILED" | "CANCELLED";

export interface IQueueItem {
  requestId: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
  userEmail: string;
  userCampusId: string;
  rideId: string;
  pickupStop: string;
  dropStop: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  currentLocation?: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number };
  requestedAt: Date;
  status: QueueItemStatus;
  queuePosition: number;
  processedByNode?: string;
  errorNote?: string;
  bookingId?: string;
}

export interface IServerNode {
  id: string; // e.g. "Server 1"
  port: number; // e.g. 3001
  status: "ONLINE" | "OFFLINE" | "DEGRADED";
  activeRequests: number;
  totalRouted: number;
  lastHeartbeat: Date;
}

export interface IBookingPayload {
  rideId: string;
  userId: string;
  pickupStop: string;
  dropStop?: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  currentLocation?: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number };
  idempotencyKey?: string;
}

export interface IBookingResult {
  success: boolean;
  message?: string;
  request?: any;
  availableSeats?: number;
  idempotencyHit?: boolean;
  queuePosition?: number;
  processedByNode?: string;
  error?: string;
  details?: any;
}

export interface IConcurrencyMetrics {
  loadBalancer: {
    strategy: "ROUND_ROBIN";
    activeNodeCount: number;
    totalNodes: number;
    totalRequestsRouted: number;
    currentNodeIndex: number;
  };
  serverNodes: IServerNode[];
  queues: {
    totalActiveRides: number;
    totalQueuedRequests: number;
    totalWaiting: number;
    totalProcessing: number;
  };
  workers: {
    activeWorkerCount: number;
    totalProcessed: number;
    totalSuccessfulBookings: number;
    totalFailedBookings: number;
  };
  performance: {
    avgResponseTimeMs: number;
    peakResponseTimeMs: number;
    lastUpdated: Date;
  };
}

export interface ILoadTestConfig {
  testId: "test1" | "test2" | "test3" | "test4" | "test5" | "test6";
  rideId?: string;
  totalSeats: number;
  concurrentUsers: number;
  useLoadBalancer?: boolean;
  testIdempotency?: boolean;
}

export interface ILoadTestResult {
  testId: string;
  testName: string;
  totalSeats: number;
  concurrentUsers: number;
  successfulBookings: number;
  failedBookings: number;
  duplicateBookings: number;
  remainingSeats: number;
  idempotentHits: number;
  durationMs: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  isConcurrencySafe: boolean;
  log: string[];
}
