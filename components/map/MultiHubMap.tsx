"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import Link from "next/link";
import { Route, MapPin, Navigation, Car, Eye, Layers, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface IHubMapItem {
  _id: string;
  hubId: string;
  name: string;
  corridor: string;
  origin: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  campusId: string;
  campusName: string;
  distanceKm: number;
  durationMinutes: number;
  routeCoordinates?: [number, number][];
  status: "active" | "inactive";
  activeRidesCount?: number;
  commutersCount?: number;
}

interface MultiHubMapProps {
  hubs: IHubMapItem[];
  selectedHubId?: string | null;
  onSelectHub?: (hub: IHubMapItem | null) => void;
  height?: string;
  viewMode?: "admin" | "employee";
}

const CORRIDOR_COLORS = [
  "#059669", // emerald
  "#2563eb", // blue
  "#7c3aed", // violet
  "#d97706", // amber
  "#0891b2", // cyan
  "#db2777", // pink
  "#4f46e5", // indigo
  "#0d9488", // teal
];

export default function MultiHubMap({
  hubs,
  selectedHubId = null,
  onSelectHub,
  height = "600px",
  viewMode = "admin",
}: MultiHubMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersGroupRef = useRef<L.LayerGroup | null>(null);
  const [activeHub, setActiveHub] = useState<IHubMapItem | null>(null);

  // Sync internal activeHub with selectedHubId prop
  useEffect(() => {
    if (selectedHubId) {
      const found = hubs.find((h) => h._id === selectedHubId || h.hubId === selectedHubId);
      if (found) setActiveHub(found);
    } else {
      setActiveHub(null);
    }
  }, [selectedHubId, hubs]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center on Chennai / default region
    const map = L.map(mapContainerRef.current, {
      center: [13.02, 80.18],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      minZoom: 2,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layersGroupRef.current = layerGroup;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Hub Markers and Polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (!hubs || hubs.length === 0) return;

    const bounds = L.latLngBounds([]);

    hubs.forEach((hub, idx) => {
      const color = CORRIDOR_COLORS[idx % CORRIDOR_COLORS.length];
      const isSelected = activeHub?._id === hub._id;

      // 1. Origin Marker (Green circle with pin icon)
      if (hub.origin?.latitude && hub.origin?.longitude) {
        const originLatLng: [number, number] = [hub.origin.latitude, hub.origin.longitude];
        bounds.extend(originLatLng);

        const originIcon = L.divIcon({
          className: "custom-hub-origin-pin",
          html: `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background-color: #059669;
              border: 2px solid #ffffff;
              border-radius: 9999px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
            " title="Origin: ${hub.origin.name}">
              A
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const originMarker = L.marker(originLatLng, { icon: originIcon }).addTo(layerGroup);
        originMarker.bindTooltip(
          `<strong>${hub.name}</strong><br/><span style="color:#059669">Origin:</span> ${hub.origin.name}`,
          { direction: "top", offset: [0, -10] }
        );
        originMarker.on("click", () => {
          setActiveHub(hub);
          onSelectHub?.(hub);
        });
      }

      // 2. Destination Marker (Blue circle with pin icon)
      if (hub.destination?.latitude && hub.destination?.longitude) {
        const destLatLng: [number, number] = [hub.destination.latitude, hub.destination.longitude];
        bounds.extend(destLatLng);

        const destIcon = L.divIcon({
          className: "custom-hub-dest-pin",
          html: `
            <div style="
              display: flex;
              align-items: center;
              justify-content: center;
              width: 28px;
              height: 28px;
              background-color: #dc2626;
              border: 2px solid #ffffff;
              border-radius: 9999px;
              box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25);
              color: #ffffff;
              font-size: 11px;
              font-weight: 700;
              cursor: pointer;
            " title="Destination: ${hub.destination.name}">
              B
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const destMarker = L.marker(destLatLng, { icon: destIcon }).addTo(layerGroup);
        destMarker.bindTooltip(
          `<strong>${hub.name}</strong><br/><span style="color:#dc2626">Destination:</span> ${hub.destination.name}`,
          { direction: "top", offset: [0, -10] }
        );
        destMarker.on("click", () => {
          setActiveHub(hub);
          onSelectHub?.(hub);
        });
      }

      // 3. Polyline for corridor
      const coords =
        hub.routeCoordinates && hub.routeCoordinates.length > 0
          ? hub.routeCoordinates
          : hub.origin?.latitude && hub.destination?.latitude
          ? [
              [hub.origin.latitude, hub.origin.longitude] as [number, number],
              [hub.destination.latitude, hub.destination.longitude] as [number, number],
            ]
          : [];

      if (coords.length > 0) {
        coords.forEach((pt) => bounds.extend(pt));

        // Outer halo polyline if selected
        if (isSelected) {
          L.polyline(coords, {
            color: "#ffffff",
            weight: 9,
            opacity: 0.9,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layerGroup);
        }

        const polyline = L.polyline(coords, {
          color: isSelected ? "#059669" : color,
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 0.95 : 0.75,
          dashArray: hub.status === "inactive" ? "6, 6" : undefined,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(layerGroup);

        const actionUrl =
          viewMode === "admin"
            ? `/admin/hubs/${hub._id}`
            : `/commutehub/rides/find?hubId=${hub._id}`;

        const actionLabel = viewMode === "admin" ? "View Hub Details" : "Find Rides";

        polyline.bindPopup(`
          <div style="font-family: sans-serif; min-width: 220px; padding: 4px;">
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${hub.name}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">${hub.corridor}</div>
            <div style="display: flex; gap: 8px; font-size: 11px; color: #334155; margin-bottom: 10px; background: #f8fafc; padding: 6px; border-radius: 6px;">
              <span><strong>${hub.distanceKm}</strong> km</span>
              <span>•</span>
              <span>~<strong>${hub.durationMinutes}</strong> mins</span>
              <span>•</span>
              <span><strong>${hub.activeRidesCount || 0}</strong> active rides</span>
            </div>
            <a href="${actionUrl}" style="
              display: block;
              text-align: center;
              background-color: #059669;
              color: #ffffff;
              text-decoration: none;
              font-size: 11px;
              font-weight: 600;
              padding: 6px 12px;
              border-radius: 6px;
            ">${actionLabel} &rarr;</a>
          </div>
        `);

        polyline.on("click", () => {
          setActiveHub(hub);
          onSelectHub?.(hub);
        });
      }
    });

    // Fit map view to bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [hubs, activeHub, onSelectHub, viewMode]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Top Map Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <Route className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              CommuteHub Virtual Corridors ({hubs.length})
            </div>
            <div className="text-[11px] text-slate-500">
              Click any corridor or marker to inspect route and active rides
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-[8px] font-bold text-white">
              A
            </span>
            <span>Origin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-bold text-white">
              B
            </span>
            <span>Destination</span>
          </div>
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} style={{ height, width: "100%", minHeight: "360px" }} />

      {/* Selected Hub Floating Drawer / Bottom Card */}
      {activeHub && (
        <div className="absolute bottom-4 left-4 right-4 z-[1000] max-w-xl mx-auto rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-mono font-medium text-slate-700">
                  {activeHub.hubId}
                </Badge>
                <Badge
                  className={
                    activeHub.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                      : "bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
                  }
                  variant="outline"
                >
                  {activeHub.status === "active" ? "Active Corridor" : "Inactive"}
                </Badge>
                <span className="text-[11px] text-slate-500">{activeHub.campusName}</span>
              </div>
              <h4 className="mt-1 text-xs font-bold text-slate-900">{activeHub.name}</h4>
              <p className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                <span>{activeHub.origin.name}</span>
                <span className="text-slate-400">&rarr;</span>
                <span>{activeHub.destination.name}</span>
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveHub(null)}
              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
            >
              &times;
            </Button>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <div>
                <span className="text-slate-400 text-[10px] block">Distance</span>
                <span className="font-bold text-slate-900">{activeHub.distanceKm} km</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Time</span>
                <span className="font-bold text-slate-900">~{activeHub.durationMinutes} mins</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Active Rides</span>
                <span className="font-bold text-emerald-700">{activeHub.activeRidesCount || 0}</span>
              </div>
            </div>

            {viewMode === "admin" ? (
              <Link href={`/admin/hubs/${activeHub._id}`}>
                <Button size="sm" className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  View Hub
                </Button>
              </Link>
            ) : (
              <Link href={`/commutehub/rides/find?hubId=${activeHub._id}`}>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5">
                  <Car className="h-3.5 w-3.5" />
                  Find Rides Under Hub
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
