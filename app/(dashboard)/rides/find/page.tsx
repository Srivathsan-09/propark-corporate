"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Calendar,
  Clock,
  Car,
  Users,
  Building2,
  Phone,
  ShieldCheck,
  IndianRupee,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  Navigation,
  Sun,
  Moon,
  Map,
  Route,
  Navigation2,
  PlusCircle,
  Flame,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";
import MapView, { MapPoint } from "@/components/map/MapView";
import LocationSearchInput from "@/components/map/LocationSearchInput";
import { geocodingService } from "@/lib/services/geocoding";
import { getInitials } from "@/lib/utils";

interface IRideStop {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  price: number;
  estimatedTime?: string;
}

interface ILocationCoordinate {
  address: string;
  latitude: number;
  longitude: number;
}

interface IRide {
  _id: string;
  driver: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
    companyName?: string;
    department: string;
    phone?: string;
    profileImage?: string;
    verificationStatus?: string;
    isApproved?: boolean;
  };
  vehicle: {
    _id: string;
    vehicleModel: string;
    vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
    registrationNumber: string;
    vehiclePhoto?: string;
    seatingCapacity: number;
    availableSeats: number;
  };
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  rideType?: "pickup" | "drop";
  startingLocation: string;
  destination: string;
  startLocation?: ILocationCoordinate;
  endLocation?: ILocationCoordinate;
  distanceKm?: number;
  durationMinutes?: number;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  basePrice: number;
  stops: IRideStop[];
  notes?: string;
  status: string;
  createdAt: string;
}

