"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { geocodingService } from "@/lib/services/geocoding";
import { Loader2, Navigation2, MapPin, IndianRupee, Car } from "lucide-react";
import { CarLoader } from "@/components/common/CarLoader";
import { DynamicRerouteEngine } from "@/lib/services/rerouting";
import type { RouteResult } from "@/lib/services/routing";

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
  passengerLocation?: DriverLivePoint | null;
  passengerName?: string;
  panToDriver?: boolean;
  routeCoordinates?: [number, number][];
  alternativeRoutes?: Array<{
    index: number;
    name: string;
    summary: string;
    coordinates: [number, number][];
    distanceKm: number;
    durationMinutes: number;
    formattedDistance: string;
    formattedDuration: string;
    trafficLevel: "Light" | "Moderate" | "Heavy";
  }>;
  selectedRouteIndex?: number;
  onSelectRouteIndex?: (index: number) => void;
  distanceText?: string;
  durationText?: string;
  trafficLevel?: "Light" | "Moderate" | "Heavy";
  onMapClick?: (location: { address: string; latitude: number; longitude: number }) => void;
  isClickPicking?: boolean;
  clickPickLabel?: string;
  enableDynamicRerouting?: boolean;
  reroutingThresholdMeters?: number;
  onRouteRecalculated?: (newRoute: RouteResult) => void;
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
  passengerLocation = null,
  passengerName = "Passenger",
  panToDriver = false,
  routeCoordinates = [],
  alternativeRoutes = [],
  selectedRouteIndex = 0,
  onSelectRouteIndex,
  distanceText,
  durationText,
  trafficLevel,
  onMapClick,
  isClickPicking = false,
  clickPickLabel = "Click anywhere on the map to set location",
  enableDynamicRerouting = true,
  reroutingThresholdMeters = 35,
  onRouteRecalculated,
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
  const mapRouteRequestIdRef = useRef(0);

  const [reroutedRoute, setReroutedRoute] = useState<RouteResult | null>(null);
  const [isRecalculatingRoute, setIsRecalculatingRoute] = useState(false);
  const [recalculationNotice, setRecalculationNotice] = useState<string | null>(null);

  const rerouteEngineRef = useRef<DynamicRerouteEngine | null>(null);
  if (!rerouteEngineRef.current) {
    rerouteEngineRef.current = new DynamicRerouteEngine({
      deviationThresholdMeters: reroutingThresholdMeters,
    });
  }

  // Reset rerouted route if routeCoordinates was explicitly replaced or cleared from parent
  const prevParentRouteRef = useRef(routeCoordinates);
  useEffect(() => {
    if (routeCoordinates !== prevParentRouteRef.current) {
      prevParentRouteRef.current = routeCoordinates;
      if (reroutedRoute && routeCoordinates && routeCoordinates !== reroutedRoute.coordinates) {
        setReroutedRoute(null);
      }
    }
  }, [routeCoordinates]);

  // Dynamic Route Recalculation Listener (Real-Time GPS Deviation Detection)
  useEffect(() => {
    if (!enableDynamicRerouting || !driverLocation || !destination) {
      return;
    }

    if (
      typeof driverLocation.latitude !== "number" ||
      typeof driverLocation.longitude !== "number" ||
      typeof destination.latitude !== "number" ||
      typeof destination.longitude !== "number"
    ) {
      return;
    }

    const activeCoords = reroutedRoute?.coordinates || routeCoordinates;
    if (!activeCoords || activeCoords.length < 2) {
      return;
    }

    const engine = rerouteEngineRef.current;
    if (!engine) return;

    engine.updateConfig({ deviationThresholdMeters: reroutingThresholdMeters || 35 });
    engine.setActivePolyline(activeCoords);

    let isMounted = true;

    engine
      .onPositionUpdate(driverLocation, {
        latitude: destination.latitude,
        longitude: destination.longitude,
        name: destination.name,
      })
      .then((res) => {
        if (!isMounted) return;

        if (res.isRerouting) {
          setIsRecalculatingRoute(true);
        }

        if (res.shouldReroute && res.newRoute) {
          setIsRecalculatingRoute(false);
          setReroutedRoute(res.newRoute);
          setRecalculationNotice("Route updated");
          setTimeout(() => {
            if (isMounted) setRecalculationNotice(null);
          }, 3000);
          if (onRouteRecalculated) {
            onRouteRecalculated(res.newRoute);
          }
        } else if (!res.isRerouting) {
          setIsRecalculatingRoute(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsRecalculatingRoute(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    driverLocation?.latitude,
    driverLocation?.longitude,
    driverLocation?.speed,
    driverLocation?.accuracy,
    enableDynamicRerouting,
    reroutingThresholdMeters,
    destination?.latitude,
    destination?.longitude,
    routeCoordinates,
    reroutedRoute,
    onRouteRecalculated,
  ]);

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

    // OpenStreetMap Standard & OSM France Tiles - High-contrast bold place names, neighborhoods & area labels
    const osmStandardTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 2,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: true,
      attribution: "&copy; OpenStreetMap contributors",
    });

    const osmFranceTileLayer = L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 2,
      keepBuffer: 4,
      updateWhenIdle: false,
      updateWhenZooming: true,
      attribution: "&copy; OpenStreetMap France & contributors",
    });

    osmStandardTileLayer.addTo(map);

    osmStandardTileLayer.on("tileerror", () => {
      if (mapInstanceRef.current && !mapInstanceRef.current.hasLayer(osmFranceTileLayer)) {
        osmFranceTileLayer.addTo(mapInstanceRef.current);
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
        const address = rev?.displayName || rev?.shortName || "Selected Commute Stop";
        onMapClick({ address, latitude: lat, longitude: lng });
      } catch (err) {
        onMapClick({
          address: "Selected Commute Stop",
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

    // Helper to create custom HTML markers with needle pointer and exact road anchoring
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
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); cursor: pointer; pointer-events: auto;">
            <div style="display: flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 9999px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid white; color: white; font-weight: 700; font-size: 11px; white-space: nowrap; line-height: 1;" class="${bgClass}">
              <span style="display: flex; height: 16px; width: 16px; align-items: center; justify-content: center; border-radius: 9999px; background: rgba(255,255,255,0.25); font-size: 10px;">${isNumber ? label : "●"}</span>
              <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${subLabel || label}</span>
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 7px solid white; margin-top: -1px; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.25));"></div>
            <div style="width: 6px; height: 6px; border-radius: 50%; background: #0f172a; margin-top: -3px; opacity: 0.85;"></div>
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

    // 4b. LIVE MOVING PASSENGER GPS MARKER (Pulsing Indigo / User 👤)
    if (
      passengerLocation &&
      typeof passengerLocation.latitude === "number" &&
      passengerLocation.latitude !== 0 &&
      typeof passengerLocation.longitude === "number"
    ) {
      const icon = L.divIcon({
        className: "custom-passenger-live-marker",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
            <!-- Pulsing outer GPS aura -->
            <span class="absolute inline-flex h-12 w-12 rounded-full bg-indigo-400 opacity-75 animate-ping"></span>
            <span class="absolute inline-flex h-9 w-9 rounded-full bg-indigo-500/30"></span>

            <!-- Core Passenger Icon Circle -->
            <div class="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-950 via-indigo-900 to-purple-800 border-2 border-white text-white text-xl shadow-2xl transition-transform hover:scale-110">
              <span class="drop-shadow-md">👤</span>
            </div>

            <!-- Floating Passenger Tag Above Marker -->
            <div class="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-indigo-950/95 text-white font-extrabold text-[10px] shadow-md border border-indigo-700 pointer-events-none flex items-center gap-1">
              <span class="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
              <span>${passengerName ? passengerName.split(" ")[0] : "Passenger"}</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const passengerMarker = L.marker([passengerLocation.latitude, passengerLocation.longitude], {
        icon,
        zIndexOffset: 990,
      });
      markersGroup.addLayer(passengerMarker);
      boundsPoints.push([passengerLocation.latitude, passengerLocation.longitude]);

      passengerMarker.bindPopup(`
        <div style="font-size: 12px; font-family: sans-serif;">
          <strong>Live Passenger Location</strong><br/>
          <span>${passengerName ? "Passenger: " + passengerName : "Passenger"}</span><br/>
          <span style="color: #6366f1; font-weight: bold;">● GPS Live Sharing Active</span>
        </div>
      `);
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

    const isRerouted = Boolean(reroutedRoute);
    const activeRouteToDraw = reroutedRoute?.coordinates || routeCoordinates;

    // 6. Draw Polyline Route & Multi-Route Options with Interactive Click Selection
    const drawRoutePolyline = (activeCoords: [number, number][], isRecalculatedRoute = false) => {
      if (!map) return;
      if (routeLayerGroupRef.current) {
        routeLayerGroupRef.current.clearLayers();
      } else {
        routeLayerGroupRef.current = L.layerGroup().addTo(map);
      }

      // 6a. Render Alternative (Unselected) Routes only if not rerouted
      if (!isRecalculatedRoute && alternativeRoutes && alternativeRoutes.length > 1) {
        alternativeRoutes.forEach((altRoute) => {
          if (altRoute.index === selectedRouteIndex || !altRoute.coordinates || altRoute.coordinates.length < 2) {
            return;
          }

          // Slate grey polyline for unselected route
          const altPolyline = L.polyline(altRoute.coordinates, {
            color: "#64748B",
            weight: 5,
            opacity: 0.6,
            lineCap: "round",
            lineJoin: "round",
          });

          altPolyline.on("click", () => {
            if (onSelectRouteIndex) {
              onSelectRouteIndex(altRoute.index);
            }
          });

          altPolyline.bindTooltip(`${altRoute.name} • ${altRoute.formattedDistance} (${altRoute.formattedDuration})`, {
            sticky: true,
            className: "text-xs font-medium text-slate-700 bg-white shadow-md border-0 px-2 py-1 rounded-md",
          });

          routeLayerGroupRef.current?.addLayer(altPolyline);
          altRoute.coordinates.forEach((pt) => boundsPoints.push(pt));
        });
      }

      if (activeCoords && activeCoords.length >= 2) {
        // Authoritative road geometry directly from routing engine
        const connectedCoords: [number, number][] = [...activeCoords];

        // When rerouted: start directly at current GPS location!
        // Do NOT draw a route from the original origin after rerouting.
        if (isRecalculatedRoute && driverLocation && typeof driverLocation.latitude === "number") {
          const first = activeCoords[0];
          const distDriver = Math.hypot(first[0] - driverLocation.latitude, first[1] - driverLocation.longitude);
          if (distDriver > 0.00002 && distDriver <= 0.0008) {
            connectedCoords.unshift([driverLocation.latitude, driverLocation.longitude]);
          }
        } else if (
          !isRecalculatedRoute &&
          startLocation &&
          typeof startLocation.latitude === "number" &&
          startLocation.latitude !== 0 &&
          typeof startLocation.longitude === "number"
        ) {
          // Standard initial route: snap to startLocation
          const first = activeCoords[0];
          const distStart = Math.hypot(first[0] - startLocation.latitude, first[1] - startLocation.longitude);
          if (distStart > 0.00005 && distStart <= 0.0008) {
            connectedCoords.unshift([startLocation.latitude, startLocation.longitude]);
          }
        }

        if (
          destination &&
          typeof destination.latitude === "number" &&
          destination.latitude !== 0 &&
          typeof destination.longitude === "number"
        ) {
          const last = activeCoords[activeCoords.length - 1];
          const distEnd = Math.hypot(last[0] - destination.latitude, last[1] - destination.longitude);
          if (distEnd > 0.00005 && distEnd <= 0.0008) {
            connectedCoords.push([destination.latitude, destination.longitude]);
          }
        }

        // Crisp white casing outline for Google Maps style
        const casing = L.polyline(connectedCoords, {
          color: "#FFFFFF",
          weight: 9,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        });

        // Google Maps Navigation Blue core road line
        const polyline = L.polyline(connectedCoords, {
          color: "#1A73E8",
          weight: 6,
          opacity: 1.0,
          lineCap: "round",
          lineJoin: "round",
        });

        routeLayerGroupRef.current.addLayer(casing);
        routeLayerGroupRef.current.addLayer(polyline);
        connectedCoords.forEach((pt) => boundsPoints.push(pt));
      }
    };

    if (activeRouteToDraw && activeRouteToDraw.length > 0) {
      drawRoutePolyline(activeRouteToDraw, isRerouted);
    } else if (startLocation && destination && startLocation.latitude && destination.latitude) {
      // Standalone mode: only calculate if parent did not provide routeCoordinates
      const reqId = ++mapRouteRequestIdRef.current;
      const waypoints = [
        { latitude: startLocation.latitude, longitude: startLocation.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      ];

      import("@/lib/services/routing").then(({ routingService }) => {
        routingService.calculateRoute(waypoints).then((res) => {
          if (reqId === mapRouteRequestIdRef.current && res && res.coordinates && res.coordinates.length > 0) {
            drawRoutePolyline(res.coordinates, false);
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
  }, [startLocation, destination, stops, customPickupPoint, driverLocation, passengerLocation, routeCoordinates, reroutedRoute, panToDriver, isClickPicking]);

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
    <div
      className={`relative rounded-2xl overflow-hidden border border-slate-200 shadow-sm ${className}`}
      style={{ height, minHeight: height }}
    >
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "100%",
          touchAction: "none",
          transform: "translate3d(0,0,0)",
          willChange: "transform",
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

      {/* Floating Recalculating Banner (Google Maps style) */}
      {isRecalculatingRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-950/95 backdrop-blur-md text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xl border border-blue-500/50 flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2">
          <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
          <span>Recalculating route...</span>
        </div>
      )}

      {recalculationNotice && !isRecalculatingRoute && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-emerald-950/95 backdrop-blur-md text-emerald-300 font-bold text-xs px-4 py-2 rounded-xl shadow-2xl border border-emerald-500/50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{recalculationNotice}</span>
        </div>
      )}

      {/* Floating Route Distance & ETA Badge */}
      {showStats && (
        (() => {
          const effectiveDistanceText = reroutedRoute?.formattedDistance || distanceText;
          const effectiveDurationText = reroutedRoute?.formattedDuration || durationText;
          const effectiveTraffic = reroutedRoute?.trafficLevel || trafficLevel;

          if (!effectiveDistanceText && !effectiveDurationText) return null;

          return (
            <div className="absolute bottom-3 right-3 z-10 bg-white/95 backdrop-blur-xs text-slate-900 border border-slate-200 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2.5 text-xs">
              {effectiveDistanceText && (
                <div className="flex items-center gap-1">
                  <Navigation2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-bold text-slate-800">{effectiveDistanceText}</span>
                </div>
              )}
              {effectiveDurationText && (
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2 text-slate-600">
                  <span>ETA</span>
                  <strong className="text-emerald-700 font-bold">{effectiveDurationText}</strong>
                </div>
              )}
              {effectiveTraffic && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                    effectiveTraffic === "Heavy"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : effectiveTraffic === "Moderate"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}
                >
                  {effectiveTraffic} Traffic
                </span>
              )}
            </div>
          );
        })()
      )}

      {/* OpenStreetMap Attribution pill */}
      <div className="absolute bottom-1 left-2 z-10 text-[9px] text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
        &copy; OpenStreetMap & OSRM
      </div>
    </div>
  );
}
