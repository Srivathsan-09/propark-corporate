"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Car,
  MapPin,
  Calendar,
  Clock,
  Users,
  Check,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  Phone,
  ArrowRight,
  ShieldCheck,
  Plus,
  IndianRupee,
  Navigation,
  Play,
  Square,
  Radio,
  Map as MapIcon,
  Navigation2,
  Sun,
  Moon,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { routingService, RouteResult } from "@/lib/services/routing";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";
import { EmployeeProfileModal } from "@/components/common/EmployeeProfileModal";
import MapView, { DriverLivePoint } from "@/components/map/MapView";
import { locationService } from "@/lib/services/location";
import { getInitials } from "@/lib/utils";

interface IPassengerRequest {
  _id: string;
  passenger: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    companyName?: string;
    department: string;
    employeeId: string;
    profileImage?: string;
  };
  pickupStop: string;
  dropStop: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  boardingPin?: string;
  isBoarded?: boolean;
  boardedAt?: string;
  createdAt: string;
}

interface IOfferedRide {
  _id: string;
  vehicle: {
    _id: string;
    vehicleModel: string;
    vehicleType: string;
    registrationNumber: string;
    vehiclePhoto?: string;
    seatingCapacity: number;
    availableSeats: number;
  };
  vehicleType: string;
  rideType?: "pickup" | "drop";
  startingLocation: string;
  destination: string;
  startLocation?: { address: string; latitude: number; longitude: number };
  endLocation?: { address: string; latitude: number; longitude: number };
  currentLocation?: DriverLivePoint;
  distanceKm?: number;
  durationMinutes?: number;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  stops: { name: string; price: number; latitude?: number; longitude?: number }[];
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  requests: IPassengerRequest[];
  createdAt: string;
}

interface IBookedRide {
  _id: string;
  ride: {
    _id: string;
    startingLocation: string;
    destination: string;
    startLocation?: { address: string; latitude: number; longitude: number };
    endLocation?: { address: string; latitude: number; longitude: number };
    currentLocation?: DriverLivePoint;
    departureDate: string;
    departureTime: string;
    vehicleType: string;
    rideType?: "pickup" | "drop";
    distanceKm?: number;
    durationMinutes?: number;
    stops: { name: string; price: number; latitude?: number; longitude?: number }[];
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
    driver: {
      name: string;
      email: string;
      phone: string;
      companyName?: string;
      department: string;
      employeeId: string;
    };
    vehicle: {
      vehicleModel: string;
      vehicleType: string;
      registrationNumber: string;
    };
  };
  driver: {
    name: string;
    email: string;
    phone: string;
    companyName?: string;
    department: string;
  };
  pickupStop: string;
  dropStop: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  boardingPin?: string;
  isBoarded?: boolean;
  boardedAt?: string;
  createdAt: string;
}

