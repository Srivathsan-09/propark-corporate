/**
 * CommuteX Dynamic Route Recalculation Engine
 *
 * Real-time GPS deviation detection and automatic route recalculation
 * providing Google Maps-style rerouting for active commutes.
 */

import { routingService, LatLngPoint, RouteResult } from "./routing";

export interface LiveGpsPoint {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface ReroutingConfig {
  /**
   * Distance in meters the driver must be away from the current route polyline
   * to be considered deviated. Configurable (default: 35m, recommended range 20-50m).
   */
  deviationThresholdMeters: number;

  /**
   * Maximum acceptable GPS horizontal accuracy radius in meters.
   * If GPS accuracy exceeds this (e.g. 70m accuracy circle), the fix is considered noisy/unreliable
   * and will not trigger a reroute. Default: 45m.
   */
  maxGpsAccuracyMeters: number;

  /**
   * Number of consecutive deviated GPS location fixes required before triggering
   * recalculation. Prevents single-ping multipath reflections or GPS jumps from rerouting.
   * Default: 2.
   */
  consecutiveDeviationsRequired: number;

  /**
   * Minimum cooldown time in seconds between route recalculation API calls.
   * Protects against excessive requests and network congestion. Default: 6s.
   */
  cooldownSeconds: number;

  /**
   * Distance in meters from destination within which rerouting is disabled
   * (since the vehicle has essentially arrived). Default: 35m.
   */
  arrivalThresholdMeters: number;

  /**
   * Minimum speed in km/h required to consider heading valid for direction checks.
   * Default: 5 km/h.
   */
  minSpeedKmHForHeading: number;

  /**
   * Minimum distance in meters a stationary vehicle must move before a subsequent
   * reroute can be triggered at the same location. Default: 10m.
   */
  minMovementMetersForRepeat: number;
}

export const DEFAULT_REROUTING_CONFIG: ReroutingConfig = {
  deviationThresholdMeters: 35,
  maxGpsAccuracyMeters: 45,
  consecutiveDeviationsRequired: 2,
  cooldownSeconds: 6,
  arrivalThresholdMeters: 35,
  minSpeedKmHForHeading: 5,
  minMovementMetersForRepeat: 10,
};

export interface NearestRouteSegmentMatch {
  minDistanceMeters: number;
  closestPoint: [number, number]; // [lat, lng]
  segmentIndex: number;
  segmentBearing: number; // degrees 0-360
  fractionOnSegment: number; // 0..1
}

export interface DeviationEvaluationResult {
  isDeviated: boolean;
  distanceMeters: number;
  closestPoint?: [number, number];
  reason?: string;
  isIgnoredDueToNoise?: boolean;
}

// ---------------------------------------------------------------------------
// Pure Geometric Calculation Utilities
// ---------------------------------------------------------------------------

/**
 * Calculates perpendicular distance in meters from point P to line segment AB,
 * clamped to the segment endpoints.
 */
export function calculatePerpendicularDistanceToSegmentMeters(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): {
  distanceMeters: number;
  closestPoint: [number, number];
  segmentBearing: number;
  t: number;
} {
  const R = 6371000; // Earth radius in meters
  const midLatRad = ((a.latitude + b.latitude) / 2) * (Math.PI / 180);
  const cosMidLat = Math.cos(midLatRad);

  // Local planar projection centered at A (in meters)
  const xB = (b.longitude - a.longitude) * (Math.PI / 180) * R * cosMidLat;
  const yB = (b.latitude - a.latitude) * (Math.PI / 180) * R;

  const xP = (p.longitude - a.longitude) * (Math.PI / 180) * R * cosMidLat;
  const yP = (p.latitude - a.latitude) * (Math.PI / 180) * R;

  const lenSq = xB * xB + yB * yB;

  // Segment bearing (0 = North, 90 = East, 180 = South, 270 = West)
  let segmentBearing = 0;
  if (lenSq > 0.001) {
    segmentBearing = (Math.atan2(xB, yB) * (180 / Math.PI) + 360) % 360;
  }

  if (lenSq <= 0.0001) {
    // Degenerate segment (A and B are identical)
    const dist = Math.sqrt(xP * xP + yP * yP);
    return {
      distanceMeters: dist,
      closestPoint: [a.latitude, a.longitude],
      segmentBearing,
      t: 0,
    };
  }

  // Vector projection: t = (P . B) / |B|^2
  const rawT = (xP * xB + yP * yB) / lenSq;
  const t = Math.max(0, Math.min(1, rawT));

  // Closest point in local planar coordinates
  const cX = t * xB;
  const cY = t * yB;

  const distanceMeters = Math.sqrt((xP - cX) * (xP - cX) + (yP - cY) * (yP - cY));

  // Interpolate closest lat/lng on Earth
  const closestLat = a.latitude + t * (b.latitude - a.latitude);
  const closestLng = a.longitude + t * (b.longitude - a.longitude);

  return {
    distanceMeters,
    closestPoint: [closestLat, closestLng],
    segmentBearing,
    t,
  };
}

/**
 * Calculates the exact minimum perpendicular distance in meters from a GPS point
 * to an entire polyline route ([lat, lng] pairs).
 */
export function calculateMinDistanceToPolylineMeters(
  point: { latitude: number; longitude: number },
  polyline: [number, number][]
): NearestRouteSegmentMatch | null {
  if (!polyline || polyline.length < 2) return null;

  let minDistanceMeters = Infinity;
  let bestClosestPoint: [number, number] = polyline[0];
  let bestSegmentIndex = 0;
  let bestBearing = 0;
  let bestFraction = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = { latitude: polyline[i][0], longitude: polyline[i][1] };
    const b = { latitude: polyline[i + 1][0], longitude: polyline[i + 1][1] };

    const match = calculatePerpendicularDistanceToSegmentMeters(point, a, b);

    if (match.distanceMeters < minDistanceMeters) {
      minDistanceMeters = match.distanceMeters;
      bestClosestPoint = match.closestPoint;
      bestSegmentIndex = i;
      bestBearing = match.segmentBearing;
      bestFraction = match.t;
    }
  }

