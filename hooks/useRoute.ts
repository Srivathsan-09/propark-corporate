"use client";

import { useState, useCallback, useRef } from "react";
import { routingService, LatLngPoint, RouteResult } from "@/lib/services/routing";

export function useRoute() {
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);

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

      const requestId = ++latestRequestIdRef.current;
      setIsCalculating(true);
      setError(null);

      try {
        const result = await routingService.calculateRoute(waypoints, departureTime, driverLocation);

        // Stale Request Protection: only commit route if this is the newest request
        if (requestId !== latestRequestIdRef.current) {
          return null;
        }

        setRouteResult(result);
        setIsCalculating(false);
        return result;
      } catch (err: any) {
        if (requestId === latestRequestIdRef.current) {
          console.warn("Route calculation failed:", err);
          setError("Unable to compute route between selected points.");
          setIsCalculating(false);
        }
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
    clearRoute: () => {
      latestRequestIdRef.current++;
      setRouteResult(null);
    },
  };
}
