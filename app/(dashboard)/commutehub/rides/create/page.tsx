"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Route,
  Car,
  Calendar,
  Clock,
  IndianRupee,
  Users,
  MapPin,
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Plus,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarLoader } from "@/components/common/CarLoader";

const LeafletRouteMap = dynamic(
  () => import("@/components/map/LeafletRouteMap"),
  { ssr: false }
);

function CreateHubRideContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const urlHubId = searchParams.get("hubId") || "";

  const [hubs, setHubs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>(urlHubId);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const [departureDate, setDepartureDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [departureTime, setDepartureTime] = useState<string>("08:30");
  const [availableSeats, setAvailableSeats] = useState<number>(3);
  const [basePrice, setBasePrice] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);

      // Fetch active hubs
      const hubsRes = await fetch("/api/commutehub/hubs");
      const hubsData = await hubsRes.json();
      if (hubsData.success && hubsData.hubs) {
        setHubs(hubsData.hubs);

        if (urlHubId) {
          const matched = hubsData.hubs.find(
            (h: any) => h._id === urlHubId || h.hubId === urlHubId
          );
          if (matched) setSelectedHubId(matched._id);
        } else if (hubsData.hubs.length > 0) {
          setSelectedHubId(hubsData.hubs[0]._id);
        }
      }

      // Fetch user's registered vehicles
      const vehRes = await fetch("/api/vehicles");
      const vehData = await vehRes.json();
      if (vehData.success && vehData.vehicles) {
        setVehicles(vehData.vehicles);
        if (vehData.vehicles.length > 0) {
          setSelectedVehicleId(vehData.vehicles[0]._id);
          if (vehData.vehicles[0].seatingCapacity) {
            setAvailableSeats(Math.max(1, vehData.vehicles[0].seatingCapacity - 1));
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to load setup data.");
    } finally {
      setLoading(false);
    }
  };

  const selectedHub = hubs.find(
    (h) => h._id === selectedHubId || h.hubId === selectedHubId
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHubId) {
      setErrorMsg("Please select a commuting corridor.");
      return;
    }

    if (!selectedVehicleId) {
      setErrorMsg("Please select a registered vehicle to offer this ride.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const payload = {
        hubId: selectedHubId,
        vehicleId: selectedVehicleId,
        departureDate,
        departureTime,
        availableSeats: Number(availableSeats),
        basePrice: Number(basePrice) || 0,
        notes,
      };

      const res = await fetch("/api/commutehub/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create corridor ride.");
      }

      router.push("/commutehub/my-rides");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to offer corridor ride.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Loading Corridor Ride Setup..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Link href="/commutehub">
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-600 hover:text-slate-900 rounded-xl text-xs px-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Car className="h-6 w-6 text-emerald-600" />
          Offer a Ride Under a Corridor Hub
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Share your commute along an established corporate corridor and pick up colleagues on the way
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 7 cols */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900">
                Corridor & Schedule Details
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Choose the fixed route you will be driving
              </CardDescription>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Corridor Hub Select */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Select Virtual Corridor Hub *
                </Label>
                <select
                  value={selectedHubId}
                  onChange={(e) => setSelectedHubId(e.target.value)}
                  className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-medium shadow-xs focus:border-emerald-500 focus:outline-hidden"
                  required
                >
                  {hubs.map((hub) => (
                    <option key={hub._id} value={hub._id}>
                      {hub.name} ({hub.origin.name} &rarr; {hub.destination.name}) • {hub.distanceKm} km
                    </option>
                  ))}
                </select>
              </div>

              {/* Locked Origin & Destination summary */}
              {selectedHub && (
                <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Corridor Route (Fixed by Admin):</span>
                    <span className="font-semibold text-slate-900">{selectedHub.distanceKm} km</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                    <span>{selectedHub.origin.name}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="h-2.5 w-2.5 rounded-full bg-red-600 shrink-0"></span>
                    <span>{selectedHub.destination.name}</span>
                  </div>
                </div>
              )}

              {/* Vehicle Select */}
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700">
                    Select Your Vehicle *
                  </Label>
                  <Link href="/vehicles" className="text-[11px] text-emerald-600 hover:underline">
                    Manage Vehicles
                  </Link>
                </div>

                {vehicles.length === 0 ? (
                  <div className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>No active vehicles registered.</span>
                    </div>
                    <Link href="/vehicles">
                      <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-lg bg-white">
                        Add Vehicle
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="mt-1.5 w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-medium shadow-xs focus:border-emerald-500 focus:outline-hidden"
                    required
                  >
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.vehicleModel} ({v.registrationNumber}) • {v.vehicleType} • {v.seatingCapacity} seats
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Departure Date *
                  </Label>
                  <Input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="mt-1.5 h-10 rounded-xl text-xs border-slate-200"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Departure Time *
                  </Label>
                  <Input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="mt-1.5 h-10 rounded-xl text-xs border-slate-200"
                    required
                  />
                </div>
              </div>

              {/* Seats & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Available Seats *
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={availableSeats}
                    onChange={(e) => setAvailableSeats(Number(e.target.value))}
                    className="mt-1.5 h-10 rounded-xl text-xs border-slate-200"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Price per Seat (₹)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0 (Free Carpool)"
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="mt-1.5 h-10 rounded-xl text-xs border-slate-200"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Set 0 for free corporate carpool
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Notes for Passengers (Optional)
                </Label>
                <Input
                  type="text"
                  placeholder="e.g., Leaving on time, AC car, drop at IT Park gate..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1.5 h-10 rounded-xl text-xs border-slate-200"
                />
              </div>

              <Button
                type="submit"
                disabled={submitting || vehicles.length === 0 || !selectedHubId}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-2.5 shadow-sm mt-2"
              >
                {submitting ? "Publishing Corridor Ride..." : "Publish Corridor Ride"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Route Map Preview (5 cols) */}
        <div className="lg:col-span-5">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden sticky top-24">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Route className="h-4 w-4 text-emerald-600" />
                Corridor Route Preview
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                {selectedHub ? selectedHub.name : "Select a corridor"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {selectedHub ? (
                <LeafletRouteMap
                  startLocation={{
                    name: selectedHub.origin.name,
                    address: selectedHub.origin.address,
                    latitude: selectedHub.origin.latitude,
                    longitude: selectedHub.origin.longitude,
                  }}
                  destination={{
                    name: selectedHub.destination.name,
                    address: selectedHub.destination.address,
                    latitude: selectedHub.destination.latitude,
                    longitude: selectedHub.destination.longitude,
                  }}
                  routeCoordinates={selectedHub.routeCoordinates || []}
                  distanceText={`${selectedHub.distanceKm} km`}
                  durationText={`~${selectedHub.durationMinutes} mins`}
                  height="450px"
                />
              ) : (
                <div className="h-[450px] flex items-center justify-center text-xs text-slate-400">
                  Select a corridor to view route preview
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}

export default function CreateHubRidePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <CarLoader message="Loading Corridor Ride Setup..." />
        </div>
      }
    >
      <CreateHubRideContent />
    </Suspense>
  );
}
