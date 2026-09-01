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
  DialogFooter,
} from "@/components/ui/dialog";
import { routingService, RouteResult } from "@/lib/services/routing";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";
import { EmployeeProfileModal } from "@/components/common/EmployeeProfileModal";
import MapView, { DriverLivePoint } from "@/components/map/MapView";
import { locationService } from "@/lib/services/location";
import { resolvePlaceCoordinates } from "@/lib/services/geocoding";
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
  paymentStatus?: "paid" | "partially_paid" | "not_paid";
  amountPaid?: number;
  paymentUpdatedAt?: string;
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
  paymentStatus?: "paid" | "partially_paid" | "not_paid";
  amountPaid?: number;
  paymentUpdatedAt?: string;
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
  const [trackingModalBooking, setTrackingModalBooking] = useState<any | null>(null);
  const [liveTelemetry, setLiveTelemetry] = useState<any | null>(null);
  const [isLiveTrackingModalOpen, setIsLiveTrackingModalOpen] = useState(false);
  const [passengerGpsPosition, setPassengerGpsPosition] = useState<DriverLivePoint | null>(null);
  const passengerStopWatchingRef = useRef<(() => void) | null>(null);
  const [passengerGpsStatus, setPassengerGpsStatus] = useState<"ACTIVE" | "UPDATING" | "DENIED" | "UNAVAILABLE">("UPDATING");

  // Helper to calculate two-way driver & passenger proximity (distance & ETA)
  const calculateProximity = (
    driverLoc?: { latitude: number; longitude: number } | null,
    passengerLoc?: { latitude: number; longitude: number } | null
  ) => {
    if (!driverLoc || !passengerLoc || !driverLoc.latitude || !passengerLoc.latitude) {
      return null;
    }

    const R = 6371e3; // meters
    const phi1 = (driverLoc.latitude * Math.PI) / 180;
    const phi2 = (passengerLoc.latitude * Math.PI) / 180;
    const dPhi = ((passengerLoc.latitude - driverLoc.latitude) * Math.PI) / 180;
    const dLambda = ((passengerLoc.longitude - driverLoc.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = R * c;

    let distanceText = "";
    if (meters < 1000) {
      distanceText = `${Math.round(meters)} m away`;
    } else {
      distanceText = `${(meters / 1000).toFixed(1)} km away`;
    }

    const minutes = Math.max(1, Math.round(meters / 400));
    let etaText = "";
    if (meters <= 50) {
      etaText = "<1 min";
    } else {
      etaText = `${minutes} min`;
    }

    return { distanceText, etaText, meters, minutes };
  };

  // Employee Profile Inspection Modal State
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileFallback, setViewProfileFallback] = useState<any | null>(null);

  // Driver Boarding PIN Verification Modal State
  const [pinModalRequest, setPinModalRequest] = useState<any | null>(null);
  const [enteredBoardingPin, setEnteredBoardingPin] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [pinModalError, setPinModalError] = useState<string | null>(null);

  // Custom Delete Confirmation Modal State
  const [deleteConfirmRideId, setDeleteConfirmRideId] = useState<string | null>(null);
  const [isDeletingRide, setIsDeletingRide] = useState(false);

  // Post-Ride Fare Payment Status Modal State for Driver
  const [partialPaymentModalReq, setPartialPaymentModalReq] = useState<IPassengerRequest | null>(null);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<string>("");
  const [isUpdatingPayment, setIsUpdatingPayment] = useState<boolean>(false);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);
  const [liveEtaResult, setLiveEtaResult] = useState<RouteResult | null>(null);

  const handleUpdatePaymentStatus = async (
    requestId: string,
    paymentStatus: "paid" | "partially_paid" | "not_paid",
    amountPaid?: number
  ) => {
    setActionLoadingId(requestId);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch(`/api/rides/requests/${requestId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus, amountPaid }),
      });

      const data = await res.json();

      if (!res.ok) {
        setActionErrorMsg(data.error || "Failed to update fare payment status.");
        setActionLoadingId(null);
        return;
      }

      setActionSuccessMsg(data.message || "Fare payment status updated successfully.");
      fetchMyRides(true);
      setPartialPaymentModalReq(null);
    } catch (err) {
      console.error("Payment status update error:", err);
      setActionErrorMsg("Network error. Please try again.");
    } finally {
      setActionLoadingId(null);
      setIsUpdatingPayment(false);
    }
  };

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
    // 1. Instant Optimistic UI Update (< 10ms responsiveness)
    setOfferedRides((prev) =>
      prev.map((r) => (r._id === rideId ? { ...r, status: "completed", completedAt: new Date().toISOString() } : r))
    );
    setActionLoadingId(rideId);
    setActionSuccessMsg("Ride completed successfully! Thank you for carpooling.");

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
        fetchMyRides(true);
      } else {
        const d = await res.json();
        setActionErrorMsg(d.error || "Failed to complete ride.");
        fetchMyRides(true);
      }
    } catch (err) {
      console.error("Complete ride error:", err);
      setActionErrorMsg("Failed to end ride.");
      fetchMyRides(true);
    } finally {
      setActionLoadingId(null);
    }
  };

  // Handle Driver Delete Offered Ride - Open Custom Modal
  const handleDeleteRide = (rideId: string) => {
    setDeleteConfirmRideId(rideId);
  };

  const confirmDeleteRide = async () => {
    if (!deleteConfirmRideId) return;
    setIsDeletingRide(true);
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await fetch(`/api/rides/${deleteConfirmRideId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        setActionSuccessMsg("Ride deleted successfully.");
        setDeleteConfirmRideId(null);
        fetchMyRides(true);
      } else {
        setActionErrorMsg(data.error || "Failed to delete ride.");
      }
    } catch (err) {
      console.error("Delete ride error:", err);
      setActionErrorMsg("Failed to delete ride. Please try again.");
    } finally {
      setIsDeletingRide(false);
    }
  };

  // Handle Open Live Tracking Modal (Supports Driver & Passenger views)
  const handleOpenLiveTracking = async (ride: any, booking?: any) => {
    setTrackingModalRide(ride);
    setTrackingModalBooking(booking || null);
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

    // Start passenger GPS broadcast if passenger has an accepted booking
    if (booking && booking._id && booking.status === "accepted" && ride.status !== "completed" && ride.status !== "cancelled") {
      if (passengerStopWatchingRef.current) {
        passengerStopWatchingRef.current();
      }

      setPassengerGpsStatus("UPDATING");
      const stopFn = locationService.watchPosition(
        async (newPos) => {
          setPassengerGpsPosition(newPos);
          setPassengerGpsStatus("ACTIVE");

          try {
            await fetch(`/api/rides/requests/${booking._id}/location`, {
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
            console.warn("Passenger GPS sync warning:", e);
          }
        },
        (err) => {
          console.warn("Passenger GPS watch warning:", err);
          if (err.type === "PERMISSION_DENIED") {
            setPassengerGpsStatus("DENIED");
          } else {
            setPassengerGpsStatus("UNAVAILABLE");
          }
        }
      );

      passengerStopWatchingRef.current = stopFn;
    }
  };

  // Stop passenger GPS watching when modal is closed
  useEffect(() => {
    if (!isLiveTrackingModalOpen && passengerStopWatchingRef.current) {
      passengerStopWatchingRef.current();
      passengerStopWatchingRef.current = null;
    }
  }, [isLiveTrackingModalOpen]);

  // Auto Background Live GPS Broadcast for Passenger with active accepted booking
  useEffect(() => {
    if (!bookedRides || bookedRides.length === 0) return;

    const activeBooking = bookedRides.find(
      (b: any) => b.status === "accepted" && b.ride && b.ride.status !== "completed" && b.ride.status !== "cancelled"
    );

    if (!activeBooking || !activeBooking._id) return;

    const stopFn = locationService.watchPosition(
      async (newPos) => {
        try {
          await fetch(`/api/rides/requests/${activeBooking._id}/location`, {
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
          console.warn("Background passenger GPS sync error:", e);
        }
      },
      (err) => console.warn("Background passenger GPS watch error:", err)
    );

    return () => {
      if (stopFn) stopFn();
    };
  }, [bookedRides]);

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
              const isLive = ride.status === "in_progress";
              const isCompleted = ride.status === "completed";

              const acceptedReqs = ride.requests.filter((r) => r.status === "accepted");
              const totalExpectedFare = acceptedReqs.reduce((sum, r) => sum + (r.fare || 0), 0);
              const totalCollected = acceptedReqs.reduce((sum, r) => sum + (r.amountPaid || 0), 0);
              const outstandingAmount = Math.max(0, totalExpectedFare - totalCollected);

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
                      {/* SCHEDULED RIDE ACTIONS */}
                      {ride.status === "scheduled" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="font-bold text-[10px] bg-slate-100 text-slate-700">
                            SCHEDULED
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => handleOpenLiveTracking(ride)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl gap-1.5 h-8 border border-slate-700 shadow-xs"
                          >
                            <MapIcon className="h-3.5 w-3.5 text-emerald-400" /> View Passenger Map
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => startDriverGpsTracking(ride._id, true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5 h-8"
                          >
                            <Play className="h-3.5 w-3.5 fill-current" /> Start Ride
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

                      {/* IN PROGRESS RIDE ACTIONS */}
                      {ride.status === "in_progress" && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1.5 animate-pulse py-1 px-2.5">
                            <Radio className="h-3.5 w-3.5 animate-ping" /> Live GPS Active
                          </Badge>
                          <Button
                            size="sm"
                            onClick={() => handleOpenLiveTracking(ride)}
                            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl gap-1.5 h-8 border border-slate-700 shadow-xs"
                          >
                            <MapIcon className="h-3.5 w-3.5 text-emerald-400" /> Driver GPS Map
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleCompleteRide(ride._id)}
                            disabled={actionLoadingId === ride._id}
                            className="text-xs font-bold rounded-xl gap-1.5 h-8 shadow-xs"
                          >
                            <Square className="h-3.5 w-3.5 fill-current" /> Complete Ride
                          </Button>
                        </div>
                      )}

                      {/* COMPLETED / CANCELLED RIDE ACTIONS */}
                      {(ride.status === "completed" || ride.status === "cancelled") && (
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`font-bold text-[10px] ${
                              isCompleted ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {ride.status.toUpperCase()}
                          </Badge>
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
                    <div className="pt-2 border-t border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Coworker Requests ({ride.requests.length})
                        </span>
                      </div>

                      {/* Post-Ride Fare Payment & Collection Summary Ledger for Completed Rides */}
                      {isCompleted && acceptedReqs.length > 0 && (
                        <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md border border-slate-800 my-2">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <IndianRupee className="h-4 w-4 text-emerald-400" /> Post-Ride Fare Collection Ledger
                            </span>
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                              Ride Completed
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-center">
                            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80">
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Expected Fare</span>
                              <strong className="text-base text-white font-extrabold">₹{totalExpectedFare}</strong>
                            </div>

                            <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-500/40">
                              <span className="text-[10px] text-emerald-400 uppercase font-semibold block">Total Collected</span>
                              <strong className="text-base text-emerald-300 font-extrabold">₹{totalCollected}</strong>
                            </div>

                            <div className={`p-3 rounded-xl border ${outstandingAmount > 0 ? "bg-rose-950/80 border-rose-500/40 text-rose-300" : "bg-slate-800/80 border-slate-700 text-emerald-400"}`}>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Outstanding Amount</span>
                              <strong className="text-base font-extrabold">₹{outstandingAmount}</strong>
                            </div>
                          </div>
                        </div>
                      )}

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
                                className={`p-3 text-xs space-y-2 ${
                                  isAccepted ? "bg-emerald-50/20" : isPending ? "bg-amber-50/20" : ""
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                                        <Button
                                          size="sm"
                                          onClick={() => handleOpenLiveTracking(ride, req)}
                                          className="h-7 text-[11px] bg-slate-900 text-white hover:bg-slate-800 font-semibold rounded-lg gap-1 border border-slate-700 shadow-2xs"
                                        >
                                          <Radio className="h-3 w-3 text-emerald-400 animate-pulse" /> Live Map
                                        </Button>
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

                                {/* Post-Ride Payment Status Action UI for Driver on Completed Rides */}
                                {isCompleted && isAccepted && (
                                  <div className="pt-2 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 mt-1">
                                    <div className="space-y-1 text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-700">Payment Status:</span>
                                        {req.paymentStatus === "paid" ? (
                                          <Badge className="bg-emerald-600 text-white font-bold text-[10px] px-2 py-0.5 gap-1">
                                            <CheckCircle2 className="h-3 w-3" /> Paid (₹{req.fare})
                                          </Badge>
                                        ) : req.paymentStatus === "partially_paid" ? (
                                          <Badge className="bg-amber-600 text-white font-bold text-[10px] px-2 py-0.5 gap-1">
                                            <AlertCircle className="h-3 w-3" /> Partially Paid (₹{req.amountPaid || 0})
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-rose-600 text-white font-bold text-[10px] px-2 py-0.5 gap-1">
                                            <X className="h-3 w-3" /> Not Paid (Remaining: ₹{req.fare})
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="text-[11px] text-slate-600 flex flex-wrap items-center gap-3">
                                        <span>Total Fare: <strong>₹{req.fare}</strong></span>
                                        <span>Paid: <strong className="text-emerald-700">₹{req.amountPaid || 0}</strong></span>
                                        <span>Remaining: <strong className={(req.fare - (req.amountPaid || 0)) > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>₹{Math.max(0, req.fare - (req.amountPaid || 0))}</strong></span>
                                      </div>
                                    </div>

                                    {/* Driver Fare Status Action Buttons */}
                                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                                      <Button
                                        size="sm"
                                        disabled={actionLoadingId === req._id}
                                        onClick={() => handleUpdatePaymentStatus(req._id, "paid")}
                                        className={`h-7 text-[11px] font-bold rounded-lg ${
                                          req.paymentStatus === "paid"
                                            ? "bg-emerald-700 text-white ring-2 ring-emerald-500 shadow-2xs"
                                            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300"
                                        }`}
                                      >
                                        Paid
                                      </Button>

                                      <Button
                                        size="sm"
                                        disabled={actionLoadingId === req._id}
                                        onClick={() => {
                                          setPartialPaymentModalReq(req);
                                          setPartialPaymentAmount(String(req.amountPaid || Math.round(req.fare / 2)));
                                          setPaymentModalError(null);
                                        }}
                                        className={`h-7 text-[11px] font-bold rounded-lg ${
                                          req.paymentStatus === "partially_paid"
                                            ? "bg-amber-600 text-white ring-2 ring-amber-400 shadow-2xs"
                                            : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300"
                                        }`}
                                      >
                                        Partially Paid
                                      </Button>

                                      <Button
                                        size="sm"
                                        disabled={actionLoadingId === req._id}
                                        onClick={() => handleUpdatePaymentStatus(req._id, "not_paid")}
                                        className={`h-7 text-[11px] font-bold rounded-lg ${
                                          req.paymentStatus === "not_paid" || !req.paymentStatus
                                            ? "bg-rose-700 text-white ring-2 ring-rose-500 shadow-2xs"
                                            : "bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-300"
                                        }`}
                                      >
                                        Not Paid
                                      </Button>
                                    </div>
                                  </div>
                                )}
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
                            Driver: <strong>{ride.driver?.name || "Colleague"}</strong> ({ride.driver?.companyName || "Tech Mahindra"})
                          </span>
                          {ride.driver?.phone && (
                            <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                              <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                              <a href={`tel:${ride.driver.phone}`} className="hover:underline hover:text-emerald-800">
                                {ride.driver.phone}
                              </a>
                            </span>
                          )}
                          <span>• Plate: {ride.vehicle?.registrationNumber || "Campus Vehicle"}</span>
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

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs w-full sm:w-auto">
                        {isLive && isAccepted ? (
                          <span className="whitespace-nowrap inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs animate-pulse text-center">
                            <span className="h-2 w-2 rounded-full bg-white animate-ping shrink-0" />
                            Driver is on the way (Live)
                          </span>
                        ) : (
                          <Badge
                            className={`text-[10px] font-bold justify-center ${
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
                                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                                : "bg-slate-900 hover:bg-slate-800 text-white"
                            } font-bold text-xs rounded-xl shadow-xs gap-1.5 h-8 w-full sm:w-auto`}
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
                    {isAccepted && (
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
                            {booking.boardingPin || String(1000 + (parseInt(booking._id.slice(-4), 16) % 9000))}
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

                    {/* Read-Only Post-Ride Fare Payment Status for Passengers on Completed Rides */}
                    {ride.status === "completed" && isAccepted && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <IndianRupee className="h-3.5 w-3.5 text-emerald-600" /> Fare Payment Status
                          </span>
                          <span className="text-[11px] text-slate-500">
                            Total Fare: <strong>₹{booking.fare}</strong> • Paid: <strong className="text-emerald-700">₹{booking.amountPaid || 0}</strong> • Remaining: <strong className={(booking.fare - (booking.amountPaid || 0)) > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>₹{Math.max(0, booking.fare - (booking.amountPaid || 0))}</strong>
                          </span>
                        </div>

                        <div>
                          {booking.paymentStatus === "paid" ? (
                            <Badge className="bg-emerald-600 text-white font-bold text-[10px] py-1 px-2.5 gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Paid (₹{booking.fare})
                            </Badge>
                          ) : booking.paymentStatus === "partially_paid" ? (
                            <Badge className="bg-amber-600 text-white font-bold text-[10px] py-1 px-2.5 gap-1">
                              <AlertCircle className="h-3 w-3" /> Partially Paid (₹{booking.amountPaid || 0})
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-600 text-white font-bold text-[10px] py-1 px-2.5 gap-1">
                              <X className="h-3 w-3" /> Not Paid (Remaining: ₹{booking.fare})
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

      {/* LIVE DRIVER & PASSENGER REAL-TIME GPS TRACKING MODAL */}
      <Dialog open={isLiveTrackingModalOpen} onOpenChange={setIsLiveTrackingModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          {trackingModalRide && (() => {
            const isDriverUser = session?.user?.id && liveTelemetry?.driver?._id
              ? (liveTelemetry.driver._id === session.user.id || liveTelemetry.driver === session.user.id)
              : (session?.user?.email && liveTelemetry?.driver?.email
                ? liveTelemetry.driver.email.toLowerCase() === session.user.email.toLowerCase()
                : false);

            const driverLiveLoc = liveTelemetry?.currentLocation || driverGpsPosition || resolvePlaceCoordinates(
              liveTelemetry?.startingLocation || trackingModalRide.startingLocation,
              liveTelemetry?.startLocation?.latitude || trackingModalRide.startLocation?.latitude,
              liveTelemetry?.startLocation?.longitude || trackingModalRide.startLocation?.longitude,
              true
            );

            const activePassengerReq =
              (liveTelemetry?.passengers || []).find((p: any) =>
                trackingModalBooking
                  ? p.requestId === trackingModalBooking._id ||
                    p.passenger?._id === trackingModalBooking.passenger?._id ||
                    p.passenger === trackingModalBooking.passenger
                  : true
              ) ||
              liveTelemetry?.passengers?.[0] ||
              (trackingModalRide?.requests || []).find((r: any) => r.status === "accepted") ||
              trackingModalRide?.requests?.[0];

            const passengerPickupStop =
              activePassengerReq?.pickupStop ||
              trackingModalBooking?.pickupStop ||
              "";

            // Match pickup stop string against the ride's defined route stops to get exact stop coordinates created by driver
            const matchedPickupStopObj = passengerPickupStop
              ? (trackingModalRide?.stops || []).find((s: any) => {
                  if (!s || !s.name) return false;
                  const sName = s.name.toLowerCase().trim();
                  const pStop = passengerPickupStop.toLowerCase().trim();
                  return sName === pStop || sName.includes(pStop) || pStop.includes(sName);
                })
              : null;

            const fallbackPassengerLoc = matchedPickupStopObj?.latitude
              ? { latitude: matchedPickupStopObj.latitude, longitude: matchedPickupStopObj.longitude }
              : resolvePlaceCoordinates(passengerPickupStop || "Porur", undefined, undefined, false);

            const passengerLiveLoc =
              passengerGpsPosition ||
              (activePassengerReq?.currentLocation?.latitude ? activePassengerReq.currentLocation : null) ||
              fallbackPassengerLoc;

            const driverName = liveTelemetry?.driver?.name || trackingModalRide?.driver?.name || "Driver";
            const passengerName =
              trackingModalBooking?.passenger?.name ||
              (activePassengerReq?.passenger as any)?.name ||
              activePassengerReq?.passengerName ||
              session?.user?.name ||
              "Passenger";

            const proximity = calculateProximity(driverLiveLoc, passengerLiveLoc);

            return (
              <div className="space-y-4">
                <DialogHeader className="pr-10">
                  <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
                    <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
                      Two-Way Real-Time Location Tracking
                    </DialogTitle>
                    <Badge className="bg-emerald-600 text-white font-bold text-xs">
                      {liveTelemetry?.status === "in_progress" ? "Live Commute Active" : "Accepted & Tracking"}
                    </Badge>
                  </div>
                  <DialogDescription className="text-xs text-slate-500">
                    {driverName} • {liveTelemetry?.vehicle?.vehicleModel || "Vehicle"} ({liveTelemetry?.vehicle?.registrationNumber || "Corporate Carpool"})
                  </DialogDescription>
                </DialogHeader>

                {/* Real-time Driver <-> Passenger Distance & ETA Banner (Ola/Uber/Rapido Experience) */}
                <div className="bg-slate-950 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2.5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                        {isDriverUser ? <Users className="h-4 w-4" /> : <Car className="h-4 w-4" />}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase font-bold block">
                          {isDriverUser ? `Target Passenger (${passengerName})` : `En Route Driver (${driverName})`}
                        </span>
                        <strong className="text-sm text-emerald-400 font-extrabold flex items-center gap-1.5">
                          {proximity ? (
                            <>
                              <span>{proximity.distanceText}</span>
                              <span className="text-slate-500">•</span>
                              <span>{proximity.etaText}</span>
                            </>
                          ) : passengerGpsStatus === "DENIED" ? (
                            <span className="text-amber-300 text-xs">Enable location access to use live tracking</span>
                          ) : (
                            <span className="text-slate-300 text-xs animate-pulse">Updating location...</span>
                          )}
                        </strong>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Route Commute ETA</span>
                      <strong className="text-xs text-white font-bold">
                        {liveEtaResult?.formattedDuration || `${liveTelemetry?.durationMinutes || 20} mins`}{" "}
                        {liveEtaResult?.formattedEtaTime ? `(${liveEtaResult.formattedEtaTime})` : ""}
                      </strong>
                    </div>
                  </div>

                  {/* Dynamic Proximity Breakdown Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="text-slate-300 font-medium">
                        {isDriverUser
                          ? `Tracking passenger ${passengerName}'s live GPS`
                          : `Tracking driver ${driverName}'s live GPS`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-slate-400 font-mono text-[10px]">
                      <span>🚗 Driver: {driverLiveLoc?.latitude ? "Active" : "Standard GPS"}</span>
                      <span>•</span>
                      <span>👤 Passenger: {passengerLiveLoc?.latitude ? "Active" : "Pickup Stop"}</span>
                    </div>
                  </div>
                </div>

                {/* Real-time Map with Moving Driver & Passenger Markers */}
                <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                  <MapView
                    startLocation={{
                      name: liveTelemetry?.startingLocation || trackingModalRide.startingLocation,
                      address: liveTelemetry?.startLocation?.address || trackingModalRide.startingLocation,
                      ...resolvePlaceCoordinates(
                        liveTelemetry?.startingLocation || trackingModalRide.startingLocation,
                        liveTelemetry?.startLocation?.latitude || trackingModalRide.startLocation?.latitude,
                        liveTelemetry?.startLocation?.longitude || trackingModalRide.startLocation?.longitude,
                        true
                      ),
                    }}
                    destination={{
                      name: liveTelemetry?.destination || trackingModalRide.destination,
                      address: liveTelemetry?.endLocation?.address || trackingModalRide.destination,
                      ...resolvePlaceCoordinates(
                        liveTelemetry?.destination || trackingModalRide.destination,
                        liveTelemetry?.endLocation?.latitude || trackingModalRide.endLocation?.latitude,
                        liveTelemetry?.endLocation?.longitude || trackingModalRide.endLocation?.longitude,
                        false
                      ),
                    }}
                    stops={trackingModalRide.stops?.map((s: any) => {
                      const coords = resolvePlaceCoordinates(s.name, s.latitude, s.longitude, false);
                      return {
                        name: s.name,
                        price: s.price,
                        latitude: coords.latitude,
                        longitude: coords.longitude,
                      };
                    })}
                    driverLocation={driverLiveLoc}
                    driverName={driverName}
                    driverVehicleType={liveTelemetry?.vehicle?.vehicleType || "Car"}
                    passengerLocation={passengerLiveLoc}
                    passengerName={passengerName}
                    routeCoordinates={liveEtaResult?.coordinates}
                    panToDriver={true}
                    distanceText={proximity ? proximity.distanceText : undefined}
                    durationText={proximity ? proximity.etaText : undefined}
                    trafficLevel={liveEtaResult?.trafficLevel}
                    height="450px"
                    showStats={true}
                  />
                </div>
              </div>
            );
          })()}
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

      {/* CUSTOM RIDE DELETE CONFIRMATION MODAL */}
      <Dialog open={Boolean(deleteConfirmRideId)} onOpenChange={(open) => !open && setDeleteConfirmRideId(null)}>
        <DialogContent className="sm:max-w-md bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <DialogHeader className="space-y-3 text-center sm:text-left">
            <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-8 ring-rose-50">
              <Trash2 className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Delete Commute Ride Offer?
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to delete this ride offer? Any active coworker seat requests for this route will be automatically cancelled.
              </DialogDescription>
            </div>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-slate-100 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmRideId(null)}
              disabled={isDeletingRide}
              className="rounded-xl text-xs font-semibold h-10 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDeleteRide}
              disabled={isDeletingRide}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs h-10 gap-1.5 shadow-xs"
            >
              {isDeletingRide ? (
                <span className="flex items-center justify-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  <span>Deleting Ride...</span>
                </span>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Yes, Delete Ride</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PARTIAL PAYMENT AMOUNT ENTRY MODAL FOR DRIVER */}
      {partialPaymentModalReq && (
        <Dialog open={Boolean(partialPaymentModalReq)} onOpenChange={(open) => !open && setPartialPaymentModalReq(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-6 bg-white shadow-xl border border-slate-100">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 font-bold">
                  <IndianRupee className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Record Partial Payment
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Passenger: <strong>{partialPaymentModalReq.passenger.name}</strong> • Total Fare: <strong>₹{partialPaymentModalReq.fare}</strong>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center">
                <span className="text-slate-600 font-medium">Total Commute Fare:</span>
                <strong className="text-slate-900 font-extrabold text-sm">₹{partialPaymentModalReq.fare}</strong>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Amount Paid (₹)</label>
                <Input
                  type="number"
                  min={1}
                  max={partialPaymentModalReq.fare - 1}
                  value={partialPaymentAmount}
                  onChange={(e) => {
                    setPartialPaymentAmount(e.target.value);
                    setPaymentModalError(null);
                  }}
                  placeholder={`Enter amount between ₹1 and ₹${partialPaymentModalReq.fare - 1}`}
                  className="h-10 rounded-xl border-slate-300 font-bold text-sm focus:border-amber-500"
                />
              </div>

              {/* Real-time Calculation Breakdown */}
              {partialPaymentAmount !== "" && !isNaN(Number(partialPaymentAmount)) && (
                <div className="p-3 rounded-xl text-xs space-y-1 bg-amber-50/80 border border-amber-200 text-amber-900 font-medium">
                  <div className="flex justify-between">
                    <span>Total Fare:</span>
                    <strong className="font-bold">₹{partialPaymentModalReq.fare}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-800">
                    <span>Amount Paid:</span>
                    <strong className="font-bold">₹{Number(partialPaymentAmount)}</strong>
                  </div>
                  <div className="flex justify-between text-rose-700 border-t border-amber-200/60 pt-1">
                    <span>Remaining Amount:</span>
                    <strong className="font-bold">₹{Math.max(0, partialPaymentModalReq.fare - Number(partialPaymentAmount))}</strong>
                  </div>
                </div>
              )}

              {paymentModalError && (
                <div className="text-xs text-rose-700 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{paymentModalError}</span>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPartialPaymentModalReq(null)}
                className="rounded-xl text-xs font-semibold h-9 border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isUpdatingPayment}
                onClick={() => {
                  const val = Number(partialPaymentAmount);
                  if (isNaN(val) || val <= 0) {
                    setPaymentModalError("Amount paid for Partial Payment must be greater than ₹0.");
                    return;
                  }
                  if (val >= partialPaymentModalReq.fare) {
                    setPaymentModalError(`Amount paid must be less than total fare of ₹${partialPaymentModalReq.fare}. Select 'Paid' for full payment.`);
                    return;
                  }
                  setIsUpdatingPayment(true);
                  handleUpdatePaymentStatus(partialPaymentModalReq._id, "partially_paid", val);
                }}
                className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white h-9 gap-1.5 shadow-xs"
              >
                {isUpdatingPayment ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Save Partial Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
