"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { geocodingService } from "@/lib/services/geocoding";
import { Loader2, Navigation2, MapPin, IndianRupee, Car } from "lucide-react";
import { CarLoader } from "@/components/common/CarLoader";

export interface MapPoint {
  address?: string;
  name?: string;
  latitude: number;
  longitude: number;
  price?: number;
}

export interface DriverLivePoint {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
}

interface LeafletRouteMapProps {
  startLocation?: MapPoint | null;
  destination?: MapPoint | null;
  stops?: MapPoint[];
  customPickupPoint?: MapPoint | null;
  driverLocation?: DriverLivePoint | null;
  driverName?: string;
  driverVehicleType?: string;
  panToDriver?: boolean;
  routeCoordinates?: [number, number][];
  distanceText?: string;
  durationText?: string;
  onMapClick?: (location: { address: string; latitude: number; longitude: number }) => void;
  isClickPicking?: boolean;
  clickPickLabel?: string;
  height?: string;
  showStats?: boolean;
  className?: string;
}

export default function LeafletRouteMap({
  startLocation,
  destination,
  stops = [],
  customPickupPoint = null,
  driverLocation = null,
  driverName,
  driverVehicleType = "Car",
  panToDriver = false,
  routeCoordinates = [],
  distanceText,
  durationText,
  onMapClick,
  isClickPicking = false,
  clickPickLabel = "Click anywhere on the map to set location",
  height = "380px",
  showStats = true,
  className = "",
}: LeafletRouteMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);

  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Chennai / Tamil Nadu campus belt by default (12.9249, 80.1472)
    const initialLat = driverLocation?.latitude || startLocation?.latitude || 12.9249;
    const initialLng = driverLocation?.longitude || startLocation?.longitude || 80.1472;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    // OpenStreetMap standard tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const markersGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map click events
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!onMapClick) return;

      const { lat, lng } = e.latlng;
      setIsReverseGeocoding(true);

      try {
        const rev = await geocodingService.reverse(lat, lng);
        const address = rev?.displayName || `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        onMapClick({ address, latitude: lat, longitude: lng });
      } catch (err) {
        onMapClick({
          address: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          latitude: lat,
          longitude: lng,
        });
      } finally {
        setIsReverseGeocoding(false);
      }
    };

    map.on("click", handleMapClick);
    return () => {
      map.off("click", handleMapClick);
    };
  }, [onMapClick]);

  // Update Markers, Driver Live Marker, Route Polyline & Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }

    const boundsPoints: L.LatLngExpression[] = [];

    // Helper to create custom HTML markers
    const createHtmlMarker = (
      lat: number,
      lng: number,
      bgClass: string,
      label: string,
      subLabel?: string,
      isNumber: boolean = false
    ) => {
      const icon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="flex items-center gap-1.5 px-2 py-1 rounded-xl shadow-lg border border-white text-white font-bold text-xs ${bgClass} transform -translate-x-1/2 -translate-y-full hover:scale-110 transition-transform cursor-pointer">
            <span class="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px]">${isNumber ? label : "●"}</span>
            <span class="truncate max-w-[120px] text-[11px]">${subLabel || label}</span>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([lat, lng], { icon });
      markersGroup.addLayer(marker);
      boundsPoints.push([lat, lng]);
      return marker;
    };

    // 1. Starting Origin Marker (Green)
    if (
      startLocation &&
      typeof startLocation.latitude === "number" &&
      startLocation.latitude !== 0
    ) {
      const marker = createHtmlMarker(
        startLocation.latitude,
        startLocation.longitude,
        "bg-emerald-600",
        "A",
        startLocation.name || startLocation.address?.split(",")[0] || "Origin"
      );
      marker.bindPopup(`<strong>Origin:</strong><br/>${startLocation.address || "Start point"}`);
    }

    // 2. Intermediate Stops Markers (Amber)
    stops.forEach((stop, index) => {
      if (
        stop &&
        typeof stop.latitude === "number" &&
        stop.latitude !== 0 &&
        typeof stop.longitude === "number"
      ) {
        const priceLabel = stop.price ? `₹${stop.price}` : "";
        const title = `${stop.name || "Stop " + (index + 1)} ${priceLabel ? "(" + priceLabel + ")" : ""}`;
        const marker = createHtmlMarker(
          stop.latitude,
          stop.longitude,
          "bg-amber-500",
          `${index + 1}`,
          title,
          true
        );
        marker.bindPopup(
          `<strong>Stop ${index + 1}:</strong> ${stop.name || stop.address}<br/>${
            stop.price ? "Fare: ₹" + stop.price : ""
          }`
        );
      }
    });

    // 3. Destination Marker (Blue / Campus)
    if (
      destination &&
      typeof destination.latitude === "number" &&
      destination.latitude !== 0
    ) {
      const marker = createHtmlMarker(
        destination.latitude,
        destination.longitude,
        "bg-blue-600",
        "B",
        destination.name || destination.address?.split(",")[0] || "Campus"
      );
      marker.bindPopup(`<strong>Destination:</strong><br/>${destination.address || "End point"}`);
    }

    // 4. LIVE MOVING DRIVER GPS MARKER (Pulsing Emerald / Car)
    if (
      driverLocation &&
      typeof driverLocation.latitude === "number" &&
      driverLocation.latitude !== 0 &&
      typeof driverLocation.longitude === "number"
    ) {
      const isBike = driverVehicleType === "Bike";
      const icon = L.divIcon({
        className: "custom-driver-live-marker",
        html: `
          <div class="relative flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
            <!-- Pulsing outer ring -->
            <span class="absolute inline-flex h-10 w-10 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
            
            <!-- Core badge -->
            <div class="relative flex items-center gap-1 px-2.5 py-1 rounded-full shadow-2xl bg-emerald-700 border-2 border-white text-white font-extrabold text-xs">
              <span class="h-2 w-2 rounded-full bg-emerald-300 animate-pulse"></span>
              <span>${isBike ? "🏍️" : "🚗"} ${driverName ? driverName.split(" ")[0] : "Driver"}</span>
              ${
                driverLocation.speed
                  ? `<span class="text-[10px] text-emerald-200 font-mono">(${Math.round(driverLocation.speed)} km/h)</span>`
                  : ""
              }
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const driverMarker = L.marker([driverLocation.latitude, driverLocation.longitude], {
        icon,
        zIndexOffset: 1000,
      });
      markersGroup.addLayer(driverMarker);
      boundsPoints.push([driverLocation.latitude, driverLocation.longitude]);

      driverMarker.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif;">
          <strong>🚗 Live Driver Location</strong><br/>
          <span>${driverName ? "Driver: " + driverName : "Active Commute"}</span><br/>
          ${driverLocation.speed ? "<span>Speed: " + Math.round(driverLocation.speed) + " km/h</span><br/>" : ""}
          <span style="color: #059669; font-weight: bold;">● GPS Live Tracking Active</span>
        </div>
      `);

      if (panToDriver) {
        map.panTo([driverLocation.latitude, driverLocation.longitude], { animate: true });
      }
    }

    // 5. Custom Requested Pickup Point (Purple/Violet Animated Pin)
    if (
      customPickupPoint &&
      typeof customPickupPoint.latitude === "number" &&
      customPickupPoint.latitude !== 0 &&
      typeof customPickupPoint.longitude === "number"
    ) {
      const customMarker = createHtmlMarker(
        customPickupPoint.latitude,
        customPickupPoint.longitude,
        "bg-purple-600 ring-2 ring-white ring-offset-2 shadow-xl animate-bounce",
        "📍",
        customPickupPoint.name || "Custom Stop",
        false
      );
      customMarker.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif;">
          <strong style="color: #9333ea;">📍 Your Custom Pickup Location</strong><br/>
          <span>${customPickupPoint.address || customPickupPoint.name}</span>
        </div>
      `);
      boundsPoints.push([customPickupPoint.latitude, customPickupPoint.longitude]);
    }

    // 6. Draw Polyline Route
    if (routeCoordinates && routeCoordinates.length > 0) {
      const polyline = L.polyline(routeCoordinates, {
        color: "#059669", // Emerald green
        weight: 5,
        opacity: 0.85,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      routePolylineRef.current = polyline;

      // Add polyline points to bounds
      routeCoordinates.forEach((pt) => boundsPoints.push(pt));
    }

    // Auto-fit bounds or pan to custom point
    if (customPickupPoint && customPickupPoint.latitude && customPickupPoint.longitude) {
      map.setView([customPickupPoint.latitude, customPickupPoint.longitude], Math.max(map.getZoom(), 14), {
        animate: true,
      });
    } else if (boundsPoints.length > 0 && !panToDriver) {
      try {
        const bounds = L.latLngBounds(boundsPoints);
        map.fitBounds(bounds, {
          padding: [45, 45],
          maxZoom: 15,
          animate: true,
        });
      } catch (err) {
        console.warn("Bounds fitting warning:", err);
      }
    }
  }, [startLocation, destination, stops, customPickupPoint, driverLocation, routeCoordinates, panToDriver]);

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      <div ref={mapContainerRef} style={{ height, width: "100%" }} className="z-0" />

      {/* Floating Click-to-Pick Banner */}
      {isClickPicking && (
        <div className="absolute top-3 left-3 right-3 z-10 bg-slate-900/90 backdrop-blur-xs text-white text-xs py-2 px-3 rounded-xl shadow-lg flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400 animate-bounce" />
            <span className="font-semibold">{clickPickLabel}</span>
          </div>
          {isReverseGeocoding && (
            <div className="flex items-center gap-1 text-emerald-300 text-[11px] font-medium">
              <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
              <span>Fetching address...</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Route Distance & ETA Badge */}
      {showStats && (distanceText || durationText) && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-xs text-slate-900 border border-slate-200 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-3 text-xs">
          {distanceText && (
            <div className="flex items-center gap-1">
              <Navigation2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-bold text-slate-800">{distanceText}</span>
            </div>
          )}
          {durationText && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-slate-600">
              <span>Est.</span>
              <strong className="text-emerald-700">{durationText}</strong>
            </div>
          )}
        </div>
      )}

      {/* OpenStreetMap Attribution pill */}
      <div className="absolute bottom-1 left-2 z-10 text-[9px] text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
        &copy; OpenStreetMap & OSRM
      </div>
    </div>
  );
}
