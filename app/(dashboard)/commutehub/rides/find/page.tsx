"use client";

import React, { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Route,
  Search,
  Calendar,
  Clock,
  Car,
  IndianRupee,
  Users,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  ShieldCheck,
  Phone,
  Mail,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

const LeafletRouteMap = dynamic(
  () => import("@/components/map/LeafletRouteMap"),
  { ssr: false }
);

function FindHubRidesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  const urlHubId = searchParams.get("hubId") || "";

  const [hubs, setHubs] = useState<any[]>([]);
  const [selectedHubId, setSelectedHubId] = useState<string>(urlHubId);
  const [selectedHub, setSelectedHub] = useState<any | null>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState<string>("");

  const [loadingHubs, setLoadingHubs] = useState(true);
  const [loadingRides, setLoadingRides] = useState(false);
  const [bookingRideId, setBookingRideId] = useState<string | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Fetch available campus hubs
  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    try {
      setLoadingHubs(true);
      const res = await fetch("/api/commutehub/hubs");
      const data = await res.json();
      if (data.success && data.hubs) {
        setHubs(data.hubs);

        // If urlHubId exists, set selected
        if (urlHubId) {
          const match = data.hubs.find((h: any) => h._id === urlHubId || h.hubId === urlHubId);
          if (match) {
            setSelectedHubId(match._id);
            setSelectedHub(match);
          }
        } else if (data.hubs.length > 0) {
          // Default to first hub
          setSelectedHubId(data.hubs[0]._id);
          setSelectedHub(data.hubs[0]);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingHubs(false);
    }
  };

  // 2. Fetch rides whenever selectedHubId or filterDate changes
  useEffect(() => {
    if (!selectedHubId) return;
    fetchRides(selectedHubId, filterDate);
  }, [selectedHubId, filterDate]);

  const fetchRides = async (hubId: string, date?: string) => {
    try {
      setLoadingRides(true);
      setErrorMsg(null);
      setBookingSuccessMsg(null);

      let url = `/api/commutehub/rides?hubId=${encodeURIComponent(hubId)}`;
      if (date && date.trim()) {
        url += `&date=${encodeURIComponent(date.trim())}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load corridor rides.");
      }

      setRides(data.rides || []);
      if (data.hub) {
        setSelectedHub(data.hub);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to load corridor rides.");
      setRides([]);
    } finally {
      setLoadingRides(false);
    }
  };

  const handleHubChange = (newHubId: string) => {
    setSelectedHubId(newHubId);
    const found = hubs.find((h) => h._id === newHubId || h.hubId === newHubId);
    if (found) setSelectedHub(found);
    router.replace(`/commutehub/rides/find?hubId=${newHubId}`, { scroll: false });
  };

  const handleBookRide = async (ride: any) => {
    if (!selectedHub) return;

    try {
      setBookingRideId(ride._id);
      setErrorMsg(null);
      setBookingSuccessMsg(null);

      const payload = {
        pickupStop: selectedHub.origin.name,
        dropStop: selectedHub.destination.name,
        seatsRequested: 1,
        fare: ride.pricePerSeat || 0,
        notes: `CommuteHub Corridor booking along ${selectedHub.name}`,
      };

      const res = await fetch(`/api/rides/${ride._id}/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": `HUB-REQ-${ride._id}-${session?.user?.id}-${Date.now()}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to request ride.");
      }

      setBookingSuccessMsg("Ride request submitted successfully! Driver has been notified.");
      // Refresh rides
      fetchRides(selectedHubId, filterDate);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || "Failed to book corridor ride.");
    } finally {
      setBookingRideId(null);
    }
  };

  if (loadingHubs) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Connecting to CommuteHub corridors..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Search className="h-6 w-6 text-emerald-600" />
            Find a Ride by Corridor Hub
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select a virtual commuting corridor to find verified colleague carpools
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedHubId && (
            <Link href={`/commutehub/rides/create?hubId=${selectedHubId}`}>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm">
                <Plus className="h-3.5 w-3.5" />
                Offer Ride on this Corridor
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Notifications */}
      {bookingSuccessMsg && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{bookingSuccessMsg}</span>
          </div>
          <Link href="/commutehub/my-rides" className="font-bold underline text-emerald-900 ml-2">
            View My Hub Rides &rarr;
          </Link>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Hub Selection Controls */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Hub Corridor Dropdown */}
            <div className="md:col-span-8">
              <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                Select Commuting Corridor
              </label>
              <select
                value={selectedHubId}
                onChange={(e) => handleHubChange(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-medium shadow-xs focus:border-emerald-500 focus:outline-hidden"
              >
                {hubs.map((hub) => (
                  <option key={hub._id} value={hub._id}>
                    {hub.name} ({hub.origin.name} &rarr; {hub.destination.name}) • {hub.distanceKm} km
                  </option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div className="md:col-span-4">
              <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                Departure Date
              </label>
              <Input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="h-10 rounded-xl text-xs border-slate-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Corridor Overview + Map Preview */}
      {selectedHub && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Corridor Info & Rides List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Corridor Ribbon */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="outline" className="font-mono text-[9px] text-slate-600 bg-slate-50">
                    {selectedHub.hubId}
                  </Badge>
                  <h2 className="text-sm font-bold text-slate-900 mt-1">{selectedHub.name}</h2>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs" variant="outline">
                  {rides.length} available {rides.length === 1 ? "ride" : "rides"}
                </Badge>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
                  <span className="font-medium text-slate-800">{selectedHub.origin.name}</span>
                  <span className="text-slate-400">&rarr;</span>
                  <span className="h-2 w-2 rounded-full bg-red-600"></span>
                  <span className="font-medium text-slate-800">{selectedHub.destination.name}</span>
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {selectedHub.distanceKm} km • ~{selectedHub.durationMinutes} mins
                </div>
              </div>
            </div>

            {/* Rides List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <Car className="h-4 w-4 text-emerald-600" />
                Scheduled Rides on this Corridor
              </h3>

              {loadingRides ? (
                <div className="p-8 text-center">
                  <CarLoader message="Checking corridor rides..." />
                </div>
              ) : rides.length === 0 ? (
                <Card className="rounded-2xl border-slate-200 bg-white p-8 text-center shadow-xs">
                  <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700">No carpools scheduled for this date</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                    Be the first driver to offer a ride along this corridor, or check back later!
                  </p>
                  <div className="mt-4">
                    <Link href={`/commutehub/rides/create?hubId=${selectedHub._id}`}>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">
                        Offer Ride on Corridor
                      </Button>
                    </Link>
                  </div>
                </Card>
              ) : (
                rides.map((ride) => {
                  const isDriver = ride.driver?._id === session?.user?.id;
                  const hasRequested = Boolean(ride.userRequestStatus);

                  return (
                    <Card
                      key={ride._id}
                      className="rounded-2xl border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden"
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Driver Info */}
                          <div className="flex items-start gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs shrink-0">
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
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {ride.departureDate} at {ride.departureTime}
                                </span>
                                <span>•</span>
                                <span>
                                  {ride.vehicle?.vehicleModel || "Car"} (
                                  {ride.vehicle?.registrationNumber || "Reg"})
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                                <span className="font-semibold text-emerald-700">
                                  {ride.availableSeats} of {ride.totalSeats} seats open
                                </span>
                                {ride.pricePerSeat > 0 ? (
                                  <>
                                    <span>•</span>
                                    <span className="font-bold text-slate-900 flex items-center">
                                      <IndianRupee className="h-3 w-3" />
                                      {ride.pricePerSeat} / seat
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span>•</span>
                                    <span className="font-semibold text-emerald-600">Free Carpool</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <div className="shrink-0 self-end sm:self-center">
                            {isDriver ? (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 text-xs">
                                Your Offered Ride
                              </Badge>
                            ) : hasRequested ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
                              >
                                {ride.userRequestStatus === "accepted"
                                  ? "Accepted (Booked)"
                                  : "Request Pending"}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                disabled={bookingRideId === ride._id || ride.availableSeats <= 0}
                                onClick={() => handleBookRide(ride)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm"
                              >
                                {bookingRideId === ride._id ? "Requesting..." : "Request to Join"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Corridor Route Map (5 cols) */}
          <div className="lg:col-span-5">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden sticky top-24">
              <CardHeader className="p-4 border-b border-slate-100">
                <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Route className="h-4 w-4 text-emerald-600" />
                  Corridor Turn-by-Turn Map
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Fixed road path followed by drivers along this hub
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FindHubRidesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-96 flex-col items-center justify-center gap-3">
          <CarLoader message="Connecting to CommuteHub corridors..." />
        </div>
      }
    >
      <FindHubRidesContent />
    </Suspense>
  );
}