export default function FindRidePage() {
  const { data: session } = useSession();

  const [rides, setRides] = useState<IRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search Filters
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterRideType, setFilterRideType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");

  // Request Booking Modal State
  const [selectedRide, setSelectedRide] = useState<IRide | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedPickupStop, setSelectedPickupStop] = useState<string>("");
  const [selectedFare, setSelectedFare] = useState<number>(100);
  const [seatsRequested, setSeatsRequested] = useState<number>(1);
  const [passengerNotes, setPassengerNotes] = useState<string>("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Custom Stop Request Mode
  const [isCustomStopMode, setIsCustomStopMode] = useState(false);
  const [customStopText, setCustomStopText] = useState("");
  const [customStopAddress, setCustomStopAddress] = useState("");
  const [customStopLat, setCustomStopLat] = useState<number>(0);
  const [customStopLng, setCustomStopLng] = useState<number>(0);
  const [isLocatingCustomStop, setIsLocatingCustomStop] = useState(false);

  // Automatically geocode typed custom stop address and locate it on map in real time
  useEffect(() => {
    if (!isCustomStopMode || !customStopText || customStopText.trim().length < 3) return;

    const timer = setTimeout(async () => {
      setIsLocatingCustomStop(true);
      try {
        const results = await geocodingService.search(customStopText.trim(), 1);
        if (results && results.length > 0) {
          const top = results[0];
          setCustomStopLat(top.latitude);
          setCustomStopLng(top.longitude);
          setCustomStopAddress(top.displayName);
        }
      } catch (err) {
        console.warn("Auto-locate custom stop failed:", err);
      } finally {
        setIsLocatingCustomStop(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [customStopText, isCustomStopMode]);

  const fetchRides = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const params = new URLSearchParams();
      if (searchOrigin) params.set("origin", searchOrigin);
      if (searchDestination) params.set("destination", searchDestination);
      if (filterType && filterType !== "all") params.set("vehicleType", filterType);
      if (filterRideType && filterRideType !== "all") params.set("rideType", filterRideType);
      if (filterDate) params.set("date", filterDate);

      const res = await fetch(`/api/rides?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRides(data.rides || []);

        // Also keep selectedRide updated in modal if open
        if (selectedRide) {
          const updatedSelected = (data.rides || []).find((r: IRide) => r._id === selectedRide._id);
          if (updatedSelected) {
            setSelectedRide(updatedSelected);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load rides:", err);
      if (!isSilent) setErrorMessage("Failed to load rides. Please check your connection.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchOrigin, searchDestination, filterType, filterRideType, filterDate, selectedRide]);

  // Initial load on filter change
  useEffect(() => {
    fetchRides();
  }, [filterType, filterRideType, filterDate]);

  // Real-time Continuous Polling (Every 5 seconds) + Focus Listener
  useEffect(() => {
    const interval = setInterval(() => {
      fetchRides(true);
    }, 5000);

    const handleFocus = () => {
      fetchRides(true);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchRides]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRides();
  };

  const handleOpenBooking = (ride: IRide) => {
    setSelectedRide(ride);
    setIsCustomStopMode(false);
    setCustomStopText("");
    setCustomStopAddress("");
    setCustomStopLat(0);
    setCustomStopLng(0);

    if (ride.stops && ride.stops.length > 0) {
      setSelectedPickupStop(ride.stops[0].name);
      setSelectedFare(ride.stops[0].price);
    } else {
      setSelectedPickupStop(ride.startingLocation);
      setSelectedFare(ride.basePrice || 100);
    }

    setSeatsRequested(1);
    setPassengerNotes("");
    setBookingSuccessMsg(null);
    setBookingErrorMsg(null);
    setIsBookingModalOpen(true);
  };

  const handleStopSelect = (stopName: string) => {
    setSelectedPickupStop(stopName);
    if (selectedRide) {
      if (stopName === selectedRide.startingLocation) {
        setSelectedFare(selectedRide.basePrice || 100);
      } else {
        const found = selectedRide.stops.find((s) => s.name === stopName);
        if (found) {
          setSelectedFare(found.price);
        }
      }
    }
  };

  const handleMapStopClick = (loc: { address: string; latitude: number; longitude: number }) => {
    if (isCustomStopMode) {
      const short = loc.address.split(",")[0].trim();
      setCustomStopText(short);
      setCustomStopAddress(loc.address);
      setCustomStopLat(loc.latitude);
      setCustomStopLng(loc.longitude);
      setSelectedPickupStop(`Custom Stop: ${short}`);
      setSelectedFare(selectedRide?.basePrice ? Math.round(selectedRide.basePrice * 0.8) : 120);
    }
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRide) return;

    setIsSubmittingBooking(true);
    setBookingErrorMsg(null);
    setBookingSuccessMsg(null);

    try {
      const requestedLocation = isCustomStopMode
        ? customStopText.trim() || (customStopAddress ? customStopAddress.split(",")[0].trim() : "Custom Boarding Stop")
        : selectedPickupStop;

      const pickupName = isCustomStopMode ? `Custom Stop: ${requestedLocation}` : selectedPickupStop;

      const res = await fetch(`/api/rides/${selectedRide._id}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupStop: pickupName,
          dropStop: selectedRide.destination,
          seatsRequested,
          fare: selectedFare * seatsRequested,
          notes: `${passengerNotes.trim()}${
            isCustomStopMode && customStopAddress ? ` [Requested Map Pin: ${customStopAddress}]` : ""
          }`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setBookingErrorMsg(data.error || "Failed to request ride.");
        setIsSubmittingBooking(false);
        return;
      }

      setBookingSuccessMsg("Ride request sent to driver! The driver will be notified to accept.");
      setTimeout(() => {
        setIsBookingModalOpen(false);
        fetchRides(true);
      }, 1500);
    } catch (err) {
      console.error("Booking error:", err);
      setBookingErrorMsg("Network error occurred. Please try again.");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Find a Campus Ride
            </h1>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Live Seats Syncing
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            Real-time seat availability, OpenStreetMap routes, and morning pickup or evening drop locations
          </p>
        </div>

        <Link href="/rides/offer">
          <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold gap-2 text-xs rounded-xl shadow-xs">
            <Car className="h-4 w-4" /> Offer a Ride Instead
          </Button>
        </Link>
      </div>

      {session?.user?.role !== "admin" && session?.user?.verificationStatus === "pending" && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-4 border border-amber-200 text-amber-900 text-xs animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block text-sm font-bold text-amber-900">Employee Account Pending Admin Verification</strong>
            Your profile has been submitted for campus security and HR admin review. You can explore available routes, and seat booking will be unlocked as soon as Admin approves your account.
          </div>
        </div>
      )}

      {/* Horizontal Search & Filter Bar */}
      <Card className="border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
        <CardContent className="p-3 sm:p-4 space-y-2.5">
          {/* Commute Direction Quick Horizontal Pills */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setFilterRideType("all");
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  filterRideType === "all"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                All Rides
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterRideType("pickup");
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                  filterRideType === "pickup"
                    ? "bg-amber-400 text-slate-950 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sun className="h-3 w-3" /> Pickup
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilterRideType("drop");
                }}
                className={`px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                  filterRideType === "drop"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Moon className="h-3 w-3" /> Drop
              </button>
            </div>

            {(searchOrigin || searchDestination || filterType !== "all" || filterRideType !== "all" || filterDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearchOrigin("");
                  setSearchDestination("");
                  setFilterType("all");
                  setFilterRideType("all");
                  setFilterDate("");
                }}
                className="text-[11px] font-semibold text-rose-600 hover:underline shrink-0 px-2"
              >
                Reset Filters
              </button>
            )}
          </div>

          {/* Unified Horizontal Search Form */}
          <form onSubmit={handleSearchSubmit}>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-2 items-center">
              {/* Origin (From) */}
              <div className="col-span-1 lg:col-span-3 relative">
                <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-emerald-600 shrink-0" />
                <Input
                  placeholder="From (e.g. Tambaram)"
                  value={searchOrigin}
                  onChange={(e) => setSearchOrigin(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Destination (To) */}
              <div className="col-span-1 lg:col-span-3 relative">
                <Building2 className="absolute left-2.5 top-2.5 h-4 w-4 text-blue-600 shrink-0" />
                <Input
                  placeholder="To (e.g. Campus)"
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Vehicle Type */}
              <div className="col-span-1 lg:col-span-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">🚗 All Vehicles</SelectItem>
                    <SelectItem value="Car">Car only</SelectItem>
                    <SelectItem value="Bike">Bike only</SelectItem>
                    <SelectItem value="SUV">SUV only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date */}
              <div className="col-span-1 lg:col-span-2 relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Search Button */}
              <div className="col-span-2 sm:col-span-2 md:col-span-4 lg:col-span-2">
                <Button
                  type="submit"
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-xs"
                >
                  <Search className="h-3.5 w-3.5" /> Search
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Available Rides Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="page" message="Finding available campus rides..." />
        </div>
      ) : rides.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No available rides found"
          description="No coworker has posted a ride matching your search criteria yet. You can post a ride or check back later."
          actionLabel="Offer a Ride"
          onAction={() => {
            window.location.href = "/rides/offer";
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rides.map((ride) => {
            const isDriver = session?.user?.id === ride.driver._id;
            const isPickup = ride.rideType !== "drop";
            const isFull = ride.availableSeats === 0;
            const isOneSeatLeft = ride.availableSeats === 1;

            return (
              <Card
                key={ride._id}
                className={`border-slate-200 bg-white hover:border-slate-300 shadow-sm rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                  isFull ? "opacity-75 bg-slate-50/50" : ""
                }`}
              >
                <div>
                  {/* Top Driver Identity & Company Header */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs">
                        {getInitials(ride.driver.name)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          {ride.driver.name}
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-emerald-800">{ride.driver.companyName || "Tech Mahindra"}</span>
                          <span>• {ride.driver.department}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={`text-[10px] font-bold ${
                          isPickup ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-indigo-100 text-indigo-900 border-indigo-300"
                        }`}
                      >
                        {isPickup ? "🌅 Pickup" : "🌆 Drop"}
                      </Badge>
                      <Badge
                        className={`text-[10px] font-bold ${
                          ride.vehicleType === "Bike" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                        }`}
                      >
                        {ride.vehicleType}
                      </Badge>
                    </div>
                  </div>

                  {/* Route & Timings Section */}
                  <CardContent className="p-4 space-y-3.5 text-xs text-slate-700">
                    {/* Origin -> Destination Box */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Origin</span>
                          <span className="font-bold text-slate-900 text-xs">{ride.startingLocation}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                        <div className="flex-1">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Destination</span>
                          <span className="font-bold text-slate-900 text-xs">{ride.destination}</span>
                        </div>
                      </div>
                    </div>

                    {/* Departure Date & Live Available Seats Row */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 block">Departure</span>
                          <span className="font-semibold text-slate-800">{ride.departureTime}</span>
                        </div>
                      </div>

                      {/* Continuous Live Seats Indicator */}
                      <div
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          isFull
                            ? "bg-rose-50 border-rose-200 text-rose-900"
                            : isOneSeatLeft
                            ? "bg-amber-50 border-amber-200 text-amber-900"
                            : "bg-emerald-50 border-emerald-200 text-emerald-900"
                        }`}
                      >
                        {isOneSeatLeft ? (
                          <Flame className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
                        ) : (
                          <Users className="h-4 w-4 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <span className="text-[10px] text-slate-500 block">Live Seats</span>
                          <span className="font-bold">
                            {isFull
                              ? "0 Left (Full)"
                              : isOneSeatLeft
                              ? "🔥 1 Seat Left!"
                              : `${ride.availableSeats} of ${ride.totalSeats} Left`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Distance & Duration if available */}
                    {ride.distanceKm ? (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <span className="flex items-center gap-1">
                          <Navigation2 className="h-3.5 w-3.5 text-emerald-600" />
                          Distance: <strong className="text-slate-800">{ride.distanceKm} km</strong>
                        </span>
                        <span>
                          Est. Duration: <strong className="text-emerald-700">{ride.durationMinutes} mins</strong>
                        </span>
                      </div>
                    ) : null}

                    {/* Vehicle Details */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Vehicle</span>
                        <span className="font-semibold text-slate-800">{ride.vehicle.vehicleModel}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Plate</span>
                        <span className="font-mono text-[11px] font-bold text-slate-700">{ride.vehicle.registrationNumber}</span>
                      </div>
                    </div>

                    {/* Stops & Pricing Pills */}
                    {ride.stops && ride.stops.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                          Route {isPickup ? "Pickup Points" : "Drop Points"} & Fares
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ride.stops.map((stop, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                            >
                              <span>{stop.name}:</span>
                              <span className="text-emerald-700">₹{stop.price}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Driver Contact & Notes */}
                    {ride.driver.phone && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-1">
                        <Phone className="h-3 w-3 text-slate-400" />
                        <span>Driver Contact: <strong className="text-slate-700">{ride.driver.phone}</strong></span>
                      </div>
                    )}

                    {ride.notes && (
                      <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                        &ldquo;{ride.notes}&rdquo;
                      </p>
                    )}
                  </CardContent>
                </div>

                {/* Footer Action */}
                <CardFooter className="p-4 border-t border-slate-100 bg-slate-50/50">
                  {isDriver ? (
                    <Badge variant="outline" className="w-full justify-center py-2 text-xs font-semibold text-slate-500">
                      You are the driver of this ride
                    </Badge>
                  ) : isFull ? (
                    <Button
                      disabled
                      className="w-full bg-slate-200 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed"
                    >
                      Ride Fully Booked (0 Seats Left)
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleOpenBooking(ride)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs gap-1.5"
                    >
                      <Map className="h-3.5 w-3.5" /> Select {isPickup ? "Pickup Point" : "Drop Point"} & Book
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* BOOKING / ROUTE MAP MODAL */}
      <Dialog open={isBookingModalOpen} onOpenChange={setIsBookingModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedRide && (
            <form onSubmit={handleSubmitBooking}>
              <DialogHeader className="pr-10">
                <div className="flex flex-wrap items-center justify-between gap-2 pr-2">
                  <DialogTitle className="text-lg font-bold text-slate-900">
                    Ride Route with {selectedRide.driver.name}
                  </DialogTitle>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-600 text-white font-bold text-xs">
                      {selectedRide.availableSeats} of {selectedRide.totalSeats} Seats Left
                    </Badge>
                    <Badge className="bg-slate-900 text-white font-bold text-xs">
                      {selectedRide.vehicleType}
                    </Badge>
                  </div>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  {selectedRide.driver.companyName} • {selectedRide.vehicle.vehicleModel} ({selectedRide.vehicle.registrationNumber})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-3 text-xs">
                {/* Embedded Interactive Route Map */}
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <MapView
                    startLocation={{
                      name: selectedRide.startingLocation,
                      address: selectedRide.startLocation?.address || selectedRide.startingLocation,
                      latitude: selectedRide.startLocation?.latitude || 12.9249,
                      longitude: selectedRide.startLocation?.longitude || 80.1332,
                    }}
                    destination={{
                      name: selectedRide.destination,
                      address: selectedRide.endLocation?.address || selectedRide.destination,
                      latitude: selectedRide.endLocation?.latitude || 12.8988,
                      longitude: selectedRide.endLocation?.longitude || 80.2284,
                    }}
                    stops={selectedRide.stops.map((s) => ({
                      name: s.name,
                      address: s.address || s.name,
                      latitude: s.latitude || 12.95,
                      longitude: s.longitude || 80.18,
                      price: s.price,
                    }))}
                    customPickupPoint={
                      isCustomStopMode && customStopLat && customStopLng
                        ? {
                            name: customStopText || "Custom Stop",
                            address: customStopAddress || customStopText,
                            latitude: customStopLat,
                            longitude: customStopLng,
                          }
                        : null
                    }
                    onMapClick={handleMapStopClick}
                    isClickPicking={isCustomStopMode}
                    clickPickLabel="Click anywhere along the route on map to request a custom pickup point"
                    height="230px"
                    distanceText={selectedRide.distanceKm ? `${selectedRide.distanceKm} km` : undefined}
                    durationText={selectedRide.durationMinutes ? `${selectedRide.durationMinutes} mins` : undefined}
                  />
                </div>

                {bookingSuccessMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{bookingSuccessMsg}</span>
                  </div>
                )}

                {bookingErrorMsg && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 text-rose-800 border border-rose-200">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>{bookingErrorMsg}</span>
                  </div>
                )}

                {/* Stop Selection Mode Toggle */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Boarding / Pickup Stop
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomStopMode(!isCustomStopMode);
                        if (!isCustomStopMode) {
                          setSelectedPickupStop(customStopText ? `Custom Stop: ${customStopText}` : "Custom Boarding Point");
                          setSelectedFare(selectedRide.basePrice ? Math.round(selectedRide.basePrice * 0.8) : 120);
                        } else {
                          setSelectedPickupStop(selectedRide.startingLocation);
                          setSelectedFare(selectedRide.basePrice || 100);
                        }
                      }}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline"
                    >
                      {isCustomStopMode ? (
                        <>
                          <Check className="h-3.5 w-3.5" /> Choose from standard route stops
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-3.5 w-3.5" /> Request custom stop / type address
                        </>
                      )}
                    </button>
                  </div>

                  {!isCustomStopMode ? (
                    <Select value={selectedPickupStop} onValueChange={handleStopSelect}>
                      <SelectTrigger className="rounded-xl text-xs h-10">
                        <SelectValue placeholder="Choose boarding stop" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={selectedRide.startingLocation}>
                          {selectedRide.startingLocation} (Origin) — ₹{selectedRide.basePrice || 100}
                        </SelectItem>
                        {selectedRide.stops?.map((stop, idx) => (
                          <SelectItem key={idx} value={stop.name}>
                            {stop.name} (Stop {idx + 1}) — ₹{stop.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-300 text-xs space-y-2.5 animate-in fade-in-50">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-950 block">Request Custom Boarding Point</span>
                        <span className="text-[10px] text-emerald-800 bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-semibold">
                          Custom Stop Mode
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="customStopInput" className="text-[11px] font-semibold text-slate-700 block">
                            Type Your Boarding Landmark, Junction, or Street:
                          </Label>
                          {isLocatingCustomStop && (
                            <span className="text-[10px] text-emerald-700 flex items-center gap-1 font-medium">
                              <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
                              Locating on map...
                            </span>
                          )}
                        </div>
                        <LocationSearchInput
                          id="customStopInput"
                          placeholder="Search or type address (e.g. Pallavaram, Chromepet Signal...)"
                          value={customStopText}
                          onChange={(loc) => {
                            const short = loc.address.split(",")[0].trim();
                            setCustomStopText(short);
                            setCustomStopAddress(loc.address);
                            setCustomStopLat(loc.latitude);
                            setCustomStopLng(loc.longitude);
                            setSelectedPickupStop(`Custom Stop: ${short}`);
                            setSelectedFare(selectedRide?.basePrice ? Math.round(selectedRide.basePrice * 0.8) : 120);
                          }}
                        />
                      </div>

                      <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>Tip: You can also tap anywhere along the route on the map above to auto-pin your stop.</span>
                      </p>

                      {customStopAddress && (
                        <div className="text-[10px] text-emerald-900 bg-white/90 p-2 rounded-lg border border-emerald-200 font-mono flex items-center justify-between gap-2">
                          <span className="truncate">📍 Located Pin: {customStopAddress}</span>
                          <span className="shrink-0 text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">
                            Pinned on Map
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Seats Needed & Estimated Total Fare */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-slate-700">
                        Seats Needed
                      </Label>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        Max: {selectedRide.availableSeats}
                      </span>
                    </div>
                    <Input
                      type="number"
                      min={1}
                      max={selectedRide.availableSeats}
                      value={Math.min(seatsRequested, selectedRide.availableSeats)}
                      onChange={(e) =>
                        setSeatsRequested(
                          Math.min(parseInt(e.target.value) || 1, selectedRide.availableSeats)
                        )
                      }
                      className="rounded-xl text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Estimated Total Fare
                    </Label>
                    <div className="h-9 flex items-center px-3 bg-emerald-50 rounded-xl border border-emerald-200 font-bold text-emerald-800 text-sm">
                      ₹{selectedFare * Math.min(seatsRequested, selectedRide.availableSeats)}
                    </div>
                  </div>
                </div>

                {/* Optional Note to Driver */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Message / Landmark for Driver (Optional)
                  </Label>
                  <Input
                    placeholder="e.g. Waiting near Metro Exit 2 in blue shirt"
                    value={passengerNotes}
                    onChange={(e) => setPassengerNotes(e.target.value)}
                    className="rounded-xl text-xs"
                  />
                </div>

                {/* Warning for unapproved employee */}
                {session?.user?.role !== "admin" && (!session?.user?.isApproved && session?.user?.verificationStatus === "pending") && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-amber-900 text-xs animate-in fade-in-50">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold">Account Pending Admin Approval</strong>
                      Your employee account is awaiting approval by Admin (Vathsan). You will be able to send ride requests to drivers once approved.
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBookingModalOpen(false)}
                  disabled={isSubmittingBooking}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs gap-1.5"
                  disabled={
                    isSubmittingBooking ||
                    selectedRide.availableSeats === 0 ||
                    (session?.user?.role !== "admin" &&
                      (!session?.user?.isApproved && session?.user?.verificationStatus === "pending"))
                  }
                >
                  {isSubmittingBooking ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <CarLoader size="inline" showRoad={false} carColor="#ffffff" className="w-8 h-4 scale-75 inline-flex" />
                      <span>Sending Request...</span>
                    </span>
                  ) : session?.user?.role !== "admin" &&
                    (!session?.user?.isApproved && session?.user?.verificationStatus === "pending") ? (
                    "🔒 Awaiting Admin Approval"
                  ) : (
                    <>
                      <CheckCircle className="h-3.5 w-3.5" /> Send Request to Driver
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