  return {
    minDistanceMeters,
    closestPoint: bestClosestPoint,
    segmentIndex: bestSegmentIndex,
    segmentBearing: bestBearing,
    fractionOnSegment: bestFraction,
  };
}

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Checks if the vehicle travel heading aligns with the road segment bearing.
 */
export function isHeadingAligned(
  travelHeading: number,
  segmentBearing: number,
  maxAngleDiffDegrees = 90
): boolean {
  const diff = Math.abs(((travelHeading - segmentBearing + 180) % 360) - 180);
  return diff <= maxAngleDiffDegrees;
}

/**
 * Pure evaluation function to check if a live GPS position deviates meaningfully
 * from the planned route, filtering out GPS noise, stationary vehicles, and destination arrivals.
 */
export function evaluateDeviation(
  pos: LiveGpsPoint | null | undefined,
  polyline: [number, number][],
  config: ReroutingConfig = DEFAULT_REROUTING_CONFIG
): DeviationEvaluationResult {
  if (!pos || typeof pos.latitude !== "number" || typeof pos.longitude !== "number") {
    return { isDeviated: false, distanceMeters: 0, reason: "Invalid GPS coordinates" };
  }

  if (isNaN(pos.latitude) || isNaN(pos.longitude) || (pos.latitude === 0 && pos.longitude === 0)) {
    return { isDeviated: false, distanceMeters: 0, reason: "Zero/NaN GPS coordinates" };
  }

  if (!polyline || polyline.length < 2) {
    return { isDeviated: false, distanceMeters: 0, reason: "Route polyline missing or incomplete" };
  }

  // 1. Accuracy Filter: Ignore fixes with low horizontal precision
  if (typeof pos.accuracy === "number" && pos.accuracy > config.maxGpsAccuracyMeters) {
    return {
      isDeviated: false,
      distanceMeters: 0,
      reason: `GPS accuracy (${Math.round(pos.accuracy)}m) exceeds threshold (${config.maxGpsAccuracyMeters}m)`,
      isIgnoredDueToNoise: true,
    };
  }

  // 2. Destination Arrival Filter: Don't reroute if within arrival threshold of final destination
  const destPoint = polyline[polyline.length - 1];
  const distToDest = calculateHaversineDistanceMeters(
    pos.latitude,
    pos.longitude,
    destPoint[0],
    destPoint[1]
  );
  if (distToDest <= config.arrivalThresholdMeters) {
    return {
      isDeviated: false,
      distanceMeters: distToDest,
      reason: "User is near destination (within arrival threshold)",
    };
  }

  // 3. Minimum distance to route polyline
  const match = calculateMinDistanceToPolylineMeters(pos, polyline);
  if (!match) {
    return { isDeviated: false, distanceMeters: 0, reason: "Unable to calculate route distance" };
  }

  const isDeviated = match.minDistanceMeters > config.deviationThresholdMeters;

  return {
    isDeviated,
    distanceMeters: match.minDistanceMeters,
    closestPoint: match.closestPoint,
    reason: isDeviated
      ? `Off route by ${Math.round(match.minDistanceMeters)}m (threshold: ${config.deviationThresholdMeters}m)`
      : `On route (${Math.round(match.minDistanceMeters)}m from centerline)`,
  };
}

