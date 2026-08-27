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
  trafficLevel?: "Light" | "Moderate" | "Heavy";
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
  trafficLevel,
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
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [hasUserPanned, setHasUserPanned] = useState(false);

  const hasUserPannedRef = useRef(false);
  const isInitialViewDoneRef = useRef(false);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Chennai / Tamil Nadu campus belt by default (12.9249, 80.1472)
    const initialLat = driverLocation?.latitude || startLocation?.latitude || 12.9249;
    const initialLng = driverLocation?.longitude || startLocation?.longitude || 80.1472;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 13.5,
      zoomControl: true,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      scrollWheelZoom: true,
      boxZoom: true,
      keyboard: true,
      tapHold: false,
    });

    if (map.dragging) map.dragging.enable();
    if (map.touchZoom) map.touchZoom.enable();
    if (map.doubleClickZoom) map.doubleClickZoom.enable();
    if (map.scrollWheelZoom) map.scrollWheelZoom.enable();

    const markUserPanned = () => {
      if (!hasUserPannedRef.current) {
        hasUserPannedRef.current = true;
        setHasUserPanned(true);
      }
    };

    map.on("dragstart", markUserPanned);
    map.on("zoomstart", markUserPanned);
    map.on("touchstart", markUserPanned);
    map.on("movestart", (e: any) => {
      if (e && e.originalEvent) {
        markUserPanned();
      }
    });

    // Esri World Street Map - 100% Free, Zero Watermarks, Clean Google Maps Style with crisp street & place names up to zoom level 19
    const esriStreetTileLayer = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        attribution: "&copy; Esri, HERE, Garmin, USGS, NGA, EPA, USDA, NPS",
      }
    );

    // OpenStreetMap HOT - Vibrant colors, full place detail, 100% free, zero watermarks
    const osmHotTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    });

    esriStreetTileLayer.addTo(map);

    esriStreetTileLayer.on("tileerror", () => {
      if (mapInstanceRef.current && !mapInstanceRef.current.hasLayer(osmHotTileLayer)) {
        osmHotTileLayer.addTo(mapInstanceRef.current);
      }
    });

    const markersGroup = L.layerGroup().addTo(map);
    const routeGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = markersGroup;
    routeLayerGroupRef.current = routeGroup;
    mapInstanceRef.current = map;

    // Attach ResizeObserver so the map tile canvas NEVER turns white on layout/state changes
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    // Force Leaflet to recalculate container bounds after Next.js CSR mount
    const timer1 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    }, 100);

    const timer2 = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    }, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      resizeObserver.disconnect();
      map.off("dragstart", markUserPanned);
      map.off("zoomstart", markUserPanned);
      map.off("touchstart", markUserPanned);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map click events (disambiguate drag vs click)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    let pointerStartPos: { x: number; y: number } | null = null;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY : (e as MouseEvent).clientY;
      if (typeof clientX === "number" && typeof clientY === "number") {
        pointerStartPos = { x: clientX, y: clientY };
      }
    };

    const handleMapClick = async (e: L.LeafletMouseEvent) => {
      if (!onMapClick) return;

      // Disambiguate drag vs tap: if pointer moved more than 6px, it's a drag gesture
      if (pointerStartPos && e.originalEvent) {
        const orig = e.originalEvent as MouseEvent | TouchEvent;
        const clientX = "changedTouches" in orig ? orig.changedTouches[0]?.clientX : (orig as MouseEvent).clientX;
        const clientY = "changedTouches" in orig ? orig.changedTouches[0]?.clientY : (orig as MouseEvent).clientY;
        if (typeof clientX === "number" && typeof clientY === "number") {
          const dx = clientX - pointerStartPos.x;
          const dy = clientY - pointerStartPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 6) {
            // Drag gesture - do not trigger stop selection
            return;
          }
        }
      }

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

    const container = mapContainerRef.current;
    if (container) {
      container.addEventListener("pointerdown", handlePointerDown, { passive: true });
    }

    map.on("click", handleMapClick);
    return () => {
      if (container) {
        container.removeEventListener("pointerdown", handlePointerDown);
      }
      map.off("click", handleMapClick);
    };
  }, [onMapClick]);

  // Update Markers, Driver Live Marker, Route Polyline & Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    if (routeLayerGroupRef.current) {
      routeLayerGroupRef.current.clearLayers();
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
      const vehicleEmoji = isBike ? "🏍️" : "🚗";
      const icon = L.divIcon({
        className: "custom-driver-live-marker",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            <!-- Pulsing outer GPS aura -->
            <span class="absolute inline-flex h-12 w-12 rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
            <span class="absolute inline-flex h-9 w-9 rounded-full bg-emerald-500/30"></span>

            <!-- Core Car Icon Circle -->
            <div class="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-slate-950 via-slate-900 to-emerald-900 border-2 border-white text-white text-xl shadow-2xl transition-transform hover:scale-110">
              <span class="drop-shadow-md">${vehicleEmoji}</span>
            </div>

            <!-- Floating Driver Tag Above Car -->
            <div class="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-slate-950/95 text-white font-extrabold text-[10px] shadow-md border border-slate-700 pointer-events-none flex items-center gap-1">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>${driverName ? driverName.split(" ")[0] : "Driver"}</span>
              ${
                driverLocation.speed
                  ? `<span class="text-[9px] text-emerald-300 font-mono">(${Math.round(driverLocation.speed)} km/h)</span>`
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
          <strong>Live Driver Location</strong><br/>
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
        "P",
        customPickupPoint.name || "Custom Stop",
        false
      );
      customMarker.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif;">
          <strong style="color: #9333ea;">Your Custom Pickup Location</strong><br/>
          <span>${customPickupPoint.address || customPickupPoint.name}</span>
        </div>
      `);
      boundsPoints.push([customPickupPoint.latitude, customPickupPoint.longitude]);
    }

    // 6. Draw Polyline Route (if passed or calculate automatically from waypoints)
    const drawRoutePolyline = (coords: [number, number][]) => {
      if (!map || coords.length < 2) return;
      if (routeLayerGroupRef.current) {
        routeLayerGroupRef.current.clearLayers();
      } else {
        routeLayerGroupRef.current = L.layerGroup().addTo(map);
      }

      // Crisp white casing outline for Google Maps style
      const casing = L.polyline(coords, {
        color: "#FFFFFF",
        weight: 9,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      });

      // Google Maps Navigation Blue core road line
      const polyline = L.polyline(coords, {
        color: "#1A73E8",
        weight: 5,
        opacity: 1.0,
        lineCap: "round",
        lineJoin: "round",
      });

      routeLayerGroupRef.current.addLayer(casing);
      routeLayerGroupRef.current.addLayer(polyline);
      coords.forEach((pt) => boundsPoints.push(pt));
    };

    if (routeCoordinates && routeCoordinates.length > 0) {
      drawRoutePolyline(routeCoordinates);
    } else if (startLocation && destination && startLocation.latitude && destination.latitude) {
      const waypoints = [
        { latitude: startLocation.latitude, longitude: startLocation.longitude },
        ...stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
        { latitude: destination.latitude, longitude: destination.longitude },
      ];

      import("@/lib/services/routing").then(({ routingService }) => {
        routingService.calculateRoute(waypoints).then((res) => {
          if (res && res.coordinates && res.coordinates.length > 0) {
            drawRoutePolyline(res.coordinates);
          }
        });
      });
    }

    // Auto-fit bounds or pan to custom point ONLY if user hasn't manually slid/panned the map
    if (!hasUserPannedRef.current) {
      if (customPickupPoint && customPickupPoint.latitude && customPickupPoint.longitude) {
        map.setView([customPickupPoint.latitude, customPickupPoint.longitude], Math.max(map.getZoom(), 14.5), {
          animate: true,
        });
        isInitialViewDoneRef.current = true;
      } else if (boundsPoints.length > 0 && !isInitialViewDoneRef.current) {
        try {
          const bounds = L.latLngBounds(boundsPoints);
          map.fitBounds(bounds, {
            padding: [45, 45],
            maxZoom: 15,
            animate: false,
          });
          isInitialViewDoneRef.current = true;
        } catch (err) {
          console.warn("Bounds fitting warning:", err);
        }
      }
    }

    // Ensure map tiles redraw properly whenever picking mode or route changes
    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize({ animate: false });
      }
    }, 50);
  }, [startLocation, destination, stops, customPickupPoint, driverLocation, routeCoordinates, panToDriver, isClickPicking]);

  const handleRecenterMap = () => {
    hasUserPannedRef.current = false;
    isInitialViewDoneRef.current = false;
    setHasUserPanned(false);

    const map = mapInstanceRef.current;
    if (!map) return;

    const targetLat = driverLocation?.latitude || startLocation?.latitude;
    const targetLng = driverLocation?.longitude || startLocation?.longitude;

    if (targetLat && targetLng) {
      map.flyTo([targetLat, targetLng], 15, {
        animate: true,
        duration: 0.8,
      });
    }
  };

  return (
    <div className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}>
      <div
        ref={mapContainerRef}
        style={{
          height,
          width: "100%",
          background: "#e2e8f0",
          touchAction: "pan-x pan-y pinch-zoom",
          pointerEvents: "auto",
        }}
        className="z-0 cursor-grab active:cursor-grabbing"
      />

      {/* Floating Recenter Map Button when user has panned */}
      {hasUserPanned && (
        <button
          type="button"
          onClick={handleRecenterMap}
          className="absolute top-3 right-3 z-20 bg-slate-950/90 hover:bg-slate-900 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xl border border-slate-700/80 flex items-center gap-2 transition-all active:scale-95 animate-in fade-in-50"
        >
          <Navigation2 className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
          Recenter Map
        </button>
      )}

      {/* Floating Route Distance & ETA Badge */}
      {showStats && (distanceText || durationText) && (
        <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-xs text-slate-900 border border-slate-200 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs">
          {distanceText && (
            <div className="flex items-center gap-1">
              <Navigation2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="font-bold text-slate-800">{distanceText}</span>
            </div>
          )}
          {durationText && (
            <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-slate-600">
              <span>ETA</span>
              <strong className="text-emerald-700 font-bold">{durationText}</strong>
            </div>
          )}
          {trafficLevel && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                trafficLevel === "Heavy"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : trafficLevel === "Moderate"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
              }`}
            >
              {trafficLevel} Traffic
            </span>
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