export default function MyRidesPage() {
  const { data: session } = useSession();

  const [offeredRides, setOfferedRides] = useState<IOfferedRide[]>([]);
  const [bookedRides, setBookedRides] = useState<IBookedRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"offered" | "booked">("offered");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Live GPS Tracking State for Driver
  const [activeTrackingRideId, setActiveTrackingRideId] = useState<string | null>(null);
  const [driverGpsPosition, setDriverGpsPosition] = useState<DriverLivePoint | null>(null);
  const stopWatchingRef = useRef<(() => void) | null>(null);

  // Live Passenger Tracking Modal
  const [trackingModalRide, setTrackingModalRide] = useState<any | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<any | null>(null);
  const [isLiveTrackingModalOpen, setIsLiveTrackingModalOpen] = useState(false);

  // Employee Profile Inspection Modal State
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileFallback, setViewProfileFallback] = useState<any | null>(null);

  // Driver Boarding PIN Verification Modal State
  const [pinModalRequest, setPinModalRequest] = useState<any | null>(null);
  const [enteredBoardingPin, setEnteredBoardingPin] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinModalError, setPinModalError] = useState<string | null>(null);

  const handleVerifyPassengerPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinModalRequest || !enteredBoardingPin.trim()) return;

    setIsVerifyingPin(true);
    setPinModalError(null);

    try {
      const res = await fetch(`/api/rides/${pinModalRequest.rideId}/verify-boarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: pinModalRequest._id,
          boardingPin: enteredBoardingPin.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setActionSuccessMsg(data.message || "Passenger boarding verified successfully!");
        setPinModalRequest(null);
        setEnteredBoardingPin("");
        await fetchMyRides(true);
      } else {
        setPinModalError(data.error || "Invalid 4-digit Boarding PIN.");
      }
    } catch (err) {
      setPinModalError("Network error while verifying boarding code.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const fetchMyRides = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const res = await fetch("/api/rides/my-rides");
      if (res.ok) {
        const data = await res.json();
        setOfferedRides(data.offeredRides || []);
        setBookedRides(data.bookedRides || []);

        // Check if any offered ride is in_progress to resume tracking
        const activeRide = (data.offeredRides || []).find((r: IOfferedRide) => r.status === "in_progress");
        if (activeRide && !activeTrackingRideId) {
          startDriverGpsTracking(activeRide._id, false);
        }
      }
    } catch (err) {
      console.error("Failed to load my rides:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchMyRides();

      const interval = setInterval(() => {
        fetchMyRides(true);
      }, 5000);

      const handleFocus = () => {
        fetchMyRides(true);
      };

      window.addEventListener("focus", handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", handleFocus);
        if (stopWatchingRef.current) {
          stopWatchingRef.current();
        }
      };
    }
  }, [session]);

  // Handle Driver Start GPS Tracking & Ride
  const startDriverGpsTracking = async (rideId: string, updateApiStatus = true) => {
    setActiveTrackingRideId(rideId);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      // 1. Initial Position Snapshot
      const pos = await locationService.getCurrentPosition();
      setDriverGpsPosition(pos);

      // 2. Update Status to in_progress if requested
      if (updateApiStatus) {
        const res = await fetch(`/api/rides/${rideId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "in_progress",
            initialLocation: pos,
          }),
        });

        if (!res.ok) {
          const d = await res.json();
          setActionErrorMsg(d.error || "Failed to start ride.");
          return;
        }

        setActionSuccessMsg("Ride started! Live GPS is broadcasting to your passengers.");
      }

      // 3. Start Continuous Live Watch
      if (stopWatchingRef.current) {
        stopWatchingRef.current();
      }

      const stopFn = locationService.watchPosition(
        async (newPos) => {
          setDriverGpsPosition(newPos);

          // Post live GPS to backend
          try {
            await fetch(`/api/rides/${rideId}/location`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                latitude: newPos.latitude,
                longitude: newPos.longitude,
                heading: newPos.heading,
                speed: newPos.speed,
                accuracy: newPos.accuracy,
              }),
            });
          } catch (e) {
            console.warn("GPS broadcast sync error:", e);
          }
        },
        (err) => {
          console.warn("GPS watch error:", err);
        }
      );

      stopWatchingRef.current = stopFn;
      fetchMyRides(true);
    } catch (err: any) {
      console.error("Start ride error:", err);
      setActionErrorMsg(err.message || "Please enable GPS location permissions to start live tracking.");
      setActiveTrackingRideId(null);
    }
  };

  // Handle Driver Complete / End Ride
  const handleCompleteRide = async (rideId: string) => {
    setActionLoadingId(rideId);
    try {
      if (stopWatchingRef.current) {
        stopWatchingRef.current();
        stopWatchingRef.current = null;
      }
      setActiveTrackingRideId(null);
      setDriverGpsPosition(null);

      const res = await fetch(`/api/rides/${rideId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });

      if (res.ok) {
        setActionSuccessMsg("Ride completed successfully! Thank you for carpooling.");
        fetchMyRides();
      } else {
        const d = await res.json();
        setActionErrorMsg(d.error || "Failed to complete ride.");
      }
    } catch (err) {
      console.error("Complete ride error:", err);
      setActionErrorMsg("Failed to end ride.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Driver Delete Offered Ride
  const handleDeleteRide = async (rideId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this offered ride? Any coworker seat requests will be automatically cancelled."
      )
    ) {
      return;
    }

    setActionLoadingId(rideId);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch(`/api/rides/${rideId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccessMsg("Ride deleted successfully.");
        fetchMyRides(true);
      } else {
        setActionErrorMsg(data.error || "Failed to delete ride.");
      }
    } catch (err) {
      console.error("Delete ride error:", err);
      setActionErrorMsg("Failed to delete ride. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Passenger Open Live Tracking Modal
  const handleOpenLiveTracking = async (ride: any) => {
    setTrackingModalRide(ride);
    setIsLiveTrackingModalOpen(true);

    try {
      const res = await fetch(`/api/rides/${ride._id}/location`);
      if (res.ok) {
        const data = await res.json();
        setLiveTelemetry(data);
      }
    } catch (e) {
      console.error("Failed to fetch initial telemetry:", e);
    }
  };

  // Real-time polling for passenger tracking modal
  useEffect(() => {
    if (!isLiveTrackingModalOpen || !trackingModalRide) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/rides/${trackingModalRide._id}/location`);
        if (res.ok) {
          const data = await res.json();
          setLiveTelemetry(data);
        }
      } catch (e) {
        console.warn("Telemetry poll error:", e);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [isLiveTrackingModalOpen, trackingModalRide]);

  const handleRequestAction = async (requestId: string, action: "accept" | "reject") => {
    setActionLoadingId(requestId);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch(`/api/rides/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionErrorMsg(data.error || "Failed to update request.");
        setActionLoadingId(null);
        return;
      }

      setActionSuccessMsg(data.message || `Request ${action}ed successfully.`);
      fetchMyRides(true);
    } catch (err) {
      console.error("Request action error:", err);
      setActionErrorMsg("Network error. Please try again.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const [liveEtaResult, setLiveEtaResult] = useState<RouteResult | null>(null);

  // Recalculate Live Traffic-Aware ETA periodically while tracking modal is open
  useEffect(() => {
    if (!isLiveTrackingModalOpen || !trackingModalRide) return;

    const updateLiveEta = async () => {
      const startPt = {
        latitude: trackingModalRide.startLocation?.latitude || 13.048,
        longitude: trackingModalRide.startLocation?.longitude || 80.091,
      };
      const endPt = {
        latitude: trackingModalRide.endLocation?.latitude || 12.8988,
        longitude: trackingModalRide.endLocation?.longitude || 80.2284,
      };
      const driverLoc = liveTelemetry?.currentLocation || driverGpsPosition;

      const result = await routingService.calculateRoute(
        [startPt, endPt],
        trackingModalRide.departureTime,
        driverLoc ? { latitude: driverLoc.latitude, longitude: driverLoc.longitude, speed: (driverLoc as any).speed } : null
      );
      setLiveEtaResult(result);
    };

    updateLiveEta();
    const interval = setInterval(updateLiveEta, 10000); // 10s periodic refresh
    return () => clearInterval(interval);
  }, [isLiveTrackingModalOpen, trackingModalRide, liveTelemetry, driverGpsPosition]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            My Commute Rides & Tracking
          </h1>
          <p className="text-sm text-slate-500">
            Manage your offered corporate carpools, broadcast live GPS location, and track booked coworkers in real time
          </p>
        </div>

        <Link href="/rides/offer">
          <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 text-xs rounded-xl shadow-xs">
            <Plus className="h-4 w-4" /> Offer a New Ride
          </Button>
        </Link>
      </div>

      {actionSuccessMsg && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{actionSuccessMsg}</span>
        </div>
      )}

      {actionErrorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{actionErrorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("offered")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "offered"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Car className="h-4 w-4" /> Offered Rides (Driver Desk)
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "offered" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"
            }`}
          >
            {offeredRides.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("booked")}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
            activeTab === "booked"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="h-4 w-4" /> Booked Rides (Passenger)
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === "booked" ? "bg-emerald-800 text-emerald-100" : "bg-slate-200 text-slate-700"
            }`}
          >
            {bookedRides.length}
          </span>
        </button>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="page" message="Loading your commute rides..." />
        </div>
      ) : activeTab === "offered" ? (
        /* OFFERED RIDES TAB (DRIVER VIEW) */
        offeredRides.length === 0 ? (
          <EmptyState
            icon={Car}
            title="No Offered Rides"
            description="You haven't posted any carpool rides yet. Share your commute with campus colleagues and save costs."
            actionLabel="Offer a Ride"
            onAction={() => {
              window.location.href = "/rides/offer";
            }}
          />
        ) : (
          <div className="space-y-6">
            {offeredRides.map((ride) => {
              const isPickup = ride.rideType !== "drop";
              const isLive = ride.status === "in_progress" || activeTrackingRideId === ride._id;
              const isCompleted = ride.status === "completed";

              return (
                <Card
                  key={ride._id}
                  className={`border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden ${
                    isLive ? "ring-2 ring-emerald-500 border-emerald-300" : ""
                  }`}
                >
                  <CardHeader className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                          {ride.startingLocation} <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {ride.destination}
                        </CardTitle>
                        {isPickup ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Pickup
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                            Drop
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        {ride.vehicle.vehicleModel} ({ride.vehicle.registrationNumber}) • {ride.vehicleType}
                      </CardDescription>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {isLive ? (
                        <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1.5 animate-pulse">
                          <Radio className="h-3.5 w-3.5 animate-ping" /> Live GPS Active
                        </Badge>
                      ) : (
                        <Badge
                          className={`font-bold text-[10px] ${
                            isCompleted ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ride.status.toUpperCase()}
                        </Badge>
                      )}

                      {/* START RIDE / COMPLETE RIDE / DELETE BUTTONS FOR DRIVER */}
                      {ride.status === "scheduled" && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => startDriverGpsTracking(ride._id, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 h-8"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" /> Start Ride & GPS
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRide(ride._id)}
                            disabled={actionLoadingId === ride._id}
                            className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold text-xs rounded-xl gap-1.5 h-8"
                          >
                            {actionLoadingId === ride._id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </Button>
                        </div>
                      )}

                      {(ride.status === "completed" || ride.status === "cancelled") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteRide(ride._id)}
                          disabled={actionLoadingId === ride._id}
                          className="text-slate-400 hover:text-rose-600 text-xs rounded-xl gap-1 h-8 px-2"
                          title="Delete Ride Record"
                        >
                          {actionLoadingId === ride._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      )}

                      {isLive && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleOpenLiveTracking(ride)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl gap-1.5 h-8"
                          >
                            <MapIcon className="h-3.5 w-3.5 text-emerald-400" /> Driver GPS Map
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCompleteRide(ride._id)}
                            disabled={actionLoadingId === ride._id}
                            className="text-xs font-bold rounded-xl gap-1.5 h-8"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" /> Complete Ride
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-4">
                    {/* Commute Info Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Date & Time</span>
                        <span className="font-bold text-slate-800">{ride.departureDate} at {ride.departureTime}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Seat Availability</span>
                        <span className="font-bold text-emerald-700">{ride.availableSeats} of {ride.totalSeats} Left</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Distance</span>
                        <span className="font-bold text-slate-800">{ride.distanceKm ? `${ride.distanceKm} km` : "N/A"}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Estimated Time</span>
                        <span className="font-bold text-slate-800">{ride.durationMinutes ? `${ride.durationMinutes} mins` : "N/A"}</span>
                      </div>
                    </div>

                    {/* Passenger Requests Manifest */}
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Coworker Requests ({ride.requests.length})
                        </span>
                      </div>

                      {ride.requests.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-2">No passenger requests received yet.</p>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                          {ride.requests.map((req) => {
                            const isAccepted = req.status === "accepted";
                            const isPending = req.status === "pending";

                            return (
                              <div
                                key={req._id}
                                className={`p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${
                                  isAccepted ? "bg-emerald-50/20" : isPending ? "bg-amber-50/20" : ""
                                }`}
                              >
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    {req.passenger.name}
                                    <span className="text-[10px] text-slate-500 font-mono">({req.passenger.employeeId})</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewProfileUserId(req.passenger._id);
                                        setViewProfileFallback(req.passenger);
                                      }}
                                      className="text-[10px] font-bold text-purple-700 hover:text-purple-900 ml-1 hover:underline flex items-center gap-0.5"
                                    >
                                      View Profile
                                    </button>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                    <span className="font-semibold text-emerald-800">{req.passenger.companyName || "Tech Mahindra"}</span>
                                    <span>• {req.passenger.department}</span>
                                    {req.passenger.phone && <span>• {req.passenger.phone}</span>}
                                  </div>
                                  <div className="text-[11px] text-slate-600 mt-1">
                                    Boarding: <strong className="text-slate-800">{req.pickupStop}</strong> • Seats: <strong>{req.seatsRequested}</strong> • Fare: <strong>₹{req.fare}</strong>
                                  </div>
                                  {req.notes && (
                                    <div className="text-[10px] text-slate-500 italic mt-0.5">&ldquo;{req.notes}&rdquo;</div>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {isPending ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleRequestAction(req._id, "accept")}
                                        disabled={actionLoadingId === req._id}
                                        className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1"
                                      >
                                        {actionLoadingId === req._id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Check className="h-3.5 w-3.5" />
                                        )}
                                        Accept
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRequestAction(req._id, "reject")}
                                        disabled={actionLoadingId === req._id}
                                        className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs rounded-xl gap-1"
                                      >
                                        <X className="h-3.5 w-3.5" /> Reject
                                      </Button>
                                    </>
                                  ) : isAccepted ? (
                                    <div className="flex items-center gap-1.5">
                                      {req.isBoarded ? (
                                        <Badge className="bg-emerald-600 text-white text-[10px] font-bold py-0.5 px-2 gap-1">
                                          <Check className="h-3 w-3" /> Boarded
                                        </Badge>
                                      ) : (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            setPinModalRequest({ ...req, rideId: ride._id });
                                            setEnteredBoardingPin("");
                                            setPinModalError(null);
                                          }}
                                          className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg gap-1 shadow-2xs"
                                        >
                                          <ShieldCheck className="h-3.5 w-3.5" /> Verify PIN
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <Badge className="text-[10px] font-bold bg-rose-100 text-rose-800">
                                      {req.status.toUpperCase()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : (
        /* BOOKED RIDES TAB (PASSENGER VIEW WITH LIVE DRIVER TRACKING) */
        bookedRides.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Booked Rides"
            description="You haven't requested or joined any coworker carpools yet."
            actionLabel="Find a Ride"
            onAction={() => {
              window.location.href = "/rides/find";
            }}
          />
        ) : (
          <div className="space-y-4">
            {bookedRides
              .filter((booking) => Boolean(booking && booking.ride && booking.ride.driver))
              .map((booking) => {
                const ride = booking.ride;
                const isLive = ride.status === "in_progress";
                const isAccepted = booking.status === "accepted";

                return (
                  <Card
                    key={booking._id}
                    className={`border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden ${
                      isLive && isAccepted ? "ring-2 ring-emerald-500 border-emerald-300" : ""
                    }`}
                  >
                    <CardHeader className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-bold text-slate-900">
                            {ride.startingLocation} <ArrowRight className="h-3.5 w-3.5 text-slate-400" /> {ride.destination}
                          </CardTitle>
                          <Badge className="bg-slate-900 text-white font-bold text-[10px]">
                            {ride.vehicleType}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>
                            Driver: <strong>{ride.driver?.name || "Colleague"}</strong> ({ride.driver?.companyName || "Tech Mahindra"}) • Plate: {ride.vehicle?.registrationNumber || "Campus Vehicle"}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const driverId = (ride.driver as any)?._id || (booking.driver as any)?._id;
                              setViewProfileUserId(driverId);
                              setViewProfileFallback(ride.driver || booking.driver);
                            }}
                            className="text-[10px] font-bold text-purple-700 hover:text-purple-900 hover:underline"
                          >
                            • View Profile
                          </button>
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {isLive && isAccepted ? (
                          <span className="whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs animate-pulse">
                            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                            Driver is on the way (Live)
                          </span>
                        ) : (
                          <Badge
                            className={`text-[10px] font-bold ${
                              isAccepted
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : booking.status === "pending"
                                ? "bg-amber-100 text-amber-800 border-amber-300"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {isAccepted ? "Booking Confirmed" : booking.status === "pending" ? "Awaiting Driver" : booking.status}
                          </Badge>
                        )}

                        {/* PASSENGER TRACK DRIVER LIVE BUTTON */}
                        {isAccepted && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenLiveTracking(ride)}
                            className={`${
                              isLive
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce"
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            } font-bold text-xs rounded-xl shadow-xs gap-1.5 h-8`}
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            {isLive ? "Track Driver Live GPS" : "View Route on Map"}
                          </Button>
                        )}
                      </div>
                    </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Your Boarding Stop</span>
                        <span className="font-bold text-slate-800">{booking.pickupStop}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Departure Time</span>
                        <span className="font-bold text-slate-800">{ride.departureDate} at {ride.departureTime}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Seats Booked</span>
                        <span className="font-bold text-emerald-700">{booking.seatsRequested} Seat(s)</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 block font-semibold">Total Fare</span>
                        <span className="font-bold text-emerald-800">₹{booking.fare}</span>
                      </div>
                    </div>

                    {ride.driver.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
                        <Phone className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Driver Contact: <strong className="text-slate-900">{ride.driver.phone}</strong></span>
                      </div>
                    )}

                    {/* Boarding Security PIN Card */}
                    {isAccepted && booking.boardingPin && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 bg-purple-600 text-white rounded-lg font-bold">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-purple-700 block">Boarding Security PIN</span>
                            <span className="text-xs text-slate-600">Share this 4-digit code with your driver upon entering the vehicle</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <div className="font-mono text-xl font-bold tracking-widest bg-white px-3.5 py-1 rounded-lg border-2 border-purple-300 text-purple-900 shadow-2xs">
                            {booking.boardingPin}
                          </div>
                          {booking.isBoarded ? (
                            <Badge className="bg-emerald-600 text-white text-[10px] font-bold py-1 px-2">
                              Boarded & Verified
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] font-semibold py-1 px-2">
                              Awaiting Boarding
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* LIVE DRIVER GPS TRACKING MODAL FOR PASSENGERS & DRIVER */}
      <Dialog open={isLiveTrackingModalOpen} onOpenChange={setIsLiveTrackingModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          {trackingModalRide && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
                    Live Driver GPS Tracking
                  </DialogTitle>
                  <Badge className="bg-emerald-600 text-white font-bold text-xs">
                    {liveTelemetry?.status === "in_progress" ? "Live Commute" : "Scheduled"}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  {liveTelemetry?.driver?.name} • {liveTelemetry?.vehicle?.vehicleModel} ({liveTelemetry?.vehicle?.registrationNumber})
                </DialogDescription>
              </DialogHeader>

              {/* Real-time Live Traffic-Aware ETA Header */}
              <div className="bg-slate-950 text-white p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining Commute</span>
                    <strong className="text-sm text-emerald-400 font-bold">
                      {liveEtaResult?.remainingDistanceKm ?? liveTelemetry?.distanceKm ?? 0} km remaining
                    </strong>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Live Traffic-Aware ETA</span>
                  <strong className="text-sm text-white font-bold">
                    {liveEtaResult?.formattedDuration || `${liveTelemetry?.durationMinutes || 20} mins`}{" "}
                    {liveEtaResult?.formattedEtaTime ? `(${liveEtaResult.formattedEtaTime})` : ""}
                  </strong>
                </div>

                {liveEtaResult?.trafficLevel && (
                  <span
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                      liveEtaResult.trafficBadgeColor === "rose"
                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                        : liveEtaResult.trafficBadgeColor === "amber"
                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                        : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    }`}
                  >
                    {liveEtaResult.trafficBadgeText}
                  </span>
                )}
              </div>

              {/* Real-time Map with Moving Driver Marker */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <MapView
                  startLocation={{
                    name: liveTelemetry?.startingLocation || trackingModalRide.startingLocation,
                    address: liveTelemetry?.startLocation?.address || trackingModalRide.startingLocation,
                    latitude: liveTelemetry?.startLocation?.latitude || 12.9249,
                    longitude: liveTelemetry?.startLocation?.longitude || 80.1332,
                  }}
                  destination={{
                    name: liveTelemetry?.destination || trackingModalRide.destination,
                    address: liveTelemetry?.endLocation?.address || trackingModalRide.destination,
                    latitude: liveTelemetry?.endLocation?.latitude || 12.8988,
                    longitude: liveTelemetry?.endLocation?.longitude || 80.2284,
                  }}
                  stops={trackingModalRide.stops?.map((s: any) => ({
                    name: s.name,
                    price: s.price,
                    latitude: s.latitude || 12.95,
                    longitude: s.longitude || 80.18,
                  }))}
                  driverLocation={liveTelemetry?.currentLocation || driverGpsPosition}
                  driverName={liveTelemetry?.driver?.name || "Driver"}
                  driverVehicleType={liveTelemetry?.vehicle?.vehicleType || "Car"}
                  panToDriver={Boolean(liveTelemetry?.currentLocation)}
                  distanceText={
                    liveEtaResult?.remainingDistanceKm
                      ? `${liveEtaResult.remainingDistanceKm} km`
                      : liveTelemetry?.distanceKm
                      ? `${liveTelemetry.distanceKm} km`
                      : undefined
                  }
                  durationText={
                    liveEtaResult?.formattedDuration ||
                    (liveTelemetry?.durationMinutes ? `${liveTelemetry.durationMinutes} mins` : undefined)
                  }
                  trafficLevel={liveEtaResult?.trafficLevel}
                  height="450px"
                  showStats={true}
                />
              </div>

              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLiveTrackingModalOpen(false)}
                  className="rounded-xl text-xs font-semibold px-4"
                >
                  Close Live Tracker
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DRIVER BOARDING PIN VERIFICATION MODAL */}
      {pinModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Verify Passenger Boarding</h2>
                  <p className="text-[11px] text-slate-500">{pinModalRequest.passenger?.name || "Passenger"}</p>
                </div>
              </div>
              <button
                onClick={() => setPinModalRequest(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {pinModalError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{pinModalError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyPassengerPin} className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 text-center space-y-1">
                <span className="text-[11px] text-purple-900 font-medium block">
                  Ask {pinModalRequest.passenger?.name || "the passenger"} for their 4-digit Boarding PIN
                </span>
                <span className="text-[10px] text-slate-500">
                  This code is displayed on their booking confirmation screen
                </span>
              </div>

              <div className="space-y-1.5">
                <Input
                  required
                  autoFocus
                  maxLength={4}
                  value={enteredBoardingPin}
                  onChange={(e) => setEnteredBoardingPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="h-12 text-center font-mono text-2xl tracking-widest rounded-xl font-bold border-2 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPinModalRequest(null)}
                  className="h-9 px-4 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isVerifyingPin || enteredBoardingPin.length < 4}
                  size="sm"
                  className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-xl shadow-xs"
                >
                  {isVerifyingPin ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  Verify & Board
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Coworker Employee Profile Modal */}
      <EmployeeProfileModal
        isOpen={Boolean(viewProfileUserId)}
        onClose={() => setViewProfileUserId(null)}
        userId={viewProfileUserId}
        fallbackData={viewProfileFallback}
      />
    </div>
  );
}