// ---------------------------------------------------------------------------
// Stateful Real-Time Dynamic Rerouting Engine
// ---------------------------------------------------------------------------

export interface RerouteStateUpdate {
  shouldReroute: boolean;
  newRoute?: RouteResult | null;
  isRerouting: boolean;
  deviationDistanceMeters?: number;
  reason?: string;
  hasRerouted?: boolean;
}

export class DynamicRerouteEngine {
  private config: ReroutingConfig;
  private activePolyline: [number, number][] = [];
  private consecutiveDeviations = 0;
  private lastRerouteTime = 0;
  private isRerouting = 0; // request counter / lock
  private lastReroutedLocation: { latitude: number; longitude: number } | null = null;
  private hasRerouted = false;

  constructor(config: Partial<ReroutingConfig> = {}) {
    this.config = { ...DEFAULT_REROUTING_CONFIG, ...config };
  }

  /**
   * Update configuration at runtime (e.g. custom deviation threshold)
   */
  public updateConfig(newConfig: Partial<ReroutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ReroutingConfig {
    return { ...this.config };
  }

  /**
   * Update the active route polyline (either from initial route or subsequent reroute)
   */
  public setActivePolyline(polyline: [number, number][]): void {
    this.activePolyline = polyline || [];
  }

  public getActivePolyline(): [number, number][] {
    return this.activePolyline;
  }

  public getHasRerouted(): boolean {
    return this.hasRerouted;
  }

  /**
   * Reset tracking state (e.g. when trip finishes or modal closes)
   */
  public reset(): void {
    this.consecutiveDeviations = 0;
    this.lastRerouteTime = 0;
    this.isRerouting = 0;
    this.lastReroutedLocation = null;
    this.hasRerouted = false;
    this.activePolyline = [];
  }

  /**
   * Process a live GPS location update.
   * If deviation is confirmed, triggers recalculation from current GPS position to destination.
   */
  public async onPositionUpdate(
    currentPos: LiveGpsPoint,
    destination: LatLngPoint,
    options?: {
      departureTime?: string;
      customPolyline?: [number, number][];
    }
  ): Promise<RerouteStateUpdate> {
    const polyline = options?.customPolyline || this.activePolyline;

    if (!polyline || polyline.length < 2) {
      return { shouldReroute: false, isRerouting: this.isRerouting > 0, hasRerouted: this.hasRerouted };
    }

    if (!destination || typeof destination.latitude !== "number" || typeof destination.longitude !== "number") {
      return { shouldReroute: false, isRerouting: this.isRerouting > 0, hasRerouted: this.hasRerouted };
    }

    // 1. Evaluate deviation
    const evaluation = evaluateDeviation(currentPos, polyline, this.config);

    if (evaluation.isIgnoredDueToNoise) {
      // Don't reset consecutive deviations on GPS noise, just ignore this fix
      return {
        shouldReroute: false,
        isRerouting: this.isRerouting > 0,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: evaluation.reason,
        hasRerouted: this.hasRerouted,
      };
    }

    if (!evaluation.isDeviated) {
      // Driver is on route: reset consecutive deviation counter
      this.consecutiveDeviations = 0;
      return {
        shouldReroute: false,
        isRerouting: this.isRerouting > 0,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: evaluation.reason,
        hasRerouted: this.hasRerouted,
      };
    }

    // Driver is deviated! Increment consecutive counter
    this.consecutiveDeviations++;

    if (this.consecutiveDeviations < this.config.consecutiveDeviationsRequired) {
      return {
        shouldReroute: false,
        isRerouting: this.isRerouting > 0,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: `Deviation detected (${Math.round(evaluation.distanceMeters)}m), awaiting confirmation fix (${this.consecutiveDeviations}/${this.config.consecutiveDeviationsRequired})`,
        hasRerouted: this.hasRerouted,
      };
    }

    // 2. Concurrency Lock: Check if a rerouting calculation is already in-flight
    if (this.isRerouting > 0) {
      return {
        shouldReroute: false,
        isRerouting: true,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: "Reroute request already in progress",
        hasRerouted: this.hasRerouted,
      };
    }

    // 3. Cooldown Check: Enforce cooldown between recalculations
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRerouteTime) / 1000;
    if (elapsedSeconds < this.config.cooldownSeconds) {
      return {
        shouldReroute: false,
        isRerouting: false,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: `Reroute cooldown active (${Math.round(this.config.cooldownSeconds - elapsedSeconds)}s remaining)`,
        hasRerouted: this.hasRerouted,
      };
    }

    // 4. Stationary Repeat Check: Don't repeatedly reroute for same stationary point
    if (this.lastReroutedLocation) {
      const distFromLastReroute = calculateHaversineDistanceMeters(
        currentPos.latitude,
        currentPos.longitude,
        this.lastReroutedLocation.latitude,
        this.lastReroutedLocation.longitude
      );
      if (distFromLastReroute < this.config.minMovementMetersForRepeat) {
        return {
          shouldReroute: false,
          isRerouting: false,
          deviationDistanceMeters: evaluation.distanceMeters,
          reason: "User stationary at previously recalculated location",
          hasRerouted: this.hasRerouted,
        };
      }
    }

    // 5. Trigger Route Recalculation:
    // Current GPS position is the NEW starting point! Original destination is kept unchanged.
    this.isRerouting++;
    const requestId = this.isRerouting;

    const startPoint: LatLngPoint = {
      latitude: currentPos.latitude,
      longitude: currentPos.longitude,
      speed: currentPos.speed,
    };

    const destPoint: LatLngPoint = {
      latitude: destination.latitude,
      longitude: destination.longitude,
      name: destination.name,
    };

    try {
      const newRoute = await routingService.calculateRoute(
        [startPoint, destPoint],
        options?.departureTime,
        startPoint
      );

      // Check if another request superceded this one
      if (requestId !== this.isRerouting) {
        return { shouldReroute: false, isRerouting: this.isRerouting > 0, hasRerouted: this.hasRerouted };
      }

      if (newRoute && newRoute.coordinates && newRoute.coordinates.length >= 2) {
        // Ensure the new route line starts exactly at current GPS position
        const firstCoord = newRoute.coordinates[0];
        const distFromGpsToFirst = calculateHaversineDistanceMeters(
          currentPos.latitude,
          currentPos.longitude,
          firstCoord[0],
          firstCoord[1]
        );

        // Prepend current position if there's any small snap discrepancy
        if (distFromGpsToFirst > 1 && distFromGpsToFirst < 80) {
          newRoute.coordinates = [
            [currentPos.latitude, currentPos.longitude],
            ...newRoute.coordinates,
          ];
        }

        this.activePolyline = newRoute.coordinates;
        this.lastRerouteTime = Date.now();
        this.lastReroutedLocation = {
          latitude: currentPos.latitude,
          longitude: currentPos.longitude,
        };
        this.consecutiveDeviations = 0;
        this.hasRerouted = true;
        this.isRerouting = 0;

        return {
          shouldReroute: true,
          newRoute,
          isRerouting: false,
          deviationDistanceMeters: evaluation.distanceMeters,
          reason: "Route successfully recalculated from current GPS position",
          hasRerouted: true,
        };
      } else {
        // Routing returned empty or invalid geometry
        this.isRerouting = 0;
        return {
          shouldReroute: false,
          newRoute: null,
          isRerouting: false,
          deviationDistanceMeters: evaluation.distanceMeters,
          reason: "Routing service returned empty route geometry; existing route preserved",
          hasRerouted: this.hasRerouted,
        };
      }
    } catch (err: any) {
      // Routing API failure: preserve existing route intact, no crash
      console.warn("Dynamic reroute calculation failed gracefully:", err);
      this.isRerouting = 0;
      return {
        shouldReroute: false,
        newRoute: null,
        isRerouting: false,
        deviationDistanceMeters: evaluation.distanceMeters,
        reason: "Routing request failed; existing route preserved",
        hasRerouted: this.hasRerouted,
      };
    }
  }
}

export const reroutingService = new DynamicRerouteEngine();
