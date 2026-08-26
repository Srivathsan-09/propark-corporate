/**
 * Route Corridor Validation & Geocoding Helper
 * Ensures route stops fall within a realistic geographic corridor between Origin & Destination
 * and provides robust fuzzy location prediction.
 */

import { geocodingService, LocationResult } from "./geocoding";

export interface Point {
  latitude: number;
  longitude: number;
  name?: string;
}

/**
 * Calculates Haversine distance in kilometers between two lat/lon points
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
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
 * Calculates minimum distance in km from a point (lat, lon) to a polyline route
 */
export function minDistanceToPolylineKm(
  lat: number,
  lon: number,
  polyline: [number, number][]
): number {
  if (!polyline || polyline.length === 0) return 0;
  let minDistance = Infinity;

  for (const [pLat, pLon] of polyline) {
    const dist = haversineDistanceKm(lat, lon, pLat, pLon);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }

  return minDistance;
}

export interface CorridorValidationResult {
  isValid: boolean;
  reason?: string;
  detourKm?: number;
  minDistanceToRouteKm?: number;
}

/**
 * Validates whether a candidate stop location falls within the commute corridor
 * between startPoint (Origin) and endPoint (Destination).
 */
export function validateStopCorridor(
  stop: { latitude: number; longitude: number; name?: string },
  startPoint: { latitude: number; longitude: number; name?: string },
  endPoint: { latitude: number; longitude: number; name?: string },
  routeCoordinates: [number, number][] = []
): CorridorValidationResult {
  // If origin or destination coordinates are not selected yet, allow addition
  if (
    !startPoint ||
    !endPoint ||
    !startPoint.latitude ||
    !endPoint.latitude ||
    (startPoint.latitude === 0 && startPoint.longitude === 0) ||
    (endPoint.latitude === 0 && endPoint.longitude === 0)
  ) {
    return { isValid: true };
  }

  const originDist = haversineDistanceKm(
    startPoint.latitude,
    startPoint.longitude,
    stop.latitude,
    stop.longitude
  );

  const destDist = haversineDistanceKm(
    stop.latitude,
    stop.longitude,
    endPoint.latitude,
    endPoint.longitude
  );

  const directDist = haversineDistanceKm(
    startPoint.latitude,
    startPoint.longitude,
    endPoint.latitude,
    endPoint.longitude
  );

  const totalStopRouteDist = originDist + destDist;
  const detourKm = totalStopRouteDist - directDist;

  // Maximum allowed detour buffer (e.g., 60% of route length or max 25 km for short routes)
  const maxAllowedDetourKm = Math.max(25, directDist * 0.65);

  // If route polyline coordinates exist, check distance from stop to nearest point on polyline
  let minDistToLine = 0;
  if (routeCoordinates && routeCoordinates.length > 0) {
    minDistToLine = minDistanceToPolylineKm(
      stop.latitude,
      stop.longitude,
      routeCoordinates
    );

    // If stop is more than 20 km away from any point on the route polyline
    if (minDistToLine > 20) {
      const stopLabel = stop.name ? `"${stop.name}"` : "This location";
      const startLabel = startPoint.name ? `"${startPoint.name.split(",")[0]}"` : "Origin";
      const endLabel = endPoint.name ? `"${endPoint.name.split(",")[0]}"` : "Destination";

      return {
        isValid: false,
        reason: `${stopLabel} is ${Math.round(
          minDistToLine
        )} km off your route between ${startLabel} and ${endLabel}. Only stops along your route corridor can be added.`,
        detourKm,
        minDistanceToRouteKm: minDistToLine,
      };
    }
  }

  // Check detour distance threshold
  if (detourKm > maxAllowedDetourKm) {
    const stopLabel = stop.name ? `"${stop.name}"` : "This location";
    const startLabel = startPoint.name ? `"${startPoint.name.split(",")[0]}"` : "Origin";
    const endLabel = endPoint.name ? `"${endPoint.name.split(",")[0]}"` : "Destination";

    return {
      isValid: false,
      reason: `${stopLabel} adds a ${Math.round(
        detourKm
      )} km detour to your commute between ${startLabel} and ${endLabel}. Please add stops along your path.`,
      detourKm,
      minDistanceToRouteKm: minDistToLine,
    };
  }

  return {
    isValid: true,
    detourKm,
    minDistanceToRouteKm: minDistToLine,
  };
}

/**
 * Robust Location Predictor with Fuzzy Spell Correction & Fallbacks
 * (e.g., "Iyapanthangal" -> "Iyyappanthangal, Chennai")
 */
export async function resolveFuzzyLocation(
  query: string,
  regionHint: string = "Tamil Nadu, India"
): Promise<LocationResult | null> {
  if (!query || query.trim().length < 2) return null;

  const cleanQuery = query.trim();

  // 1. Direct Nominatim search
  const directResults = await geocodingService.search(cleanQuery, 5);
  if (directResults.length > 0) {
    return directResults[0];
  }

  // 2. Try with region context appended (e.g. "Iyapanthangal Tamil Nadu India")
  const contextualQuery = `${cleanQuery}, ${regionHint}`;
  const contextualResults = await geocodingService.search(contextualQuery, 5);
  if (contextualResults.length > 0) {
    return contextualResults[0];
  }

  // 3. Normalized double-consonant attempt (e.g. "Iyapanthangal" -> "Iyyappan thangal")
  const normalized = cleanQuery
    .replace(/y/g, "yy")
    .replace(/p/g, "pp")
    .replace(/t/g, "th");
  const normalizedResults = await geocodingService.search(normalized, 5);
  if (normalizedResults.length > 0) {
    return normalizedResults[0];
  }

  return null;
}
