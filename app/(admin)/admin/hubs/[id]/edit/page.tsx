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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import LocationSearchInput from "@/components/map/LocationSearchInput";
import { routingService, RouteResult } from "@/lib/services/routing";
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
    Math.abs(p.longitude) > 0.01 &&
    p.address &&
    p.address.trim().length > 0
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
  const [commonPoint, setCommonPoint] = useState<{
    name: string;
    address: string;
    latitude: number;
    longitude: number;
  } | null>(null);
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
  const [pickingTarget, setPickingTarget] = useState<"origin" | "commonPoint" | "destination" | null>(null);

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
          setCommonPoint(h.commonPoint || null);
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

  // Recalculate route whenever origin, commonPoint, or destination changes
  useEffect(() => {
    if (loading) return;

    const isOriginValid = isValidPoint(origin);
    const isCommonValid = isValidPoint(commonPoint);
    const isDestValid = isValidPoint(destination);

    const activeWaypoints: { latitude: number; longitude: number }[] = [];
    if (isOriginValid) activeWaypoints.push({ latitude: origin.latitude, longitude: origin.longitude });
    if (isCommonValid) activeWaypoints.push({ latitude: commonPoint.latitude, longitude: commonPoint.longitude });
    if (isDestValid) activeWaypoints.push({ latitude: destination.latitude, longitude: destination.longitude });

    if (activeWaypoints.length < 2) {
      setCalculatedRoute(null);
      return;
    }

    let isMounted = true;
    setIsCalculatingRoute(true);

    routingService
      .calculateRoute(activeWaypoints)
      .then((res) => {
        if (isMounted && res) {
          setCalculatedRoute(res);
        }
      })
      .catch((err) => {
        console.warn("Hub route calculation failed:", err);
      })
      .finally(() => {
        if (isMounted) setIsCalculatingRoute(false);
      });

    return () => {
      isMounted = false;
    };
  }, [origin, commonPoint, destination, loading]);

  const handleMapClick = (loc: { address: string; latitude: number; longitude: number }) => {
    if (!loc.latitude || !loc.longitude || Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) return;
    const areaName = loc.address.split(",")[0] || "Selected Point";
    if (pickingTarget === "origin") {
      setOrigin({
        name: areaName,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setPickingTarget(null);
    } else if (pickingTarget === "commonPoint") {
      setCommonPoint({
        name: areaName,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
      });
      setPickingTarget(null);
    } else if (pickingTarget === "destination") {
      setDestination({
        name: areaName,
        address: loc.address,
        latitude: loc.latitude,
        longitude: loc.longitude,
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

      const validCommonPoint = isValidPoint(commonPoint) ? commonPoint : null;

      const res = await fetch(`/api/commutehub/hubs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          corridor:
            corridor.trim() ||
            (validCommonPoint
              ? `${origin.name} → ${validCommonPoint.name} → ${destination.name}`
              : `${origin.name} → ${destination.name}`),
          origin,
          commonPoint: validCommonPoint,
          destination,
          campusId: campusId.toUpperCase().trim(),
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
  const isCommonValid = isValidPoint(commonPoint);
  const isDestValid = isValidPoint(destination);

  // Segment distance calculations between consecutive stops
  let leg1Info: { distanceKm: number; durationMinutes: number } | null = null;
  let leg2Info: { distanceKm: number; durationMinutes: number } | null = null;
  let directInfo: { distanceKm: number; durationMinutes: number } | null = null;

  if (calculatedRoute) {
    if (isOriginValid && isCommonValid && isDestValid) {
      if (calculatedRoute.legs && calculatedRoute.legs.length >= 2) {
        leg1Info = calculatedRoute.legs[0];
        leg2Info = calculatedRoute.legs[1];
      } else {
        leg1Info = {
          distanceKm: Math.round(calculatedRoute.distanceKm * 0.55 * 10) / 10,
          durationMinutes: Math.max(1, Math.round(calculatedRoute.durationMinutes * 0.55)),
        };
        leg2Info = {
          distanceKm: Math.round((calculatedRoute.distanceKm - leg1Info.distanceKm) * 10) / 10,
          durationMinutes: Math.max(1, calculatedRoute.durationMinutes - leg1Info.durationMinutes),
        };
      }
    } else if (isOriginValid && isCommonValid && !isDestValid) {
      leg1Info = {
        distanceKm: calculatedRoute.distanceKm,
        durationMinutes: calculatedRoute.durationMinutes,
      };
    } else if (!isOriginValid && isCommonValid && isDestValid) {
      leg2Info = {
        distanceKm: calculatedRoute.distanceKm,
        durationMinutes: calculatedRoute.durationMinutes,
      };
    } else if (isOriginValid && !isCommonValid && isDestValid) {
      directInfo = {
        distanceKm: calculatedRoute.distanceKm,
        durationMinutes: calculatedRoute.durationMinutes,
      };
    }
  }

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
              Modify corridor route, origin, common meeting point, destination, or status
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
            {leg1Info && leg2Info && (
              <>
                <span className="text-emerald-300">•</span>
                <span className="text-[11px] text-emerald-700">
                  (Leg 1: <strong>{leg1Info.distanceKm} km</strong>, Leg 2: <strong>{leg2Info.distanceKm} km</strong>)
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
                  Adjust corridor endpoints and common intermediate stop
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-3.5 space-y-2 text-xs">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center pt-1">
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
                    onClick={() => setPickingTarget(pickingTarget === "origin" ? null : "origin")}
                    className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                      pickingTarget === "origin"
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget === "origin" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={origin?.address || origin?.name || ""}
                  placeholder="Search origin (e.g. Poonamallee)..."
                  onChange={(loc) => {
                    if (!loc.address || !loc.address.trim()) {
                      setOrigin(null);
                      return;
                    }
                    if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                      return;
                    }
                    setOrigin({
                      name: loc.address.split(",")[0] || "Origin",
                      address: loc.address,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    });
                  }}
                />
              </div>

              {/* Distance Connector: Origin -> Common Point */}
              {leg1Info && (
                <div className="flex items-center justify-between px-3 py-1 bg-emerald-50/90 border border-emerald-200/90 rounded-xl text-emerald-900 text-[11px] font-medium shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      Distance to Common Point (<strong>{commonPoint?.name}</strong>):
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-emerald-700">
                    <span>{leg1Info.distanceKm} km</span>
                    <span className="text-emerald-600 font-normal text-[10px]">(~{leg1Info.durationMinutes} mins)</span>
                  </div>
                </div>
              )}

              {/* Row 4: Common Point Hub (Intermediate Meeting Point between Origin & Destination) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                    Common Point Hub (Intermediate Corridor Stop)
                  </Label>
                  <div className="flex items-center gap-1">
                    {commonPoint && (
                      <button
                        type="button"
                        onClick={() => setCommonPoint(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-700 px-1"
                      >
                        Clear
                      </button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPickingTarget(pickingTarget === "commonPoint" ? null : "commonPoint")}
                      className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                        pickingTarget === "commonPoint"
                          ? "bg-amber-100 text-amber-800"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {pickingTarget === "commonPoint" ? "Cancel picking" : "Pick on map"}
                    </Button>
                  </div>
                </div>
                <LocationSearchInput
                  value={commonPoint?.address || commonPoint?.name || ""}
                  placeholder="Assign common hub stop (e.g. Maduravoyal, Kattupakkam)..."
                  onChange={(loc) => {
                    if (!loc.address || !loc.address.trim()) {
                      setCommonPoint(null);
                      return;
                    }
                    if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                      return;
                    }
                    setCommonPoint({
                      name: loc.address.split(",")[0] || "Common Point Hub",
                      address: loc.address,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    });
                  }}
                />
              </div>

              {/* Distance Connector: Common Point -> Destination */}
              {leg2Info && (
                <div className="flex items-center justify-between px-3 py-1 bg-amber-50/90 border border-amber-200/90 rounded-xl text-amber-950 text-[11px] font-medium shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="h-3 w-3 text-amber-600 shrink-0" />
                    <span className="truncate">
                      Distance to Destination (<strong>{destination?.name}</strong>):
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-amber-800">
                    <span>{leg2Info.distanceKm} km</span>
                    <span className="text-amber-700 font-normal text-[10px]">(~{leg2Info.durationMinutes} mins)</span>
                  </div>
                </div>
              )}

              {/* Row 5: Destination Search */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-600 shrink-0" />
                    Destination Point <span className="text-rose-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickingTarget(pickingTarget === "destination" ? null : "destination")}
                    className={`text-[10px] h-5 px-1.5 rounded-md font-semibold ${
                      pickingTarget === "destination"
                        ? "bg-rose-100 text-rose-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget === "destination" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={destination?.address || destination?.name || ""}
                  placeholder="Search destination (e.g. Porur, DLF IT Park)..."
                  onChange={(loc) => {
                    if (!loc.address || !loc.address.trim()) {
                      setDestination(null);
                      return;
                    }
                    if (Math.abs(loc.latitude) < 0.01 || Math.abs(loc.longitude) < 0.01) {
                      return;
                    }
                    setDestination({
                      name: loc.address.split(",")[0] || "Destination",
                      address: loc.address,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    });
                  }}
                />
              </div>

              {/* Distance Connector: Direct Corridor */}
              {directInfo && (
                <div className="flex items-center justify-between px-3 py-1 bg-blue-50/90 border border-blue-200/90 rounded-xl text-blue-950 text-[11px] font-medium shadow-2xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Navigation className="h-3 w-3 text-blue-600 shrink-0" />
                    <span className="truncate">Direct Corridor Distance:</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 font-bold text-blue-700">
                    <span>{directInfo.distanceKm} km</span>
                    <span className="text-blue-600 font-normal text-[10px]">(~{directInfo.durationMinutes} mins)</span>
                  </div>
                </div>
              )}

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
                    ? `Click map to set ${pickingTarget.toUpperCase()}`
                    : isOriginValid && isCommonValid && isDestValid && leg1Info && leg2Info
                    ? `Total: ${calculatedRoute?.distanceKm} km • Leg 1 (${origin?.name} → ${commonPoint?.name}): ${leg1Info.distanceKm} km • Leg 2 (${commonPoint?.name} → ${destination?.name}): ${leg2Info.distanceKm} km`
                    : isOriginValid && isCommonValid
                    ? `Route: ${origin?.name} → ${commonPoint?.name} • ${leg1Info?.distanceKm || calculatedRoute?.distanceKm} km (~${leg1Info?.durationMinutes || calculatedRoute?.durationMinutes} mins)`
                    : isOriginValid && isDestValid
                    ? `Route: ${origin?.name} → ${destination?.name} • ${calculatedRoute?.distanceKm} km (~${calculatedRoute?.durationMinutes} mins)`
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
                  isOriginValid
                    ? {
                        name: origin.name,
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                      }
                    : isCommonValid
                    ? {
                        name: commonPoint.name,
                        latitude: commonPoint.latitude,
                        longitude: commonPoint.longitude,
                      }
                    : null
                }
                destination={
                  isDestValid
                    ? {
                        name: destination.name,
                        latitude: destination.latitude,
                        longitude: destination.longitude,
                      }
                    : null
                }
                stops={
                  isCommonValid
                    ? [
                        {
                          name: commonPoint.name,
                          address: commonPoint.address,
                          latitude: commonPoint.latitude,
                          longitude: commonPoint.longitude,
                        },
                      ]
                    : []
                }
                routeCoordinates={calculatedRoute?.coordinates || []}
                distanceText={calculatedRoute ? `${calculatedRoute.distanceKm} km` : undefined}
                durationText={calculatedRoute ? `~${calculatedRoute.durationMinutes} mins` : undefined}
                isClickPicking={Boolean(pickingTarget)}
                clickPickLabel={
                  pickingTarget ? `Click map to set ${pickingTarget.toUpperCase()}` : undefined
                }
                onMapClick={handleMapClick}
                height="500px"
              />
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
