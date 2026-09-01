"use client";

import dynamic from "next/dynamic";
import React from "react";
import { CarLoader } from "@/components/common/CarLoader";
import type { MapPoint, DriverLivePoint } from "./LeafletRouteMap";

export type { MapPoint, DriverLivePoint };

export interface MapViewProps {
  startLocation?: MapPoint | null;
  destination?: MapPoint | null;
  stops?: MapPoint[];
  customPickupPoint?: MapPoint | null;
  driverLocation?: DriverLivePoint | null;
  driverName?: string;
  driverVehicleType?: string;
  passengerLocation?: DriverLivePoint | null;
  passengerName?: string;
  panToDriver?: boolean;
  routeCoordinates?: [number, number][];
  distanceText?: string;
  durationText?: string;
  trafficLevel?: "Light" | "Moderate" | "Heavy";
  onMapClick?: (location: { address: string; latitude: number; longitude: number }) => void;
  isClickPicking?: boolean;
  clickPickLabel?: string;
  height?: string;
  showStats?: boolean;
  className?: string;
}

const DynamicLeafletMap = dynamic(() => import("./LeafletRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[340px] rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center p-6">
      <CarLoader size="md" message="Loading interactive map..." />
    </div>
  ),
});

export default function MapView(props: MapViewProps) {
  return <DynamicLeafletMap {...props} />;
}
