"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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

export default function CreateHubPage() {
  const router = useRouter();
  const { data: session } = useSession();

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const [name, setName] = useState("");
  const [corridor, setCorridor] = useState("");
  const [origin, setOrigin] = useState<{
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

  const [campusId, setCampusId] = useState("");
  const [campuses, setCampuses] = useState<ICampusOption[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  // Route calculation state
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [calculatedRoute, setCalculatedRoute] = useState<RouteResult | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Map picking mode
  const [pickingTarget, setPickingTarget] = useState<"origin" | "destination" | null>(null);

  // Fetch campuses for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      fetch("/api/admin/campuses")
        .then((res) => res.json())
        .then((data) => {
          if (data.campuses) {
            setCampuses(data.campuses);
            if (data.campuses.length > 0) {
              setCampusId(data.campuses[0].campusId);
            }
          }
        })
        .catch(console.error);
    } else if (session?.user?.campusId) {
      setCampusId(session.user.campusId);
    }
  }, [isSuperAdmin, session]);

  // Recalculate route whenever origin or destination changes
  useEffect(() => {
    if (!origin || !destination) {
      setCalculatedRoute(null);
      return;
    }

    if (
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001
    ) {
      setCalculatedRoute(null);
      return;
    }

    let isMounted = true;
    setIsCalculatingRoute(true);

    routingService
      .calculateRoute([
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude },
      ])
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

    // Auto-fill corridor label if not manually changed
    if (!corridor || corridor.includes("→")) {
      setCorridor(`${origin.name} → ${destination.name}`);
    }

    return () => {
      isMounted = false;
    };
  }, [origin, destination]);

  // Handle map click picking
  const handleMapClick = (location: { address: string; latitude: number; longitude: number }) => {
    const locObj = {
      name: location.address.split(",")[0] || "Selected Location",
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
    };

    if (pickingTarget === "origin") {
      setOrigin(locObj);
      setPickingTarget(null);
    } else if (pickingTarget === "destination") {
      setDestination(locObj);
      setPickingTarget(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please provide a Hub Name (e.g. 'Hub 1').");
      return;
    }

    if (!origin) {
      setErrorMessage("Please select a valid origin for this commuting corridor.");
      return;
    }

    if (!destination) {
      setErrorMessage("Please select a valid destination for this commuting corridor.");
      return;
    }

    if (
      Math.abs(origin.latitude - destination.latitude) < 0.0001 &&
      Math.abs(origin.longitude - destination.longitude) < 0.0001
    ) {
      setErrorMessage("Origin and Destination cannot be at the exact same location.");
      return;
    }

    if (!campusId) {
      setErrorMessage("Please select or assign a campus.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/commutehub/hubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          corridor: corridor.trim() || `${origin.name} → ${destination.name}`,
          origin,
          destination,
          campusId: campusId.toUpperCase().trim(),
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create hub.");
      }

      router.push("/admin/hubs");
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Link href="/admin/hubs">
            <Button variant="outline" size="sm" className="rounded-xl h-9 w-9 p-0 border-slate-200 text-slate-600">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Compass className="h-6 w-6 text-emerald-600" />
              Create Commuting Hub
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Define a new fixed-route corridor hub for employees to share rides.
            </p>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-xs font-semibold text-rose-800 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form Fields */}
        <div className="lg:col-span-5 space-y-5">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-500" />
                Hub Information
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Identify the hub and its associated corridor
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Hub Name */}
              <div className="space-y-1.5">
                <Label htmlFor="hubName" className="text-xs font-semibold text-slate-700">
                  Hub Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="hubName"
                  type="text"
                  placeholder="e.g. Hub 1, Hub 2, Tambaram Fast Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl text-xs h-9 border-slate-200 font-medium"
                  required
                />
              </div>

              {/* Corridor Label */}
              <div className="space-y-1.5">
                <Label htmlFor="corridor" className="text-xs font-semibold text-slate-700">
                  Corridor Label <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="corridor"
                  type="text"
                  placeholder="e.g. Poonamallee → Porur"
                  value={corridor}
                  onChange={(e) => setCorridor(e.target.value)}
                  className="rounded-xl text-xs h-9 border-slate-200 font-medium"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Visible to employees when selecting rides along this corridor.
                </p>
              </div>

              {/* Campus Selector */}
              <div className="space-y-1.5">
                <Label htmlFor="campus" className="text-xs font-semibold text-slate-700">
                  Associated Campus <span className="text-rose-500">*</span>
                </Label>
                {isSuperAdmin ? (
                  <select
                    id="campus"
                    value={campusId}
                    onChange={(e) => setCampusId(e.target.value)}
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 h-9"
                    required
                  >
                    {campuses.map((c) => (
                      <option key={c.campusId} value={c.campusId}>
                        {c.name} ({c.campusId})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200 text-xs text-slate-700 font-medium">
                    <Building2 className="h-4 w-4 text-slate-400" />
                    <span>{session?.user?.campusName || "Your Campus"}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {session?.user?.campusId}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Initial Status
                </Label>
                <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
                  <button
                    type="button"
                    onClick={() => setStatus("active")}
                    className={`flex-1 rounded-lg py-1.5 transition-all text-center ${
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
                    className={`flex-1 rounded-lg py-1.5 transition-all text-center ${
                      status === "inactive"
                        ? "bg-white text-slate-800 shadow-xs font-bold"
                        : "hover:text-slate-900"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Selectors Card */}
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Origin & Destination
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Search locations or click on the map to pick coordinates
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              {/* Origin Search */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600" />
                    Origin / Starting Point <span className="text-rose-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickingTarget(pickingTarget === "origin" ? null : "origin")}
                    className={`text-[11px] h-6 px-2 rounded-lg font-semibold ${
                      pickingTarget === "origin"
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget === "origin" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={origin?.address || ""}
                  placeholder="Search starting area (e.g. Poonamallee)..."
                  onChange={(loc) =>
                    setOrigin({
                      name: loc.address.split(",")[0] || "Origin",
                      address: loc.address,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    })
                  }
                />
              </div>

              {/* Destination Search */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    Destination Point <span className="text-rose-500">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPickingTarget(pickingTarget === "destination" ? null : "destination")}
                    className={`text-[11px] h-6 px-2 rounded-lg font-semibold ${
                      pickingTarget === "destination"
                        ? "bg-rose-100 text-rose-800"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {pickingTarget === "destination" ? "Cancel picking" : "Pick on map"}
                  </Button>
                </div>
                <LocationSearchInput
                  value={destination?.address || ""}
                  placeholder="Search destination (e.g. Porur, DLF IT Park)..."
                  onChange={(loc) =>
                    setDestination({
                      name: loc.address.split(",")[0] || "Destination",
                      address: loc.address,
                      latitude: loc.latitude,
                      longitude: loc.longitude,
                    })
                  }
                />
              </div>

              {/* Calculated Stats Ribbon */}
              {calculatedRoute && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-emerald-600" />
                    <span className="text-slate-600">Distance:</span>
                    <strong className="text-slate-900 font-bold">{calculatedRoute.distanceKm} km</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-indigo-600" />
                    <span className="text-slate-600">Est. Time:</span>
                    <strong className="text-slate-900 font-bold">~{calculatedRoute.durationMinutes} mins</strong>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isSubmitting || !origin || !destination || !name}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold py-2.5 shadow-sm text-xs"
          >
            {isSubmitting ? "Creating Hub Corridor..." : "Create Hub"}
          </Button>
        </div>

        {/* Right Column: Interactive Map Preview */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden sticky top-24">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Route className="h-4 w-4 text-emerald-600" />
                  Corridor Map Preview
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  {pickingTarget
                    ? `Click anywhere on the map to set ${pickingTarget}`
                    : "Live preview of the corridor connecting origin to destination"}
                </CardDescription>
              </div>

              {isCalculatingRoute && (
                <Badge variant="outline" className="text-[10px] text-emerald-700 animate-pulse gap-1">
                  Calculating route...
                </Badge>
              )}
            </CardHeader>

            <CardContent className="p-0 relative">
              <LeafletRouteMap
                startLocation={
                  origin
                    ? {
                        name: origin.name,
                        latitude: origin.latitude,
                        longitude: origin.longitude,
                      }
                    : null
                }
                destination={
                  destination
                    ? {
                        name: destination.name,
                        latitude: destination.latitude,
                        longitude: destination.longitude,
                      }
                    : null
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
