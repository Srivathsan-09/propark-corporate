"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Compass,
  ArrowLeft,
  MapPin,
  Route,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Car,
  Layers,
  Navigation,
  Edit3,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LocationSearchInput from "@/components/map/LocationSearchInput";
import { routingService, RouteResult } from "@/lib/services/routing";
import { resolvePlaceCoordinates } from "@/lib/services/geocoding";
import { snapPointToRoute } from "@/lib/services/routeCorridor";
import { CarLoader } from "@/components/common/CarLoader";

const LeafletRouteMap = dynamic(
  () => import("@/components/map/LeafletRouteMap"),
  { ssr: false }
);

interface ICampusOption {
  campusId: string;
  name: string;
  city?: string;
}

export interface IntermediateHub {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
}

type PickingTarget =
  | { type: "origin" }
  | { type: "destination" }
  | { type: "intermediate"; index: number }
  | null;

const isValidPoint = (
  p: { latitude?: number; longitude?: number; address?: string; name?: string } | null | undefined
): p is { name: string; address: string; latitude: number; longitude: number } => {
  return Boolean(
    p &&
    typeof p.latitude === "number" &&
    !isNaN(p.latitude) &&
    Math.abs(p.latitude) > 0.01 &&
    typeof p.longitude === "number" &&
    !isNaN(p.longitude) &&
    Math.abs(p.longitude) > 0.01
  );
};

interface IRoutePreview {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  legs?: { distanceKm: number; durationMinutes: number }[];
  [key: string]: any;
}

