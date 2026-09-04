"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Route,
  MapPin,
  Clock,
  Car,
  Users,
  ArrowLeft,
  Building2,
  CheckCircle2,
  XCircle,
  Power,
  Trash2,
  Calendar,
  IndianRupee,
  Phone,
  Mail,
  Shield,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CarLoader } from "@/components/common/CarLoader";

const LeafletRouteMap = dynamic(
  () => import("@/components/map/LeafletRouteMap"),
  { ssr: false }
);

interface IHubDetail {
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
  activeRidesCount: number;
  employeesUsingHubCount: number;
  rides: any[];
  createdAt: string;
}

export default function HubDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const id = params?.id as string;

  const [hub, setHub] = useState<IHubDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchHubDetails();
  }, [id]);

  const fetchHubDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/commutehub/hubs/${id}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load hub details.");
      }

      setHub(data.hub);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load hub details.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!hub) return;
    const newStatus = hub.status === "active" ? "inactive" : "active";

    try {
      setIsTogglingStatus(true);
      const res = await fetch(`/api/commutehub/hubs/${hub._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to update hub status.");
        return;
      }

      setHub((prev) => (prev ? { ...prev, status: newStatus } : null));
    } catch (err: any) {
      alert(err?.message || "Failed to toggle hub status.");
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleDeleteHub = async () => {
    if (!hub) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete hub "${hub.name}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);
      const res = await fetch(`/api/commutehub/hubs/${hub._id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete hub corridor.");
        return;
      }

      router.push("/admin/hubs");
    } catch (err: any) {
      alert(err?.message || "Failed to delete hub.");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Loading Hub Details..." />
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-6 text-center text-xs">
          <p className="font-semibold text-red-700">{error || "Hub not found."}</p>
          <div className="mt-4">
            <Link href="/admin/hubs">
              <Button variant="outline" size="sm" className="rounded-xl text-xs">
                &larr; Back to Hub Directory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Link href="/admin/hubs">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0 text-slate-600 hover:text-slate-900 rounded-xl text-xs">
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <span className="text-slate-300">/</span>
            <Badge variant="outline" className="font-mono text-[9px]">
              {hub.hubId}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-base font-bold tracking-tight text-slate-900 leading-tight">
              {hub.name}
            </h1>
            <Badge
              className={
                hub.status === "active"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                  : "bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
              }
              variant="outline"
            >
              {hub.status === "active" ? (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Active Corridor
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-slate-500" />
                  Inactive
                </span>
              )}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <span>{hub.campusName}</span>
            <span>•</span>
            <span>Created {new Date(hub.createdAt).toLocaleDateString()}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleStatus}
            disabled={isTogglingStatus}
            className="rounded-xl text-xs gap-1.5 border-slate-200 hover:bg-slate-50"
          >
            <Power className="h-3.5 w-3.5 text-slate-600" />
            {isTogglingStatus ? "Updating..." : hub.status === "active" ? "Deactivate Corridor" : "Activate Corridor"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteHub}
            disabled={isDeleting}
            className="rounded-xl text-xs gap-1.5 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      {/* Corridor Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Route className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Corridor Route</p>
              <h4 className="text-xs font-bold text-slate-900">{hub.corridor}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Distance & Time</p>
              <h4 className="text-xs font-bold text-slate-900">
                {hub.distanceKm} km (~{hub.durationMinutes} mins)
              </h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Car className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Active Scheduled Rides</p>
              <h4 className="text-xs font-bold text-slate-900">{hub.activeRidesCount || 0} Rides</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500">Commuters Participating</p>
              <h4 className="text-xs font-bold text-slate-900">
                {hub.employeesUsingHubCount || 0} Employees
              </h4>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map & Corridor Points Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 cols: Interactive Corridor Leaflet Map */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Route className="h-4 w-4 text-emerald-600" />
                  Corridor Route Geometry
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Calculated turn-by-turn road route connecting origin to destination
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] text-slate-600">
                {hub.distanceKm} km
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              <LeafletRouteMap
                startLocation={{
                  name: hub.origin.name,
                  address: hub.origin.address,
                  latitude: hub.origin.latitude,
                  longitude: hub.origin.longitude,
                }}
                destination={{
                  name: hub.destination.name,
                  address: hub.destination.address,
                  latitude: hub.destination.latitude,
                  longitude: hub.destination.longitude,
                }}
                routeCoordinates={hub.routeCoordinates || []}
                distanceText={`${hub.distanceKm} km`}
                durationText={`~${hub.durationMinutes} mins`}
                height="420px"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right 5 cols: Origin & Destination Points Breakdown */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Origin Point
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Name</span>
                <p className="font-semibold text-slate-900">{hub.origin.name}</p>
              </div>
              {hub.origin.address && (
                <div>
                  <span className="text-slate-400 text-[10px] block">Full Address</span>
                  <p className="text-slate-600 text-[11px]">{hub.origin.address}</p>
                </div>
              )}
              <div>
                <span className="text-slate-400 text-[10px] block">Coordinates</span>
                <p className="font-mono text-[11px] text-slate-500">
                  {hub.origin.latitude.toFixed(5)}, {hub.origin.longitude.toFixed(5)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-red-600" />
                Destination Point
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] block">Name</span>
                <p className="font-semibold text-slate-900">{hub.destination.name}</p>
              </div>
              {hub.destination.address && (
                <div>
                  <span className="text-slate-400 text-[10px] block">Full Address</span>
                  <p className="text-slate-600 text-[11px]">{hub.destination.address}</p>
                </div>
              )}
              <div>
                <span className="text-slate-400 text-[10px] block">Coordinates</span>
                <p className="font-mono text-[11px] text-slate-500">
                  {hub.destination.latitude.toFixed(5)}, {hub.destination.longitude.toFixed(5)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rides Under This Hub Section */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Car className="h-4 w-4 text-slate-700" />
              Active Corridor Rides ({hub.rides?.length || 0})
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-500">
              Scheduled rides operating specifically along this hub corridor
            </CardDescription>
          </div>

          <Link href="/admin/hubs/rides">
            <Button variant="outline" size="sm" className="rounded-xl text-xs">
              View All Hub Rides
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="p-0">
          {!hub.rides || hub.rides.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No scheduled rides yet under this hub</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Employees can offer rides along this corridor using the CommuteHub Employee mode.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {hub.rides.map((ride: any) => (
                <div key={ride._id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
                      {ride.driver?.name?.charAt(0) || "D"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">
                          {ride.driver?.name || "Corporate Driver"}
                        </span>
                        {ride.driver?.department && (
                          <Badge variant="outline" className="text-[10px] text-slate-600">
                            {ride.driver.department}
                          </Badge>
                        )}
                        <Badge
                          className={
                            ride.status === "scheduled"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                          }
                          variant="outline"
                        >
                          {ride.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {ride.departureDate} at {ride.departureTime}
                        </span>
                        <span>•</span>
                        <span>
                          {ride.vehicle?.vehicleModel || "Car"} ({ride.vehicle?.registrationNumber || "Corporate"})
                        </span>
                        <span>•</span>
                        <span className="font-medium text-slate-700">
                          {ride.availableSeats} of {ride.totalSeats} seats open
                        </span>
                        {ride.pricePerSeat > 0 && (
                          <>
                            <span>•</span>
                            <span className="font-bold text-slate-900 flex items-center">
                              <IndianRupee className="h-3 w-3" />
                              {ride.pricePerSeat}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                      {ride.requests?.length || 0} bookings
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
