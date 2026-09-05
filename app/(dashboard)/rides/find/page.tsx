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
  User,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
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
import { EmployeeProfileModal } from "@/components/common/EmployeeProfileModal";
import MapView, { MapPoint, DriverLivePoint } from "@/components/map/MapView";
import LocationSearchInput from "@/components/map/LocationSearchInput";
import { geocodingService, resolvePlaceCoordinates } from "@/lib/services/geocoding";
import { locationService } from "@/lib/services/location";
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
  currentLocation?: DriverLivePoint | null;
  createdAt: string;
}

export default function FindRidePage() {
  const { data: session } = useSession();

  const [rides, setRides] = useState<IRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Expandable Ride Details State
  const [expandedRideIds, setExpandedRideIds] = useState<Record<string, boolean>>({});

  const toggleRideDetails = (rideId: string) => {
    setExpandedRideIds((prev) => ({
      ...prev,
      [rideId]: !prev[rideId],
    }));
  };

  // Search Filters with Confirmed Coordinates
  const [originLocation, setOriginLocation] = useState<{
    name?: string;
    address: string;
    latitude: number;
    longitude: number;
    isConfirmed?: boolean;
  }>({ address: "", latitude: 0, longitude: 0, isConfirmed: false });

  const [destinationLocation, setDestinationLocation] = useState<{
    name?: string;
    address: string;
    latitude: number;
    longitude: number;
    isConfirmed?: boolean;
  }>({ address: "", latitude: 0, longitude: 0, isConfirmed: false });

  const [filterType, setFilterType] = useState<string>("all");
  const [filterRideType, setFilterRideType] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<string>("");
  const [filterTime, setFilterTime] = useState<string>("");
  const [filterMinSeats, setFilterMinSeats] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"earliest" | "nearest_pickup" | "most_seats">("earliest");

  // Geolocation for Nearest Pickup sorting
  const [userGps, setUserGps] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [showLocationPromptModal, setShowLocationPromptModal] = useState(false);

  const requestUserGps = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setShowLocationPromptModal(true);
      return null;
    }

    setIsLocatingUser(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserGps(coords);
          setShowLocationPromptModal(false);
          setIsLocatingUser(false);
          resolve(coords);
        },
        (err) => {
          console.warn("Geolocation permission error:", err);
          setShowLocationPromptModal(true);
          setIsLocatingUser(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }, []);

  const handleSortChange = async (newSort: "earliest" | "nearest_pickup" | "most_seats") => {
    if (newSort === "nearest_pickup") {
      if (!userGps) {
        const coords = await requestUserGps();
        if (!coords) {
          setShowLocationPromptModal(true);
          return;
        }
      }
    }
    setSortBy(newSort);
  };

  const calculateHaversineDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getRidePickupDistanceKm = useCallback(
    (ride: IRide, userCoord: { latitude: number; longitude: number }): number => {
      const pickupLat =
        ride.startLocation?.latitude ||
        resolvePlaceCoordinates(ride.startingLocation, undefined, undefined, true).latitude;
      const pickupLng =
        ride.startLocation?.longitude ||
        resolvePlaceCoordinates(ride.startingLocation, undefined, undefined, true).longitude;
      return calculateHaversineDistanceKm(userCoord.latitude, userCoord.longitude, pickupLat, pickupLng);
    },
    []
  );

  // Request Booking Modal State
  const [selectedRide, setSelectedRide] = useState<IRide | null>(null);
  const selectedRideRef = useRef<IRide | null>(null);
  selectedRideRef.current = selectedRide;
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedPickupStop, setSelectedPickupStop] = useState<string>("");
  const [selectedDropStop, setSelectedDropStop] = useState<string>("");
  const [selectedFare, setSelectedFare] = useState<number>(100);
  const [seatsRequested, setSeatsRequested] = useState<number | "">(1);
  const [passengerNotes, setPassengerNotes] = useState<string>("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);
  const [bookingErrorMsg, setBookingErrorMsg] = useState<string | null>(null);

  // Employee Profile Inspection Modal State
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileFallback, setViewProfileFallback] = useState<any | null>(null);

  // Live GPS Tracking Modal State for Passengers
  const [liveTrackingRide, setLiveTrackingRide] = useState<IRide | null>(null);
  const [isLiveTrackingModalOpen, setIsLiveTrackingModalOpen] = useState(false);
  const hasDynamicReroutedRef = useRef(false);
  const [liveTelemetry, setLiveTelemetry] = useState<any>(null);
  const [liveEtaResult, setLiveEtaResult] = useState<any>(null);

  // Poll live driver telemetry when live tracking modal is open
  useEffect(() => {
    if (!isLiveTrackingModalOpen || !liveTrackingRide) return;

    const fetchTelemetry = async () => {
      try {
        const res = await fetch(`/api/rides/${liveTrackingRide._id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.ride) {
            setLiveTelemetry(data.ride);
          }
        }
      } catch (err) {
        console.warn("Failed to fetch live telemetry:", err);
      }
    };

    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 5000);
    return () => clearInterval(interval);
  }, [isLiveTrackingModalOpen, liveTrackingRide]);

  // Recalculate Live ETA periodically while tracking modal is open
  useEffect(() => {
    if (!isLiveTrackingModalOpen || !liveTrackingRide) return;

    const updateLiveEta = async () => {
      const { routingService } = await import("@/lib/services/routing");
      const driverLoc = liveTelemetry?.currentLocation;

      let startPt = resolvePlaceCoordinates(
        liveTelemetry?.startingLocation || liveTrackingRide.startingLocation,
        liveTelemetry?.startLocation?.latitude || liveTrackingRide.startLocation?.latitude,
        liveTelemetry?.startLocation?.longitude || liveTrackingRide.startLocation?.longitude,
        true
      );

      if (hasDynamicReroutedRef.current && driverLoc?.latitude && driverLoc?.longitude) {
        startPt = { latitude: driverLoc.latitude, longitude: driverLoc.longitude };
      }

      const endPt = resolvePlaceCoordinates(
        liveTelemetry?.destination || liveTrackingRide.destination,
        liveTelemetry?.endLocation?.latitude || liveTrackingRide.endLocation?.latitude,
        liveTelemetry?.endLocation?.longitude || liveTrackingRide.endLocation?.longitude,
        false
      );

      const result = await routingService.calculateRoute(
        [startPt, endPt],
        liveTrackingRide.departureTime,
        driverLoc ? { latitude: driverLoc.latitude, longitude: driverLoc.longitude, speed: (driverLoc as any).speed } : null
      );
      if (result) {
        setLiveEtaResult(result);
      }
    };

    updateLiveEta();
    const interval = setInterval(updateLiveEta, 10000);
    return () => clearInterval(interval);
  }, [isLiveTrackingModalOpen, liveTrackingRide, liveTelemetry]);

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
      const originQuery = originLocation.name || originLocation.address;
      const destQuery = destinationLocation.name || destinationLocation.address;

      if (originQuery && originQuery.trim()) params.set("origin", originQuery.trim());
      if (destQuery && destQuery.trim()) params.set("destination", destQuery.trim());
      if (filterType && filterType !== "all") params.set("vehicleType", filterType);
      if (filterRideType && filterRideType !== "all") params.set("rideType", filterRideType);
      if (filterDate) params.set("date", filterDate);
      if (filterMinSeats && filterMinSeats !== "all") params.set("minSeats", filterMinSeats);

      const res = await fetch(`/api/rides?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRides(data.rides || []);

        // Also keep selectedRide updated in modal if open
        if (selectedRideRef.current) {
          const updatedSelected = (data.rides || []).find((r: IRide) => r._id === selectedRideRef.current?._id);
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
  }, [originLocation, destinationLocation, filterType, filterRideType, filterDate, filterMinSeats]);

  // Initial load on filter change
  useEffect(() => {
    fetchRides();
  }, [filterType, filterRideType, filterDate, filterMinSeats]);

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

  // Real-time Driver GPS Telemetry Polling (Every 3 seconds when booking modal is open)
  useEffect(() => {
    if (!isBookingModalOpen || !selectedRide?._id) return;

    const pollDriverLocation = async () => {
      try {
        const res = await fetch(`/api/rides/${selectedRide._id}/location`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setSelectedRide((prev) =>
              prev
                ? {
                    ...prev,
                    currentLocation: data.currentLocation || prev.currentLocation,
                    status: data.status || prev.status,
                  }
                : null
            );
          }
        }
      } catch (err) {
        console.warn("Polling driver location error:", err);
      }
    };

    pollDriverLocation();
    const timer = setInterval(pollDriverLocation, 3000);
    return () => clearInterval(timer);
  }, [isBookingModalOpen, selectedRide?._id]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRides();
  };

  // Filter & Sort rides client-side after fetching
  const sortedAndFilteredRides = React.useMemo(() => {
    let list = [...rides];

    // 1. Filter by minimum available seats
    if (filterMinSeats !== "all") {
      const minSeats = parseInt(filterMinSeats, 10);
      if (!isNaN(minSeats)) {
        list = list.filter((r) => r.availableSeats >= minSeats);
      }
    }

    // 2. Filter by time window if filterTime is provided (+/- 120 mins)
    if (filterTime) {
      const [filterH, filterM] = filterTime.split(":").map((x) => parseInt(x, 10));
      if (!isNaN(filterH) && !isNaN(filterM)) {
        const filterMinutes = filterH * 60 + filterM;
        list = list.filter((r) => {
          if (!r.departureTime) return true;
          const timeMatch = r.departureTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (!timeMatch) return true;
          let h = parseInt(timeMatch[1], 10);
          const m = parseInt(timeMatch[2], 10);
          const mer = timeMatch[3]?.toUpperCase();
          if (mer === "PM" && h < 12) h += 12;
          if (mer === "AM" && h === 12) h = 0;
          const rideMinutes = h * 60 + m;
          return Math.abs(rideMinutes - filterMinutes) <= 120;
        });
      }
    }

    // 3. Sort by requested ordering
    if (sortBy === "most_seats") {
      list.sort((a, b) => b.availableSeats - a.availableSeats);
    } else if (sortBy === "nearest_pickup" && userGps) {
      list.sort((a, b) => {
        const distA = getRidePickupDistanceKm(a, userGps);
        const distB = getRidePickupDistanceKm(b, userGps);
        return distA - distB;
      });
    } else {
      // Default: "earliest" (Earliest Departure)
      list.sort((a, b) => {
        if (a.departureDate !== b.departureDate) {
          return a.departureDate.localeCompare(b.departureDate);
        }
        const parseMinutes = (tStr: string) => {
          const match = (tStr || "").match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (!match) return 0;
          let h = parseInt(match[1], 10);
          const m = parseInt(match[2], 10);
          const mer = match[3]?.toUpperCase();
          if (mer === "PM" && h < 12) h += 12;
          if (mer === "AM" && h === 12) h = 0;
          return h * 60 + m;
        };
        return parseMinutes(a.departureTime) - parseMinutes(b.departureTime);
      });
    }

    return list;
  }, [rides, filterMinSeats, filterTime, sortBy, userGps, getRidePickupDistanceKm]);

  const hasActiveFilters = Boolean(
    originLocation.address ||
      destinationLocation.address ||
      filterDate ||
      filterTime ||
      filterType !== "all" ||
      filterRideType !== "all" ||
      filterMinSeats !== "all" ||
      sortBy !== "earliest"
  );

  const handleResetFilters = () => {
    setOriginLocation({ address: "", latitude: 0, longitude: 0, isConfirmed: false });
    setDestinationLocation({ address: "", latitude: 0, longitude: 0, isConfirmed: false });
    setFilterDate("");
    setFilterTime("");
    setFilterType("all");
    setFilterRideType("all");
    setFilterMinSeats("all");
    setSortBy("earliest");
  };

  const calculateFareForStops = (
    ride: IRide,
    pickupName: string,
    dropName: string,
    isCustom: boolean = false
  ): number => {
    if (isCustom) {
      return ride.basePrice ? Math.round(ride.basePrice * 0.8) : 120;
    }
    const basePrice = ride.basePrice || 100;
    const stops = ride.stops || [];

    // Helper to get cumulative price from origin to this stop
    const getStopCumulativePrice = (name: string): number => {
      if (name === ride.startingLocation) return 0;
      if (name === ride.destination) return basePrice;
      const found = stops.find((s) => s.name === name);
      return found ? found.price : basePrice;
    };

    if (pickupName === ride.startingLocation && dropName === ride.destination) {
      return basePrice;
    }

    const pPrice = getStopCumulativePrice(pickupName);
    const dPrice = getStopCumulativePrice(dropName);

    const diff = dPrice - pPrice;
    if (diff > 0) {
      return diff;
    } else if (diff < 0) {
      return Math.abs(diff);
    }
    return Math.max(20, Math.round(basePrice / Math.max(1, stops.length + 1)));
  };

  const handleOpenBooking = (ride: IRide) => {
    setSelectedRide(ride);
    setIsCustomStopMode(false);
    setCustomStopText("");
    setCustomStopAddress("");
    setCustomStopLat(0);
    setCustomStopLng(0);

    // Default: Origin to Destination (Full commute)
    setSelectedPickupStop(ride.startingLocation);
    setSelectedDropStop(ride.destination);
    setSelectedFare(ride.basePrice || 100);

    setSeatsRequested(1);
    setPassengerNotes("");
    setBookingSuccessMsg(null);
    setBookingErrorMsg(null);
    setIsBookingModalOpen(true);
  };

  // Available Drop-off stops: only subsequent stops after the selected pickup stop, plus destination
  const availableDropStops = React.useMemo(() => {
    if (!selectedRide) return [];
    const stops = selectedRide.stops || [];

    if (!selectedPickupStop || selectedPickupStop === selectedRide.startingLocation || isCustomStopMode) {
      return [
        ...stops.map((s, idx) => ({
          name: s.name,
          price: s.price,
          label: `${s.name.split(",")[0].trim()} (Stop ${idx + 1}) — ₹${s.price}`,
        })),
        {
          name: selectedRide.destination,
          price: selectedRide.basePrice || 100,
          label: `${selectedRide.destination.split(",")[0].trim()} (Destination) — ₹${selectedRide.basePrice || 100}`,
        },
      ];
    }

    const pickupIdx = stops.findIndex((s) => s.name === selectedPickupStop);
    const subsequentStops = pickupIdx === -1 ? stops : stops.slice(pickupIdx + 1);

    return [
      ...subsequentStops.map((s, idx) => ({
        name: s.name,
        price: s.price,
        label: `${s.name.split(",")[0].trim()} (Stop ${pickupIdx + 2 + idx}) — ₹${s.price}`,
      })),
      {
        name: selectedRide.destination,
        price: selectedRide.basePrice || 100,
        label: `${selectedRide.destination.split(",")[0].trim()} (Destination) — ₹${selectedRide.basePrice || 100}`,
      },
    ];
  }, [selectedRide, selectedPickupStop, isCustomStopMode]);

  const handlePickupSelect = (stopName: string) => {
    setSelectedPickupStop(stopName);
    if (selectedRide) {
      const stops = selectedRide.stops || [];
      const pickupIdx = stops.findIndex((s) => s.name === stopName);
      let dropToUse = selectedDropStop;

      if (pickupIdx !== -1) {
        const dropIdx = stops.findIndex((s) => s.name === selectedDropStop);
        if (selectedDropStop === selectedRide.startingLocation || (dropIdx !== -1 && dropIdx <= pickupIdx)) {
          dropToUse = selectedRide.destination;
          setSelectedDropStop(selectedRide.destination);
        }
      }

      const fare = calculateFareForStops(
        selectedRide,
        stopName,
        dropToUse || selectedRide.destination,
        false
      );
      setSelectedFare(fare);
    }
  };

  const handleDropSelect = (stopName: string) => {
    setSelectedDropStop(stopName);
    if (selectedRide) {
      const fare = calculateFareForStops(
        selectedRide,
        selectedPickupStop || selectedRide.startingLocation,
        stopName,
        isCustomStopMode
      );
      setSelectedFare(fare);
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
      if (selectedRide) {
        setSelectedFare(
          calculateFareForStops(
            selectedRide,
            `Custom Stop: ${short}`,
            selectedDropStop || selectedRide.destination,
            true
          )
        );
      }
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
      const dropName = selectedDropStop || selectedRide.destination;

      if (pickupName === dropName && !isCustomStopMode) {
        setBookingErrorMsg("Pickup and drop-off locations cannot be identical. Please choose different stops.");
        setIsSubmittingBooking(false);
        return;
      }

      const actualSeats = typeof seatsRequested === "number" ? Math.max(1, seatsRequested) : 1;

      // Capture passenger's actual current GPS location snapshot at booking time
      let currentLocation: { latitude: number; longitude: number; heading?: number; speed?: number; accuracy?: number } | null = null;
      try {
        const pos = await locationService.getCurrentPosition();
        if (pos && pos.latitude && pos.longitude) {
          currentLocation = {
            latitude: pos.latitude,
            longitude: pos.longitude,
            heading: pos.heading || undefined,
            speed: pos.speed || undefined,
            accuracy: pos.accuracy || undefined,
          };
        }
      } catch (e) {
        console.warn("Could not capture passenger GPS snapshot during booking:", e);
      }

      const res = await fetch(`/api/rides/${selectedRide._id}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickupStop: pickupName,
          dropStop: dropName,
          seatsRequested: actualSeats,
          fare: selectedFare * actualSeats,
          currentLocation,
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
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Row 1: Primary Search Form with Smart Typo-Tolerant Autocomplete */}
          <form onSubmit={handleSearchSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-2.5 items-center">
              {/* Origin (From) with Smart Autocomplete */}
              <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4">
                <LocationSearchInput
                  placeholder="From (e.g. Porur, Poonamallee)"
                  value={originLocation.address}
                  onChange={(loc) => setOriginLocation(loc)}
                  showCurrentLocation={false}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Destination (To) with Smart Autocomplete */}
              <div className="col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-3">
                <LocationSearchInput
                  placeholder="To (e.g. Tech Park, Taramani)"
                  value={destinationLocation.address}
                  onChange={(loc) => setDestinationLocation(loc)}
                  showCurrentLocation={false}
                  className="h-9 text-xs rounded-xl"
                />
              </div>

              {/* Date */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-2 relative">
                <Calendar className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Time */}
              <div className="col-span-1 sm:col-span-1 md:col-span-1 lg:col-span-2 relative">
                <Clock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                  type="time"
                  value={filterTime}
                  onChange={(e) => setFilterTime(e.target.value)}
                  className="pl-8 h-9 text-xs rounded-xl"
                />
              </div>

              {/* Search Button */}
              <div className="col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1">
                <Button
                  type="submit"
                  className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1 shadow-xs"
                >
                  <Search className="h-3.5 w-3.5" /> Search
                </Button>
              </div>
            </div>
          </form>

          {/* Row 2: Secondary Filter & Sort Controls */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Commute Direction Quick Horizontal Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFilterRideType("all")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    filterRideType === "all"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All Rides
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRideType("pickup")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                    filterRideType === "pickup"
                      ? "bg-amber-400 text-slate-950 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Sun className="h-3 w-3" /> Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setFilterRideType("drop")}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 transition-all ${
                    filterRideType === "drop"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Moon className="h-3 w-3" /> Drop
                </button>
              </div>

              {/* Vehicle Type Filter */}
              <div className="w-32">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-slate-50 border-slate-200">
                    <SelectValue placeholder="All Vehicles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vehicles</SelectItem>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Available Seats Filter */}
              <div className="w-32">
                <Select value={filterMinSeats} onValueChange={setFilterMinSeats}>
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Seats: All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Seats: All</SelectItem>
                    <SelectItem value="1">1+ Seats</SelectItem>
                    <SelectItem value="2">2+ Seats</SelectItem>
                    <SelectItem value="3">3+ Seats</SelectItem>
                    <SelectItem value="4">4+ Seats</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort By Filter */}
              <div className="w-44">
                <Select
                  value={sortBy}
                  onValueChange={(val: any) => handleSortChange(val)}
                >
                  <SelectTrigger className="h-8 text-xs rounded-xl bg-slate-50 border-slate-200 font-medium">
                    <SelectValue placeholder="Sort: Earliest Departure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earliest">Sort: Earliest Departure</SelectItem>
                    <SelectItem value="nearest_pickup">
                      Sort: Nearest Pickup
                    </SelectItem>
                    <SelectItem value="most_seats">Sort: Most Available Seats</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reset Filters Action */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline shrink-0 px-2 flex items-center gap-1"
              >
                Reset Filters
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Count and Sort Feedback Bar */}
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 font-medium px-1">
        <div>
          <span className="font-bold text-slate-900 text-sm">{sortedAndFilteredRides.length}</span>{" "}
          {sortedAndFilteredRides.length === 1 ? "ride found" : "rides found"}
          {hasActiveFilters && <span className="ml-1.5 text-slate-400 font-normal">(filtered)</span>}
        </div>

        {sortBy === "nearest_pickup" && userGps && (
          <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 text-[11px] font-semibold">
            <Navigation className="h-3 w-3 text-emerald-600" />
            Sorted by closest pickup to your GPS location
          </div>
        )}
      </div>

      {/* Available Rides Grid */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="page" message="Finding available campus rides..." />
        </div>
      ) : sortedAndFilteredRides.length === 0 ? (
        <EmptyState
          icon={Car}
          title="No rides found for your selected criteria"
          description={
            hasActiveFilters
              ? "No rides match your specific origin, destination, time window, or seat filters. Try adjusting your departure time, choosing a broader pickup location, lowering the seat count, or resetting filters."
              : "No coworker has posted a ride matching your campus yet. You can offer a ride or check back later."
          }
          actionLabel={hasActiveFilters ? "Reset Filters" : "Offer a Ride"}
          onAction={() => {
            if (hasActiveFilters) {
              handleResetFilters();
            } else {
              window.location.href = "/rides/offer";
            }
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAndFilteredRides.map((ride) => {
            const isDriver = session?.user?.id === ride.driver._id;
            const isPickup = ride.rideType !== "drop";
            const isFull = ride.availableSeats === 0;
            const isOneSeatLeft = ride.availableSeats === 1;
            const isExpanded = !!expandedRideIds[ride._id];

            return (
              <Card
                key={ride._id}
                className={`border-slate-200 bg-white hover:border-slate-300 shadow-sm rounded-2xl overflow-hidden transition-all flex flex-col justify-between ${
                  isFull ? "opacity-75 bg-slate-50/50" : ""
                }`}
              >
                <div>
                  {/* Top Driver Identity & Company Header */}
                  <div className="p-4 bg-slate-50/80 border-b border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs shadow-xs overflow-hidden">
                          {ride.driver.profileImage ? (
                            <img
                              src={ride.driver.profileImage}
                              alt={ride.driver.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(ride.driver.name)
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 truncate">
                            <span className="truncate">{ride.driver.name}</span>
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 truncate">
                            <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="font-semibold text-emerald-800 truncate">{ride.driver.companyName || "Tech Mahindra"}</span>
                            <span className="truncate">• {ride.driver.department}</span>
                          </div>
                          {ride.driver.phone && (
                            <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                              <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                              <a href={`tel:${ride.driver.phone}`} className="hover:underline hover:text-emerald-800">
                                {ride.driver.phone}
                              </a>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setViewProfileUserId(ride.driver._id);
                              setViewProfileFallback(ride.driver);
                            }}
                            className="text-[10px] font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 mt-0.5 hover:underline transition-colors"
                          >
                            <User className="h-2.5 w-2.5" /> View Profile
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPickup ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 whitespace-nowrap">
                            Pickup
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 whitespace-nowrap">
                            Drop
                          </span>
                        )}
                        <Badge
                          className={`text-[10px] font-bold whitespace-nowrap ${
                            ride.vehicleType === "Bike" ? "bg-blue-600 text-white" : "bg-emerald-600 text-white"
                          }`}
                        >
                          {ride.vehicleType}
                        </Badge>
                      </div>
                    </div>

                    {/* Dedicated Live En-Route Status Ribbon */}
                    {ride.status === "in_progress" && (
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-xs animate-in fade-in-50">
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-2 w-2 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                          </div>
                          <span className="font-extrabold text-[11px] tracking-wide">
                            RIDE STARTED • DRIVER EN-ROUTE
                          </span>
                        </div>
                        <span className="text-[10px] font-bold bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full text-white shrink-0">
                          Live GPS
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Route & Timings Section */}
                  <CardContent className="p-4 space-y-3.5 text-xs text-slate-700">
                    {/* Live Started Ride Banner for Passengers */}
                    {ride.status === "in_progress" && (
                      <div className="bg-slate-900 text-white p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-md border border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex h-3 w-3 shrink-0">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                          </div>
                          <div>
                            <span className="font-bold text-xs text-white block">Driver Has Started The Ride!</span>
                            <span className="text-[10px] text-emerald-300">Live GPS position is broadcasting</span>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            setLiveTrackingRide(ride);
                            setIsLiveTrackingModalOpen(true);
                          }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[11px] h-8 px-3 rounded-lg gap-1.5 shadow-xs whitespace-nowrap ml-auto"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Track Driver Live GPS
                        </Button>
                      </div>
                    )}
                    {/* Origin -> Destination Box */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Origin</span>
                            {userGps && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 flex items-center gap-0.5">
                                <Navigation className="h-2.5 w-2.5 text-emerald-600" />
                                {(() => {
                                  const dist = getRidePickupDistanceKm(ride, userGps);
                                  return dist < 1 ? `${Math.round(dist * 1000)}m away` : `${dist.toFixed(1)} km away`;
                                })()}
                              </span>
                            )}
                          </div>
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
                              ? "1 Seat Left!"
                              : `${ride.availableSeats} of ${ride.totalSeats} Left`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* View Ride Details Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleRideDetails(ride._id)}
                      className="w-full py-1.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors border border-slate-200/60"
                    >
                      {isExpanded ? (
                        <>
                          <span>Hide Ride Details</span>
                          <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
                        </>
                      ) : (
                        <>
                          <span>View Ride Details</span>
                          <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
                        </>
                      )}
                    </button>

                    {/* Expandable Full Ride Details */}
                    {isExpanded && (
                      <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in-50 duration-200">
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
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[11px] font-semibold">
                                <span>{ride.destination.split(",")[0].trim()} (Destination):</span>
                                <span className="font-bold text-blue-700">₹{ride.basePrice}</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Driver Contact & Direct Phone Call Button */}
                        {ride.driver.phone && (
                          <div className="flex items-center justify-between text-xs bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-200">
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Driver Mobile: <span className="font-mono text-emerald-950">{ride.driver.phone}</span></span>
                            </div>
                            <a
                              href={`tel:${ride.driver.phone}`}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center gap-1 shadow-2xs transition-colors shrink-0"
                            >
                              <Phone className="h-3 w-3" /> Call Driver
                            </a>
                          </div>
                        )}

                        {ride.notes && (
                          <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-100">
                            &ldquo;{ride.notes}&rdquo;
                          </p>
                        )}
                      </div>
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
              <div className="space-y-4 pt-1 text-xs">
                {/* Embedded Interactive Route Map */}
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <MapView
                    startLocation={{
                      name: selectedRide.startingLocation,
                      address: selectedRide.startLocation?.address || selectedRide.startingLocation,
                      ...resolvePlaceCoordinates(
                        selectedRide.startingLocation,
                        selectedRide.startLocation?.latitude,
                        selectedRide.startLocation?.longitude,
                        true
                      ),
                    }}
                    destination={{
                      name: selectedRide.destination,
                      address: selectedRide.endLocation?.address || selectedRide.destination,
                      ...resolvePlaceCoordinates(
                        selectedRide.destination,
                        selectedRide.endLocation?.latitude,
                        selectedRide.endLocation?.longitude,
                        false
                      ),
                    }}
                    stops={selectedRide.stops.map((s) => ({
                      name: s.name,
                      address: s.address || s.name,
                      latitude: s.latitude || 12.95,
                      longitude: s.longitude || 80.18,
                      price: s.price,
                    }))}
                    driverLocation={selectedRide.currentLocation || null}
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
                    height="340px"
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

                {/* Boarding Stop Selection UI */}
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Boarding & Pickup Location</span>
                    </Label>
                  </div>

                  {/* Segmented Switcher Buttons */}
                  <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomStopMode(false);
                        setSelectedPickupStop(selectedRide.startingLocation);
                        setSelectedFare(
                          calculateFareForStops(
                            selectedRide,
                            selectedRide.startingLocation,
                            selectedDropStop || selectedRide.destination,
                            false
                          )
                        );
                      }}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        !isCustomStopMode
                          ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <CheckCircle className={`h-3.5 w-3.5 ${!isCustomStopMode ? "text-emerald-600" : ""}`} />
                      <span>Standard Route Stop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomStopMode(true);
                        setSelectedPickupStop(customStopText ? `Custom Stop: ${customStopText}` : "Custom Boarding Point");
                        setSelectedFare(selectedRide.basePrice ? Math.round(selectedRide.basePrice * 0.8) : 120);
                      }}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all ${
                        isCustomStopMode
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <PlusCircle className={`h-3.5 w-3.5 ${isCustomStopMode ? "text-white" : ""}`} />
                      <span>Request Custom Stop</span>
                    </button>
                  </div>

                  {!isCustomStopMode ? (
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                      <Label className="text-[11px] font-semibold text-slate-600 block">Select from driver's confirmed route stops:</Label>
                      <Select value={selectedPickupStop} onValueChange={handlePickupSelect}>
                        <SelectTrigger className="rounded-xl text-xs h-11 bg-white border-slate-200 font-medium">
                          <SelectValue placeholder="Choose boarding stop" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={selectedRide.startingLocation}>
                            {selectedRide.startingLocation.split(",")[0].trim()} (Origin) — ₹{selectedRide.basePrice || 100}
                          </SelectItem>
                          {selectedRide.stops?.map((stop, idx) => (
                            <SelectItem key={idx} value={stop.name}>
                              {stop.name.split(",")[0].trim()} (Stop {idx + 1}) — ₹{stop.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2 animate-in fade-in-50 pt-1">
                      <Label htmlFor="customStopInput" className="text-xs font-semibold text-slate-700 block">
                        Custom Pickup Location
                      </Label>
                      <LocationSearchInput
                        id="customStopInput"
                        placeholder="Search landmark or street (e.g. Porur Signal, Chromepet...)"
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
                        className="h-10 text-xs bg-white border-slate-200 rounded-xl"
                      />

                      {customStopAddress && (
                        <div className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 pt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          <span className="truncate">Selected: {customStopAddress}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Drop-off Location Selection UI */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-blue-600" />
                      <span>Drop-off Location</span>
                    </Label>
                    <span className="text-[10px] text-slate-400 font-semibold">Destination added at end</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <Label className="text-[11px] font-semibold text-slate-600 block">
                      Select drop-off point along the route:
                    </Label>
                    <Select value={selectedDropStop} onValueChange={handleDropSelect}>
                      <SelectTrigger className="rounded-xl text-xs h-11 bg-white border-slate-200 font-medium">
                        <SelectValue placeholder="Choose drop-off stop" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDropStops.map((stop, idx) => (
                          <SelectItem key={idx} value={stop.name}>
                            {stop.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Selected Commute Leg Summary Banner */}
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0 pr-2">
                    <span className="font-bold text-emerald-950 truncate max-w-[120px] sm:max-w-[150px]">
                      {isCustomStopMode ? (customStopText || "Custom Stop") : (selectedPickupStop.split(",")[0].trim() || "Origin")}
                    </span>
                    <ArrowRight className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="font-bold text-blue-950 truncate max-w-[120px] sm:max-w-[150px]">
                      {selectedDropStop.split(",")[0].trim() || selectedRide.destination.split(",")[0].trim()}
                    </span>
                  </div>
                  <span className="font-extrabold text-emerald-800 text-xs shrink-0">
                    ₹{selectedFare} / seat
                  </span>
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
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={(typeof seatsRequested === "number" ? seatsRequested : 1) <= 1}
                        onClick={() =>
                          setSeatsRequested((prev) =>
                            Math.max(1, (typeof prev === "number" ? prev : 1) - 1)
                          )
                        }
                        className="h-9 w-9 shrink-0 rounded-xl border-slate-200 hover:bg-slate-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={selectedRide.availableSeats}
                        value={seatsRequested}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setSeatsRequested("");
                            return;
                          }
                          const parsed = parseInt(val, 10);
                          if (!isNaN(parsed)) {
                            setSeatsRequested(Math.max(1, Math.min(parsed, selectedRide.availableSeats)));
                          }
                        }}
                        onBlur={() => {
                          if (seatsRequested === "" || seatsRequested < 1) {
                            setSeatsRequested(1);
                          }
                        }}
                        className="rounded-xl text-xs font-bold text-center h-9"
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={(typeof seatsRequested === "number" ? seatsRequested : 1) >= selectedRide.availableSeats}
                        onClick={() =>
                          setSeatsRequested((prev) =>
                            Math.min(selectedRide.availableSeats, (typeof prev === "number" ? prev : 1) + 1)
                          )
                        }
                        className="h-9 w-9 shrink-0 rounded-xl border-slate-200 hover:bg-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Estimated Total Fare
                    </Label>
                    <div className="h-9 flex items-center px-3 bg-emerald-50 rounded-xl border border-emerald-200 font-bold text-emerald-800 text-sm">
                      ₹{selectedFare * (typeof seatsRequested === "number" ? Math.min(seatsRequested, selectedRide.availableSeats) : 1)}
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                      <span>Sending Request...</span>
                    </span>
                  ) : session?.user?.role !== "admin" &&
                    (!session?.user?.isApproved && session?.user?.verificationStatus === "pending") ? (
                    "Awaiting Admin Approval"
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

      {/* PASSENGER LIVE GPS TRACKING MODAL */}
      <Dialog open={isLiveTrackingModalOpen} onOpenChange={setIsLiveTrackingModalOpen}>
        <DialogContent className="max-w-2xl bg-white p-3 sm:p-4 rounded-2xl max-h-[92vh] overflow-y-auto">
          <DialogTitle className="sr-only">Live GPS Tracking Map</DialogTitle>

          {liveTrackingRide && (
            <div className="space-y-3 pt-4">
              {/* Real-time Live Traffic-Aware ETA Header */}
              <div className="bg-slate-950 text-white p-3 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Remaining Commute</span>
                    <strong className="text-sm text-emerald-400 font-bold">
                      {liveEtaResult?.remainingDistanceKm ?? liveTelemetry?.distanceKm ?? liveTrackingRide.distanceKm ?? 0} km remaining
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

              {/* Interactive Map with Moving Driver Marker */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-xs">
                <MapView
                  startLocation={{
                    name: liveTelemetry?.startingLocation || liveTrackingRide.startingLocation,
                    address: liveTelemetry?.startLocation?.address || liveTrackingRide.startingLocation,
                    ...resolvePlaceCoordinates(
                      liveTelemetry?.startingLocation || liveTrackingRide.startingLocation,
                      liveTelemetry?.startLocation?.latitude || liveTrackingRide.startLocation?.latitude,
                      liveTelemetry?.startLocation?.longitude || liveTrackingRide.startLocation?.longitude,
                      true
                    ),
                  }}
                  destination={{
                    name: liveTelemetry?.destination || liveTrackingRide.destination,
                    address: liveTelemetry?.endLocation?.address || liveTrackingRide.destination,
                    ...resolvePlaceCoordinates(
                      liveTelemetry?.destination || liveTrackingRide.destination,
                      liveTelemetry?.endLocation?.latitude || liveTrackingRide.endLocation?.latitude,
                      liveTelemetry?.endLocation?.longitude || liveTrackingRide.endLocation?.longitude,
                      false
                    ),
                  }}
                  stops={liveTrackingRide.stops?.map((s: any) => ({
                    name: s.name,
                    price: s.price,
                    latitude: s.latitude || 12.95,
                    longitude: s.longitude || 80.18,
                  }))}
                  driverLocation={
                    (liveTelemetry?.currentLocation?.latitude ? liveTelemetry.currentLocation : null) ||
                    (liveTrackingRide.currentLocation?.latitude ? liveTrackingRide.currentLocation : null) ||
                    null
                  }
                  driverName={liveTrackingRide.driver?.name || "Driver"}
                  driverVehicleType={liveTrackingRide.vehicleType || "Car"}
                  routeCoordinates={liveEtaResult?.coordinates}
                  panToDriver={true}
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
                  enableDynamicRerouting={true}
                  onRouteRecalculated={(newRoute) => {
                    hasDynamicReroutedRef.current = true;
                    setLiveEtaResult(newRoute);
                  }}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Geolocation Permission Request Modal */}
      <Dialog open={showLocationPromptModal} onOpenChange={setShowLocationPromptModal}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6 border-slate-200">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <Navigation className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              Enable Location Access
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500 mt-2">
              CommuteX requires your device GPS location to calculate distances and sort available rides by nearest pickup point.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 border border-slate-200 space-y-1 mt-2">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Privacy Protected
            </p>
            <p className="text-[11px] text-slate-500">
              Your location is only used locally in your browser to order rides closest to you. We never share your live coordinates without your permission.
            </p>
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setShowLocationPromptModal(false);
                setSortBy("earliest");
              }}
              className="flex-1 rounded-xl text-xs font-semibold h-10 border-slate-200"
            >
              Use Earliest Departure
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const coords = await requestUserGps();
                if (coords) {
                  setSortBy("nearest_pickup");
                  setShowLocationPromptModal(false);
                }
              }}
              disabled={isLocatingUser}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold h-10 gap-1.5"
            >
              {isLocatingUser ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Locating...
                </>
              ) : (
                <>
                  <Navigation className="h-4 w-4" /> Enable Location
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coworker Driver Profile Modal */}
      <EmployeeProfileModal
        isOpen={Boolean(viewProfileUserId)}
        onClose={() => setViewProfileUserId(null)}
        userId={viewProfileUserId}
        fallbackData={viewProfileFallback}
      />
    </div>
  );
}