export default function EditHubPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params?.id as string;

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const [loading, setLoading] = useState(true);
  const [hubIdCode, setHubIdCode] = useState("");
  const [name, setName] = useState("");
  const [corridor, setCorridor] = useState("");
  const [origin, setOrigin] = useState<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  // Dynamic intermediate hubs in between origin and destination
  const [intermediateHubs, setIntermediateHubs] = useState<IntermediateHub[]>([]);

  const [destination, setDestination] = useState<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);

  const [campusId, setCampusId] = useState<string>("");
  const [campuses, setCampuses] = useState<ICampusOption[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // Calculated route geometry
  const [calculatedRoute, setCalculatedRoute] = useState<IRoutePreview | RouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Map picking mode
  const [pickingTarget, setPickingTarget] = useState<PickingTarget>(null);

  // Fetch hub data
  useEffect(() => {
    if (!id) return;

    let isMounted = true;
    setLoading(true);

    fetch(`/api/commutehub/hubs/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.hub) {
          const h = data.hub;
          setHubIdCode(h.hubId || "");
          setName(h.name || "");
          setCorridor(h.corridor || "");
          setOrigin(h.origin || null);

          // Populate intermediate hubs from intermediatePoints or fallback to commonPoint
          if (Array.isArray(h.intermediatePoints) && h.intermediatePoints.length > 0) {
            setIntermediateHubs(
              h.intermediatePoints.map((pt: any, idx: number) => ({
                id: pt.id || `hub-stop-${idx}-${Date.now()}`,
                name: pt.name || `Intermediate Hub ${idx + 1}`,
                address: pt.address || "",
                latitude: pt.latitude,
                longitude: pt.longitude,
              }))
            );
          } else if (h.commonPoint && isValidPoint(h.commonPoint)) {
            setIntermediateHubs([
              {
                id: `hub-stop-0-${Date.now()}`,
                name: h.commonPoint.name,
                address: h.commonPoint.address || "",
                latitude: h.commonPoint.latitude,
                longitude: h.commonPoint.longitude,
              },
            ]);
          } else {
            setIntermediateHubs([]);
          }

          setDestination(h.destination || null);
          setCampusId(h.campusId || "");
          setStatus(h.status || "active");

          if (h.routeCoordinates && h.routeCoordinates.length > 0) {
            setCalculatedRoute({
              coordinates: h.routeCoordinates,
              distanceKm: h.distanceKm || 0,
              durationMinutes: h.durationMinutes || 0,
            });
          }
        } else {
          setErrorMessage(data.error || "Failed to load hub details.");
        }
      })
      .catch((err) => {
        if (isMounted) setErrorMessage(err?.message || "Failed to load hub details.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Fetch campuses for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/campuses")
        .then((res) => res.json())
        .then((data) => {
          if (data.campuses) {
            setCampuses(data.campuses);
          }
        })
        .catch(console.error);
    }
  }, [isSuperAdmin]);

  // Intermediate Hub Management Helpers
  const handleAddIntermediateHub = () => {
    const nextIndex = intermediateHubs.length + 1;
    const newHub: IntermediateHub = {
      id: `hub-stop-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: `Intermediate Hub ${nextIndex}`,
      address: "",
      latitude: 0,
      longitude: 0,
    };
    setIntermediateHubs([...intermediateHubs, newHub]);
  };

  const handleRemoveIntermediateHub = (index: number) => {
    setIntermediateHubs((prev) => prev.filter((_, i) => i !== index));
    if (pickingTarget?.type === "intermediate" && pickingTarget.index === index) {
      setPickingTarget(null);
    }
  };

  const handleMoveIntermediateHub = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= intermediateHubs.length) return;
    const updated = [...intermediateHubs];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setIntermediateHubs(updated);
  };

  const handleUpdateIntermediateHub = (index: number, data: Partial<IntermediateHub>) => {
    setIntermediateHubs((prev) =>
      prev.map((h, i) => (i === index ? { ...h, ...data } : h))
    );
  };

  // Recalculate route whenever origin, intermediateHubs, or destination changes
  useEffect(() => {
    if (loading) return;

    const isOriginValid = isValidPoint(origin);
    const validIntermediates = intermediateHubs.filter(isValidPoint);
    const isDestValid = isValidPoint(destination);

    if (!isOriginValid && !isDestValid && validIntermediates.length === 0) {
      setCalculatedRoute(null);
      return;
    }

    const waypointsCount = (isOriginValid ? 1 : 0) + validIntermediates.length + (isDestValid ? 1 : 0);
    if (waypointsCount < 2) {
      setCalculatedRoute(null);
      return;
    }

    let isMounted = true;
    setIsCalculatingRoute(true);

    const computeCorridorRoute = async () => {
      try {
        let activeWaypoints: { latitude: number; longitude: number }[] = [];

        if (isOriginValid && isDestValid) {
          // 1. Calculate base highway corridor between Origin and Destination
          let baseHighway: RouteResult | null = null;
          try {
            baseHighway = await routingService.calculateRoute([
              { latitude: origin.latitude, longitude: origin.longitude },
              { latitude: destination.latitude, longitude: destination.longitude },
            ]);
          } catch (e) {
            console.warn("Base highway calculation failed in edit:", e);
          }

          // 2. If intermediate hubs exist, snap them to the base highway route polyline
          const snappedIntermediates = validIntermediates.map((hub) => {
            let lat = hub.latitude;
            let lng = hub.longitude;
            if (baseHighway?.coordinates && baseHighway.coordinates.length >= 2) {
              const snapped = snapPointToRoute(lat, lng, baseHighway.coordinates, 6.0);
              if (!snapped.isTooFar) {
                lat = snapped.snappedLatitude;
                lng = snapped.snappedLongitude;
              }
            }
            return { latitude: lat, longitude: lng };
          });

          activeWaypoints = [
            { latitude: origin.latitude, longitude: origin.longitude },
            ...snappedIntermediates,
            { latitude: destination.latitude, longitude: destination.longitude },
          ];
        } else {
          // Fallback if one end is missing
          if (isOriginValid) activeWaypoints.push({ latitude: origin.latitude, longitude: origin.longitude });
          validIntermediates.forEach((hub) => activeWaypoints.push({ latitude: hub.latitude, longitude: hub.longitude }));
          if (isDestValid) activeWaypoints.push({ latitude: destination.latitude, longitude: destination.longitude });
        }

        const res = await routingService.calculateRoute(activeWaypoints);
        if (isMounted && res) {
          setCalculatedRoute(res);
        }
      } catch (err) {
        console.warn("Hub route calculation failed:", err);
      } finally {
        if (isMounted) setIsCalculatingRoute(false);
      }
    };

    computeCorridorRoute();

    return () => {
      isMounted = false;
    };
  }, [origin, intermediateHubs, destination, loading]);

  const handleMapClick = (loc: { address: string; latitude: number; longitude: number }) => {
    if (!loc.latitude || !loc.longitude || Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) return;
    const areaName = loc.address.split(",")[0] || "Selected Point";

    if (!pickingTarget) return;

    if (pickingTarget.type === "origin") {
      const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, true, true);
      setOrigin({
        name: areaName,
        address: loc.address,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      setPickingTarget(null);
    } else if (pickingTarget.type === "destination") {
      const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, false, true);
      setDestination({
        name: areaName,
        address: loc.address,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      setPickingTarget(null);
    } else if (pickingTarget.type === "intermediate") {
      const idx = pickingTarget.index;
      const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, false, true);
      handleUpdateIntermediateHub(idx, {
        name: areaName,
        address: loc.address,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
      });
      setPickingTarget(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPoint(origin) || !isValidPoint(destination)) {
      setErrorMessage("Please select valid locations for both Origin and Destination.");
      return;
    }

    if (!name.trim()) {
      setErrorMessage("Please provide a name for the hub corridor.");
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const validIntermediatePoints = intermediateHubs
        .filter(isValidPoint)
        .map((h) => ({
          name: h.name.trim(),
          address: h.address || h.name,
          latitude: h.latitude,
          longitude: h.longitude,
        }));

      const autoCorridor =
        validIntermediatePoints.length > 0
          ? `${origin.name} → ${validIntermediatePoints.map((p) => p.name).join(" → ")} → ${destination.name}`
          : `${origin.name} → ${destination.name}`;

      const res = await fetch(`/api/commutehub/hubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          corridor: corridor.trim() || autoCorridor,
          origin,
          commonPoint: validIntermediatePoints[0] || null,
          intermediatePoints: validIntermediatePoints,
          destination,
          campusId: campusId ? campusId.toUpperCase().trim() : undefined,
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to update hub corridor.");
      }

      setSuccessMessage("Hub corridor updated successfully!");
      setTimeout(() => {
        router.push(`/admin/hubs/${id}`);
      }, 800);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred while updating hub.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOriginValid = isValidPoint(origin);
  const isDestValid = isValidPoint(destination);
  const validIntermediateList = intermediateHubs.filter(isValidPoint);

  // Dynamic legs info calculation
  const totalLegsCount = (isOriginValid ? 1 : 0) + validIntermediateList.length + (isDestValid ? 1 : 0) - 1;

  const getLegDistanceInfo = (legIndex: number): { distanceKm: number; durationMinutes: number } | null => {
    if (!calculatedRoute || totalLegsCount < 1) return null;
    if (calculatedRoute.legs && calculatedRoute.legs[legIndex]) {
      return calculatedRoute.legs[legIndex];
    }
    if (calculatedRoute.distanceKm > 0 && totalLegsCount > 0) {
      return {
        distanceKm: Math.round((calculatedRoute.distanceKm / totalLegsCount) * 10) / 10,
        durationMinutes: Math.max(1, Math.round(calculatedRoute.durationMinutes / totalLegsCount)),
      };
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Loading Hub Corridor..." />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* Compact Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Link href={`/admin/hubs/${id}`}>
            <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
                <Edit3 className="h-4 w-4 text-emerald-600" />
                Edit Commuting Hub
              </h1>
              {hubIdCode && (
                <Badge variant="outline" className="text-[10px] font-mono py-0 border-slate-200 text-slate-500">
                  {hubIdCode}
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Modify corridor route, origin, intermediate stops, destination, or status
            </p>
          </div>
        </div>

        {calculatedRoute && (
          <div className="flex flex-wrap items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200/80 rounded-xl px-3 py-1 text-xs">
            <span className="flex items-center gap-1 font-bold text-slate-900">
              <Route className="h-3.5 w-3.5 text-emerald-600" />
              {calculatedRoute.distanceKm} km
            </span>
            <span className="text-emerald-300">•</span>
            <span className="flex items-center gap-1 font-semibold text-emerald-800">
              <Clock className="h-3.5 w-3.5 text-emerald-600" />
              ~{calculatedRoute.durationMinutes} mins
            </span>
            {totalLegsCount > 1 && (
              <>
                <span className="text-emerald-300">•</span>
                <span className="text-[11px] text-emerald-700">
                  ({totalLegsCount} Route Legs)
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Single-Screen Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column: Compact Form Card */}
        <div className="lg:col-span-5 relative z-20">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-visible relative z-20">
            <CardHeader className="p-3.5 pb-2.5 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-emerald-600" />
                  Corridor Configuration
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Adjust endpoints and intermediate hub stops between route
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-2.5 text-xs">
              {/* Row 1: Hub Name & Corridor Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="hubName" className="text-[11px] font-semibold text-slate-700">
                    Hub Name <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="hubName"
                    type="text"
                    placeholder="e.g. Hub 1, Porur Fast Hub"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 rounded-xl text-xs h-8 border-slate-200 font-medium"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="corridor" className="text-[11px] font-semibold text-slate-700">
                    Corridor Label <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="corridor"
                    type="text"
                    placeholder="e.g. Poonamallee → Porur"
                    value={corridor}
                    onChange={(e) => setCorridor(e.target.value)}
                    className="mt-1 rounded-xl text-xs h-8 border-slate-200 font-medium"
                    required
                  />
                </div>
              </div>

              {/* Row 2: Campus & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-0.5">
                <div>
                  <Label htmlFor="campus" className="text-[11px] font-semibold text-slate-700">
                    Associated Campus <span className="text-rose-500">*</span>
                  </Label>
                  {isSuperAdmin && campuses.length > 0 ? (
                    <select
                      id="campus"
                      value={campusId}
                      onChange={(e) => setCampusId(e.target.value)}
                      className="mt-1 w-full text-xs font-medium px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 h-8 shadow-2xs focus:border-emerald-500 focus:outline-hidden"
                      required
                    >
                      {campuses.map((c) => (
                        <option key={c.campusId} value={c.campusId}>
                          {c.name} ({c.campusId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="mt-1 flex items-center gap-1.5 rounded-xl bg-slate-50 px-2.5 py-1 border border-slate-200 text-xs text-slate-700 font-medium h-8">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{campusId || session?.user?.campusName || "Campus"}</span>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Status
                  </Label>
                  <div className="mt-1 flex rounded-xl bg-slate-100 p-0.5 text-xs font-medium text-slate-600 h-8 items-center">
                    <button
                      type="button"
                      onClick={() => setStatus("active")}
                      className={`flex-1 rounded-lg py-1 transition-all text-center text-xs ${
                        status === "active"
                          ? "bg-white text-emerald-800 shadow-xs font-bold"
                          : "hover:text-slate-900"
                      }`}
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus("inactive")}
                      className={`flex-1 rounded-lg py-1 transition-all text-center text-xs ${
                        status === "inactive"
                          ? "bg-white text-slate-800 shadow-xs font-bold"
                          : "hover:text-slate-900"
                      }`}
                    >
                      Inactive
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 3: Origin Search */}
              <div className="border-t border-slate-100 pt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                    Origin / Starting Point <span className="text-rose-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickingTarget(pickingTarget?.type === "origin" ? null : { type: "origin" })}
                    className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                      pickingTarget?.type === "origin"
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget?.type === "origin" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={origin?.address || origin?.name || ""}
                  placeholder="Search origin (e.g. Poonamallee)..."
                  showCurrentLocation={false}
                  onChange={(loc) => {
                    if (!loc.address || !loc.address.trim()) {
                      setOrigin(null);
                      return;
                    }
                    if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                      return;
                    }
                    const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, true, true);
                    setOrigin({
                      name: loc.address.split(",")[0] || "Origin",
                      address: loc.address,
                      latitude: resolved.latitude,
                      longitude: resolved.longitude,
                    });
                  }}
                />
              </div>

              {/* Dynamic Intermediate Hubs Section */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    Intermediate Hubs (Between Route)
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-800 bg-amber-50 font-semibold">
                      {intermediateHubs.length}
                    </Badge>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddIntermediateHub}
                    className="text-[10px] h-6 px-2 rounded-lg border-emerald-300 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100 font-bold flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="h-3 w-3" />
                    Add Intermediate Hub
                  </Button>
                </div>

                {intermediateHubs.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-2.5 text-center text-slate-500 text-[11px]">
                    No intermediate hubs added. Click <strong className="text-emerald-700 font-semibold">&quot;Add Intermediate Hub&quot;</strong> to insert transit stops between Origin and Destination.
                  </div>
                )}

                {/* Render Each Intermediate Hub */}
                {intermediateHubs.map((hub, idx) => {
                  const legInfoBefore = getLegDistanceInfo(idx);
                  const isThisTarget = pickingTarget?.type === "intermediate" && pickingTarget.index === idx;

                  return (
                    <div key={hub.id} className="space-y-1.5">
                      {/* Leg Distance Connector from Previous Stop */}
                      {legInfoBefore && (
                        <div className="flex items-center justify-between px-2.5 py-1 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-950 text-[10.5px] font-medium shadow-2xs animate-in fade-in-50">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Navigation className="h-3 w-3 text-amber-600 shrink-0" />
                            <span className="truncate">
                              Leg {idx + 1}: {idx === 0 ? origin?.name || "Origin" : intermediateHubs[idx - 1]?.name || `Hub ${idx}`} → <strong>{hub.name}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 font-bold text-amber-800">
                            <span>{legInfoBefore.distanceKm} km</span>
                            <span className="text-amber-700 font-normal text-[10px]">(~{legInfoBefore.durationMinutes} mins)</span>
                          </div>
                        </div>
                      )}

                      {/* Intermediate Hub Card */}
                      <div className={`p-2 rounded-xl border ${isThisTarget ? "border-amber-400 bg-amber-50/40 ring-2 ring-amber-200" : "border-slate-200 bg-slate-50/40"} space-y-1.5 transition-all`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="h-4 w-4 rounded-full bg-amber-500 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 text-[11px]">
                              Intermediate Hub {idx + 1}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => handleMoveIntermediateHub(idx, "up")}
                                title="Move up"
                                className="p-0.5 text-slate-400 hover:text-slate-700 rounded-md"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {idx < intermediateHubs.length - 1 && (
                              <button
                                type="button"
                                onClick={() => handleMoveIntermediateHub(idx, "down")}
                                title="Move down"
                                className="p-0.5 text-slate-400 hover:text-slate-700 rounded-md"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setPickingTarget(isThisTarget ? null : { type: "intermediate", index: idx })}
                              className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                                isThisTarget
                                  ? "bg-amber-200 text-amber-900 font-bold"
                                  : "text-slate-500 hover:text-slate-800"
                              }`}
                            >
                              {isThisTarget ? "Cancel picking" : "Pick on map"}
                            </Button>
                            <button
                              type="button"
                              onClick={() => handleRemoveIntermediateHub(idx)}
                              title="Delete intermediate hub"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <LocationSearchInput
                          value={hub.address || hub.name || ""}
                          placeholder={`Search intermediate stop ${idx + 1} (e.g. Porur Toll Gate, Kathipara)...`}
                          showCurrentLocation={false}
                          onChange={(loc) => {
                            if (!loc.address || !loc.address.trim()) {
                              handleUpdateIntermediateHub(idx, {
                                name: `Intermediate Hub ${idx + 1}`,
                                address: "",
                                latitude: 0,
                                longitude: 0,
                              });
                              return;
                            }
                            if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                              return;
                            }
                            const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, false, true);
                            handleUpdateIntermediateHub(idx, {
                              name: loc.address.split(",")[0] || `Hub ${idx + 1}`,
                              address: loc.address,
                              latitude: resolved.latitude,
                              longitude: resolved.longitude,
                            });
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Leg Distance Connector from Last Intermediate Stop to Destination */}
              {intermediateHubs.length > 0 && isDestValid && destination && (
                (() => {
                  const lastLegIndex = intermediateHubs.length;
                  const lastLegInfo = getLegDistanceInfo(lastLegIndex);
                  if (!lastLegInfo) return null;
                  const lastHub = intermediateHubs[intermediateHubs.length - 1];

                  return (
                    <div className="flex items-center justify-between px-2.5 py-1 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-950 text-[10.5px] font-medium shadow-2xs animate-in fade-in-50">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Navigation className="h-3 w-3 text-amber-600 shrink-0" />
                        <span className="truncate">
                          Final Leg ({lastHub.name} → <strong>{destination.name}</strong>):
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 font-bold text-amber-800">
                        <span>{lastLegInfo.distanceKm} km</span>
                        <span className="text-amber-700 font-normal text-[10px]">(~{lastLegInfo.durationMinutes} mins)</span>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Direct Corridor Distance Badge if 0 intermediate hubs */}
              {intermediateHubs.length === 0 && isOriginValid && isDestValid && calculatedRoute && (
                <div className="flex items-center justify-between px-2.5 py-1 bg-blue-50/90 border border-blue-200/90 rounded-xl text-blue-950 text-[10.5px] font-medium shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="h-3 w-3 text-blue-600 shrink-0" />
                    <span className="truncate">Direct Corridor Distance ({origin?.name} → {destination?.name}):</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-blue-700">
                    <span>{calculatedRoute.distanceKm} km</span>
                    <span className="text-blue-600 font-normal text-[10px]">(~{calculatedRoute.durationMinutes} mins)</span>
                  </div>
                </div>
              )}

              {/* Row 4: Destination Search */}
              <div className="space-y-1 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-600 shrink-0" />
                    Destination Point <span className="text-rose-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickingTarget(pickingTarget?.type === "destination" ? null : { type: "destination" })}
                    className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                      pickingTarget?.type === "destination"
                        ? "bg-rose-100 text-rose-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget?.type === "destination" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={destination?.address || destination?.name || ""}
                  placeholder="Search destination (e.g. Porur, DLF IT Park)..."
                  showCurrentLocation={false}
                  onChange={(loc) => {
                    if (!loc.address || !loc.address.trim()) {
                      setDestination(null);
                      return;
                    }
                    if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                      return;
                    }
                    const resolved = resolvePlaceCoordinates(loc.address, loc.latitude, loc.longitude, false, true);
                    setDestination({
                      name: loc.address.split(",")[0] || "Destination",
                      address: loc.address,
                      latitude: resolved.latitude,
                      longitude: resolved.longitude,
                    });
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2">
                <Link href={`/admin/hubs/${id}`} className="w-1/3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl border-slate-200 text-slate-700 font-semibold h-9 text-xs"
                  >
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isOriginValid || !isDestValid || !name.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-9 shadow-sm text-xs"
                >
                  {isSubmitting ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Map Preview */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
            <CardHeader className="p-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Route className="h-3.5 w-3.5 text-emerald-600" />
                  Corridor Map Preview
                </CardTitle>
                <CardDescription className="text-[10px] text-slate-500">
                  {pickingTarget
                    ? pickingTarget.type === "origin"
                      ? "Click map to set Origin"
                      : pickingTarget.type === "destination"
                      ? "Click map to set Destination"
                      : `Click map to set Intermediate Hub ${pickingTarget.index + 1}`
                    : calculatedRoute
                    ? `Total: ${calculatedRoute.distanceKm} km • ${intermediateHubs.length} intermediate stops connecting corridor`
                    : "Live preview of road route connecting corridor stops"}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                {isCalculatingRoute && (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 animate-pulse">
                    Calculating route...
                  </Badge>
                )}
                {calculatedRoute && (
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-slate-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                      <Route className="h-3 w-3 text-emerald-400" />
                      {calculatedRoute.distanceKm} km
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
                      ~{calculatedRoute.durationMinutes} mins
                    </Badge>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 relative">
              <LeafletRouteMap
                startLocation={
                  isOriginValid && origin
                    ? {
                        name: origin.name,
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                      }
                    : null
                }
                destination={
                  isDestValid && destination
                    ? {
                        name: destination.name,
                        latitude: destination.latitude,
                        longitude: destination.longitude,
                      }
                    : null
                }
                stops={intermediateHubs
                  .filter(isValidPoint)
                  .map((h, i) => ({
                    name: h.name,
                    address: h.address,
                    latitude: h.latitude,
                    longitude: h.longitude,
                  }))}
                routeCoordinates={calculatedRoute?.coordinates || []}
                distanceText={calculatedRoute ? `${calculatedRoute.distanceKm} km` : undefined}
                durationText={calculatedRoute ? `~${calculatedRoute.durationMinutes} mins` : undefined}
                isClickPicking={Boolean(pickingTarget)}
                clickPickLabel={
                  pickingTarget?.type === "origin"
                    ? "Click map to set ORIGIN"
                    : pickingTarget?.type === "destination"
                    ? "Click map to set DESTINATION"
                    : pickingTarget?.type === "intermediate"
                    ? `Click map to set INTERMEDIATE HUB ${pickingTarget.index + 1}`
                    : undefined
                }
                onMapClick={handleMapClick}
                height="540px"
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
