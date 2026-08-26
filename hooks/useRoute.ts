"use client";

import { useState, useCallback } from "react";
import { routingService, LatLngPoint, RouteResult } from "@/lib/services/routing";

export function useRoute() {
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateRoute = useCallback(
    async (
      waypoints: LatLngPoint[],
      departureTime?: string,
      driverLocation?: LatLngPoint | null
    ): Promise<RouteResult | null> => {
      if (!waypoints || waypoints.length < 2) {
        setRouteResult(null);
        return null;
      }

      setIsCalculating(true);
      setError(null);

      try {
        const result = await routingService.calculateRoute(waypoints, departureTime, driverLocation);
        setRouteResult(result);
        setIsCalculating(false);
        return result;
      } catch (err: any) {
        console.warn("Route calculation failed:", err);
        setError("Unable to compute route between selected points.");
        setIsCalculating(false);
        return null;
      }
    },
    []
  );

  return {
    routeResult,
    isCalculating,
    error,
    calculateRoute,
    clearRoute: () => setRouteResult(null),
  };
}
