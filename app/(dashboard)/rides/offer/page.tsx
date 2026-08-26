"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Car,
  MapPin,
  Calendar,
  Clock,
  Users,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Building2,
  IndianRupee,
  Navigation,
  FileText,
  MapPinned,
  Sun,
  Moon,
  ArrowRightLeft,
  Crosshair,
  Route,
  Navigation2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import LocationSearchInput from "@/components/map/LocationSearchInput";
import MapView, { MapPoint } from "@/components/map/MapView";
import { CarLoader } from "@/components/common/CarLoader";
import { geocodingService } from "@/lib/services/geocoding";
import { useRoute } from "@/hooks/useRoute";
import { offerRideSchema } from "@/validations/ride.schema";

interface IVehicle {
  _id: string;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  availableSeats: number;
  vehiclePhoto?: string;
  verificationStatus?: "pending" | "approved" | "rejected";
  isApproved?: boolean;
}

interface IStopItem {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  price: number;
  estimatedTime?: string;
}

export default function OfferRidePage() {
  const router = useRouter();
  const { data: session } = useSession();

  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Time-of-day smart default (Morning Pickup vs Evening Drop)
  const currentHour = new Date().getHours();
  const defaultIsMorning = currentHour < 13;

  // Profile & Campus Data
  const [userCampusName, setUserCampusName] = useState<string>("Campus");
  const [userHomeLocation, setUserHomeLocation] = useState<string>("");
  const [homePoint, setHomePoint] = useState<MapPoint | null>(null);
  const [campusPoint, setCampusPoint] = useState<MapPoint>({
    name: "Tech Park Campus",
    address: "Tech Park Campus, Chennai",
    latitude: 12.8988,
    longitude: 80.2284,
  });

  // Form State
  const [formData, setFormData] = useState({
    vehicleId: "",
    rideType: defaultIsMorning ? ("pickup" as "pickup" | "drop") : ("drop" as "pickup" | "drop"),
    startingLocation: "",
    destination: "",
    departureDate: new Date().toISOString().split("T")[0],
    departureTime: defaultIsMorning ? "08:30 AM" : "06:00 PM",
    availableSeats: 3,
    notes: "",
  });

  // Coordinate Points State
  const [startPoint, setStartPoint] = useState<MapPoint>({
    name: "",
    address: "",
    latitude: 0,
    longitude: 0,
  });

  const [endPoint, setEndPoint] = useState<MapPoint>({
    name: "",
    address: "",
    latitude: 0,
    longitude: 0,
  });

  // Dynamic Stops State (empty by default)
  const [stops, setStops] = useState<IStopItem[]>([]);

  // New Stop Input temporary state
  const [newStopName, setNewStopName] = useState("");
  const [newStopAddress, setNewStopAddress] = useState("");
  const [newStopLat, setNewStopLat] = useState<number>(0);
  const [newStopLng, setNewStopLng] = useState<number>(0);
  const [newStopPrice, setNewStopPrice] = useState<number>(100);

  // Routing Hook
  const { routeResult, isCalculating, calculateRoute } = useRoute();

  // Load User Profile & Setup Initial Locations
  useEffect(() => {
    async function loadProfileAndDefaults() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          const user = data.profile || {};
          const campus = user.campusName || (session?.user as any)?.campusName || "Campus";
          setUserCampusName(campus);

          let cLat = 12.8988;
          let cLng = 80.2284;
          try {
            const cResults = await geocodingService.search(campus, 1);
            if (cResults.length > 0) {
              cLat = cResults[0].latitude;
              cLng = cResults[0].longitude;
            }
          } catch {}

          const cPt: MapPoint = {
            name: campus,
            address: campus,
            latitude: cLat,
            longitude: cLng,
          };
          setCampusPoint(cPt);

          const home = (user.homeLocation || "").trim();
          if (home) {
            setUserHomeLocation(home);
            let hLat = 0;
            let hLng = 0;
            try {
              const hResults = await geocodingService.search(home, 1);
              if (hResults.length > 0) {
                hLat = hResults[0].latitude;
                hLng = hResults[0].longitude;
              }
            } catch {}

            const hPt: MapPoint = {
              name: home,
              address: home,
              latitude: hLat,
              longitude: hLng,
            };
            setHomePoint(hPt);

            if (defaultIsMorning) {
              setFormData((prev) => ({
                ...prev,
                startingLocation: home,
                destination: campus,
              }));
              setStartPoint(hPt);
              setEndPoint(cPt);
            } else {
              setFormData((prev) => ({
                ...prev,
                startingLocation: campus,
                destination: home,
              }));
              setStartPoint(cPt);
              setEndPoint(hPt);
            }
          } else {
            // Profile home location is empty: let user choose starting location!
            if (defaultIsMorning) {
              setFormData((prev) => ({
                ...prev,
                startingLocation: "",
                destination: campus,
              }));
              setStartPoint({ name: "", address: "", latitude: 0, longitude: 0 });
              setEndPoint(cPt);
            } else {
              setFormData((prev) => ({
                ...prev,
                startingLocation: campus,
                destination: "",
              }));
              setStartPoint(cPt);
              setEndPoint({ name: "", address: "", latitude: 0, longitude: 0 });
            }
          }
        }
      } catch (err) {
        console.error("Failed to load user profile in offer ride:", err);
      }
    }

    if (session?.user) {
      loadProfileAndDefaults();
    }
  }, [session, defaultIsMorning]);

  // Load User Vehicles
  useEffect(() => {
    async function loadVehicles() {
      try {
        const res = await fetch("/api/vehicles");
        if (res.ok) {
          const data = await res.json();
          const list: IVehicle[] = data.vehicles || [];
          setVehicles(list);

          if (list.length > 0) {
            const first = list[0];
            setFormData((prev) => ({
              ...prev,
              vehicleId: first._id,
              availableSeats: Math.min(first.availableSeats || 3, first.seatingCapacity),
            }));
          }
        }
      } catch (err) {
        console.error("Failed to fetch vehicles:", err);
      } finally {
        setIsLoadingVehicles(false);
      }
    }

    if (session?.user) {
      loadVehicles();
    }
  }, [session]);

  const selectedVehicle = vehicles.find((v) => v._id === formData.vehicleId);

  // Recalculate OSRM Route whenever start, destination, or stops change
  // Calculate main commute route between Origin & Destination (single OSRM fetch)
  useEffect(() => {
    if (
      startPoint &&
      endPoint &&
      startPoint.latitude &&
      endPoint.latitude &&
      startPoint.latitude !== 0 &&
      endPoint.latitude !== 0
    ) {
      calculateRoute([
        { latitude: startPoint.latitude, longitude: startPoint.longitude, name: startPoint.name },
        { latitude: endPoint.latitude, longitude: endPoint.longitude, name: endPoint.name },
      ]);
    }
  }, [
    startPoint.latitude,
    startPoint.longitude,
    endPoint.latitude,
    endPoint.longitude,
    calculateRoute,
  ]);

  // Auto-sort stops chronologically along travel direction in memory (zero network lag)
  useEffect(() => {
    if (routeResult?.coordinates && routeResult.coordinates.length > 1 && stops.length > 1) {
      import("@/lib/services/routeCorridor").then(({ sortStopsByRouteProgress }) => {
        const sorted = sortStopsByRouteProgress(stops, routeResult.coordinates);
        const currentKeys = stops.map((s) => `${s.name}_${s.latitude}_${s.longitude}`).join("|");
        const sortedKeys = sorted.map((s) => `${s.name}_${s.latitude}_${s.longitude}`).join("|");
        if (currentKeys !== sortedKeys) {
          setStops(sorted);
        }
      });
    }
  }, [routeResult?.coordinates, stops]);

  const handleVehicleChange = (vId: string) => {
    const v = vehicles.find((veh) => veh._id === vId);
    setFormData((prev) => ({
      ...prev,
      vehicleId: vId,
      availableSeats: v ? (v.vehicleType === "Bike" ? 1 : Math.min(v.availableSeats || 3, v.seatingCapacity)) : 1,
    }));
  };

  const handleRideTypeChange = (newType: "pickup" | "drop") => {
    if (newType === "pickup") {
      const startLoc = userHomeLocation || "";
      const startPt = homePoint || { name: "", address: "", latitude: 0, longitude: 0 };
      setFormData((prev) => ({
        ...prev,
        rideType: "pickup",
        startingLocation: startLoc,
        destination: userCampusName,
        departureTime: "08:30 AM",
      }));
      setStartPoint(startPt);
      setEndPoint(campusPoint);
    } else {
      const destLoc = userHomeLocation || "";
      const destPt = homePoint || { name: "", address: "", latitude: 0, longitude: 0 };
      setFormData((prev) => ({
        ...prev,
        rideType: "drop",
        startingLocation: userCampusName,
        destination: destLoc,
        departureTime: "06:00 PM",
      }));
      setStartPoint(campusPoint);
      setEndPoint(destPt);
    }
  };

  const handleSwapRoute = () => {
    setFormData((prev) => ({
      ...prev,
      rideType: prev.rideType === "pickup" ? "drop" : "pickup",
      startingLocation: prev.destination,
      destination: prev.startingLocation,
      departureTime: prev.rideType === "pickup" ? "06:00 PM" : "08:30 AM",
    }));

    const prevStart = { ...startPoint };
    setStartPoint({ ...endPoint });
    setEndPoint(prevStart);
  };

  const handleMapClick = async (loc: { address: string; latitude: number; longitude: number }) => {
    const geocoded = await geocodingService.reverse(loc.latitude, loc.longitude);
    const shortName = geocoded?.shortName || loc.address.split(",")[0].trim();
    const fullAddress = geocoded?.displayName || loc.address;

    // 1. Set Starting Origin if unselected
    if (!formData.startingLocation || !startPoint.latitude || startPoint.latitude === 0) {
      setFormData((prev) => ({ ...prev, startingLocation: shortName }));
      setStartPoint({ name: shortName, address: fullAddress, latitude: loc.latitude, longitude: loc.longitude });
      setSuccessMessage(`Set Starting Origin to "${shortName}" from map click.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    // 2. Set Destination if unselected
    if (!formData.destination || !endPoint.latitude || endPoint.latitude === 0) {
      setFormData((prev) => ({ ...prev, destination: shortName }));
      setEndPoint({ name: shortName, address: fullAddress, latitude: loc.latitude, longitude: loc.longitude });
      setSuccessMessage(`Set Destination to "${shortName}" from map click.`);
      setTimeout(() => setSuccessMessage(null), 3000);
      return;
    }

    // 3. Both Origin and Destination set: Snap boarding point to driver's route polyline
    const { snapPointToRoute, sortStopsByRouteProgress } = await import("@/lib/services/routeCorridor");
    const snapped = snapPointToRoute(loc.latitude, loc.longitude, routeResult?.coordinates || [], 4.0);

    if (snapped.isTooFar) {
      setErrorMessage(
        snapped.reason ||
          `"${shortName}" is too far from your current route. Try selecting a boarding point closer to your route.`
      );
      return;
    }

    setErrorMessage(null);
    const newStop: IStopItem = {
      name: shortName,
      address: fullAddress,
      latitude: snapped.snappedLatitude,
      longitude: snapped.snappedLongitude,
      price: 100,
    };

    setStops((prev) => {
      const updated = [...prev, newStop];
      return sortStopsByRouteProgress(updated, routeResult?.coordinates || []);
    });

    setSuccessMessage(`Added boarding stop "${shortName}" snapped to your route!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAddStop = async () => {
    if (!newStopName.trim()) return;

    setErrorMessage(null);
    let stopName = newStopName.trim();
    let stopAddress = newStopAddress || stopName;
    let stopLat = newStopLat;
    let stopLng = newStopLng;

    // 1. Auto-predict / resolve coordinates if not selected via dropdown
    if (!stopLat || !stopLng || (stopLat === 0 && stopLng === 0)) {
      const { resolveFuzzyLocation } = await import("@/lib/services/routeCorridor");
      const resolved = await resolveFuzzyLocation(stopName);
      if (resolved) {
        stopName = resolved.shortName;
        stopAddress = resolved.displayName;
        stopLat = resolved.latitude;
        stopLng = resolved.longitude;
      } else {
        const results = await geocodingService.search(stopName, 1);
        if (results.length > 0) {
          stopName = results[0].shortName;
          stopAddress = results[0].displayName;
          stopLat = results[0].latitude;
          stopLng = results[0].longitude;
        }
      }
    }

    if (!stopLat || !stopLng || (stopLat === 0 && stopLng === 0)) {
      setErrorMessage(`Could not predict location for "${newStopName}". Please check spelling or tap on map.`);
      return;
    }

    // 2. Snap boarding stop to driver's route
    const { snapPointToRoute, sortStopsByRouteProgress } = await import("@/lib/services/routeCorridor");
    const snapped = snapPointToRoute(stopLat, stopLng, routeResult?.coordinates || [], 4.0);

    if (snapped.isTooFar) {
      setErrorMessage(
        snapped.reason ||
          `"${stopName}" is too far from your current route. Try selecting a boarding point closer to your route.`
      );
      return;
    }

    const newStop: IStopItem = {
      name: stopName,
      address: stopAddress,
      latitude: snapped.snappedLatitude,
      longitude: snapped.snappedLongitude,
      price: Number(newStopPrice) || 100,
    };

    setStops((prev) => {
      const updated = [...prev, newStop];
      return sortStopsByRouteProgress(updated, routeResult?.coordinates || []);
    });

    setNewStopName("");
    setNewStopAddress("");
    setNewStopLat(0);
    setNewStopLng(0);
    setNewStopPrice(100);
    setErrorMessage(null);
    setSuccessMessage(`Added boarding stop "${stopName}" to your route!`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleRemoveStop = (index: number) => {
    setStops((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStopPriceChange = (index: number, newPrice: number) => {
    setStops((prev) =>
      prev.map((stop, i) => (i === index ? { ...stop, price: newPrice } : stop))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);
    setFieldErrors({});

    const payload = {
      ...formData,
      startLocation: {
        address: startPoint.address || formData.startingLocation,
        latitude: startPoint.latitude || 0,
        longitude: startPoint.longitude || 0,
      },
      endLocation: {
        address: endPoint.address || formData.destination,
        latitude: endPoint.latitude || 0,
        longitude: endPoint.longitude || 0,
      },
      distanceKm: routeResult?.distanceKm || 0,
      durationMinutes: routeResult?.durationMinutes || 0,
      stops: stops.map((s) => ({
        name: s.name,
        address: s.address || s.name,
        latitude: s.latitude || 0,
        longitude: s.longitude || 0,
        price: s.price,
      })),
    };

    const validation = offerRideSchema.safeParse(payload);
    if (!validation.success) {
      const formattedErrors: Record<string, string> = {};
      validation.error.errors.forEach((err) => {
        if (err.path[0]) {
          formattedErrors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(formattedErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to offer ride.");
        setIsSubmitting(false);
        return;
      }

      setSuccessMessage("Ride offered successfully! Redirecting to My Rides...");
      setTimeout(() => {
        router.push("/rides/my-rides");
      }, 1200);
    } catch (err) {
      console.error("Offer ride error:", err);
      setErrorMessage("Network error occurred while posting ride.");
      setIsSubmitting(false);
    }
  };

  const isPickup = formData.rideType === "pickup";

  const isEmployeeApproved =
    session?.user?.role === "admin" ||
    session?.user?.isApproved === true ||
    session?.user?.verificationStatus === "approved";

  const isVehicleApproved =
    session?.user?.role === "admin" ||
    (selectedVehicle &&
      (selectedVehicle.isApproved === true || selectedVehicle.verificationStatus === "approved"));

  const renderRideSummaryCard = () => (
    <Card className="border-slate-200 shadow-sm bg-slate-900 text-white rounded-2xl sticky top-20">
      <CardHeader className="pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold text-white">Ride Summary</CardTitle>
          <div className="flex items-center gap-1.5">
            {isPickup ? (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500 text-slate-950">
                Pickup
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-600 text-white">
                Drop
              </span>
            )}
            <Badge className="bg-slate-700 text-white font-bold text-[10px]">
              {selectedVehicle?.vehicleType || "Car"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-4 text-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Origin</span>
              <span className="font-bold text-white">{formData.startingLocation || "Starting Location"}</span>
            </div>
          </div>

          {stops.map((s, idx) => (
            <div key={idx} className="flex items-center gap-2 ml-1 pl-2 border-l border-slate-700 text-slate-300">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-[11px] truncate">
                {isPickup ? "Pickup" : "Drop"}: {s.name} (₹{s.price})
              </span>
            </div>
          ))}

          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Destination</span>
              <span className="font-bold text-white">{formData.destination || "Destination"}</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-3 space-y-2 text-slate-300">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Total Distance:</span>
            <span className="font-bold text-emerald-400">
              {routeResult?.formattedDistance || "Calculating..."}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Traffic-Aware Duration:</span>
            <span className="font-bold text-white">
              {routeResult?.formattedDuration || "Calculating..."}
            </span>
          </div>

          {routeResult?.trafficLevel && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Traffic Condition:</span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  routeResult.trafficBadgeColor === "rose"
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : routeResult.trafficBadgeColor === "amber"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                }`}
              >
                {routeResult.trafficBadgeText}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Departure:</span>
            <span className="font-semibold text-white">
              {formData.departureDate} at {formData.departureTime}
            </span>
          </div>

          {routeResult?.lastUpdated && (
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-400 font-mono">Updated {routeResult.lastUpdated}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Seats Offered:</span>
            <span className="font-bold text-emerald-400">{formData.availableSeats} Seats</span>
          </div>
        </div>

        {!isEmployeeApproved && (
          <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 p-2.5 rounded-xl text-[11px] pt-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Your account is pending Admin approval. You can offer rides once approved by Admin (Vathsan).</span>
          </div>
        )}

        {!isVehicleApproved && isEmployeeApproved && (
          <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-2.5 rounded-xl text-[11px] pt-2">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <span>Selected vehicle is awaiting Admin verification. Once approved by Admin, you can publish rides.</span>
          </div>
        )}

        <div className="border-t border-slate-800 pt-3">
          <Button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl shadow-md transition-colors h-11 text-xs"
            disabled={isSubmitting || !isEmployeeApproved || !isVehicleApproved}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-slate-950" />
                <span>Posting Ride...</span>
              </span>
            ) : !isEmployeeApproved ? (
              "Account Pending Admin Approval"
            ) : !isVehicleApproved ? (
              "Vehicle Pending Admin Approval"
            ) : (
              `Post ${isPickup ? "Pickup" : "Drop"} Ride`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Offer a Ride
        </h1>
        <p className="text-sm text-slate-500">
          Share your commute with interactive OpenStreetMap routing, custom pickup/drop points, and real-time distance calculations
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoadingVehicles ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="page" message="Loading your vehicles & route setup..." />
        </div>
      ) : vehicles.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50/60 p-6 text-center space-y-3 rounded-2xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Car className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-amber-900">No Registered Vehicle Found</h2>
          <p className="text-xs text-amber-800 max-w-md mx-auto">
            You must register a verified car or bike in your profile before offering rides to colleagues.
          </p>
          <Link href="/vehicles">
            <Button className="bg-emerald-600 hover:bg-emerald-700 font-bold rounded-xl text-xs mt-2">
              Register Vehicle Now
            </Button>
          </Link>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col lg:grid lg:grid-cols-12 gap-6">
          <div className="order-1 lg:order-2 lg:col-span-5 space-y-4">
            <Card className="border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Interactive Route Map
                    </CardTitle>
                  </div>
                  <CardDescription className="text-[11px] text-slate-500 mt-0.5">
                    Tap anywhere on map with hand cursor to set origin, destination, or add route stops
                  </CardDescription>
                </div>
                {isCalculating && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <CarLoader size="inline" showRoad={false} className="w-8 h-4 scale-75 origin-right" />
                    <span>Calculating OSRM route...</span>
                  </div>
                )}
              </CardHeader>

              <CardContent className="p-0">
                <MapView
                  startLocation={startPoint}
                  destination={endPoint}
                  stops={stops
                    .filter((s) => typeof s.latitude === "number" && typeof s.longitude === "number")
                    .map((s) => ({
                      name: s.name,
                      address: s.address,
                      latitude: s.latitude as number,
                      longitude: s.longitude as number,
                      price: s.price,
                    }))}
                  routeCoordinates={routeResult?.coordinates || []}
                  distanceText={routeResult?.formattedDistance}
                  durationText={routeResult?.formattedDuration}
                  trafficLevel={routeResult?.trafficLevel}
                  onMapClick={handleMapClick}
                  height="340px"
                />
              </CardContent>
            </Card>

            <div className="hidden lg:block">
              {renderRideSummaryCard()}
            </div>
          </div>
            <div className="order-2 lg:order-1 lg:col-span-7 space-y-4">
            <Card className="border-slate-200 shadow-sm bg-white rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-slate-100 pb-3.5 pt-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                      <Car className="h-5 w-5 text-emerald-600" /> Post Campus Ride
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500 mt-0.5">
                      Configure your commute direction, vehicle, and route stops
                    </CardDescription>
                  </div>

                  {selectedVehicle && (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-xs">
                      {selectedVehicle.vehicleType}
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-4 sm:p-6 space-y-4">
                {/* 1. Segmented Commute Direction Switcher */}
                <div className="space-y-2">
                  <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-2xl gap-1">
                    <button
                      type="button"
                      onClick={() => handleRideTypeChange("pickup")}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        isPickup
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Sun className={`h-4 w-4 ${isPickup ? "text-amber-500" : ""}`} />
                      <span>Morning Pickup (To Campus)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRideTypeChange("drop")}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                        !isPickup
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      <Moon className={`h-4 w-4 ${!isPickup ? "text-indigo-600" : ""}`} />
                      <span>Evening Drop (From Campus)</span>
                    </button>
                  </div>

                  {/* Vehicle Picker */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select
                        value={formData.vehicleId}
                        onValueChange={handleVehicleChange}
                      >
                        <SelectTrigger id="vehicleId" className="rounded-xl h-9 text-xs">
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicles.map((v) => {
                            const isApproved = v.isApproved || v.verificationStatus === "approved" || session?.user?.role === "admin";
                            return (
                              <SelectItem key={v._id} value={v._id}>
                                {v.vehicleModel} ({v.registrationNumber}) — {v.vehicleType} {!isApproved ? "(Pending Approval)" : "(Verified)"}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* 2. Connected Route Timeline Card */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                  {/* Origin (From) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0 ring-2 ring-emerald-200" />
                        <span>Starting Location (Origin)</span>
                      </span>
                    </div>
                    <LocationSearchInput
                      id="startingLocation"
                      placeholder="Search starting origin or tap location on map"
                      value={formData.startingLocation}
                      showCurrentLocation={false}
                      onChange={async (loc) => {
                        let name = loc.address;
                        let lat = loc.latitude;
                        let lng = loc.longitude;
                        setFormData((prev) => ({ ...prev, startingLocation: name }));

                        if ((!lat || !lng) && name.trim().length >= 3) {
                          const { resolveFuzzyLocation } = await import("@/lib/services/routeCorridor");
                          const resolved = await resolveFuzzyLocation(name);
                          if (resolved) {
                            lat = resolved.latitude;
                            lng = resolved.longitude;
                            name = resolved.shortName;
                          }
                        }

                        if (lat && lng) {
                          setStartPoint({ name, address: loc.address, latitude: lat, longitude: lng });
                        }
                      }}
                      hasError={Boolean(fieldErrors.startingLocation)}
                      className="h-9 text-xs bg-white"
                      required
                    />
                    {fieldErrors.startingLocation && (
                      <p className="text-xs text-rose-600">{fieldErrors.startingLocation}</p>
                    )}
                  </div>

                  {/* Swap Button Bar */}
                  <div className="flex items-center justify-between px-2">
                    <div className="w-0.5 h-3 bg-slate-300 ml-1" />
                    <button
                      type="button"
                      onClick={handleSwapRoute}
                      className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 transition-colors text-[10px] font-semibold flex items-center gap-1 shadow-2xs"
                    >
                      <ArrowRightLeft className="h-3 w-3" /> Swap Direction
                    </button>
                  </div>

                  {/* Destination (To) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0 ring-2 ring-blue-200" />
                        <span>Destination</span>
                      </span>
                    </div>
                    <LocationSearchInput
                      id="destination"
                      placeholder="Search destination or tap location on map"
                      value={formData.destination}
                      showCurrentLocation={false}
                      onChange={async (loc) => {
                        let name = loc.address;
                        let lat = loc.latitude;
                        let lng = loc.longitude;
                        setFormData((prev) => ({ ...prev, destination: name }));

                        if ((!lat || !lng) && name.trim().length >= 3) {
                          const { resolveFuzzyLocation } = await import("@/lib/services/routeCorridor");
                          const resolved = await resolveFuzzyLocation(name);
                          if (resolved) {
                            lat = resolved.latitude;
                            lng = resolved.longitude;
                            name = resolved.shortName;
                          }
                        }

                        if (lat && lng) {
                          setEndPoint({ name, address: loc.address, latitude: lat, longitude: lng });
                        }
                      }}
                      hasError={Boolean(fieldErrors.destination)}
                      className="h-9 text-xs bg-white"
                      required
                    />
                    {fieldErrors.destination && (
                      <p className="text-xs text-rose-600">{fieldErrors.destination}</p>
                    )}
                  </div>
                </div>

                {/* 3. Intermediary Stops List & Compact Add Bar */}
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Route Stops ({stops.length})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Add boarding points along your route
                    </span>
                  </div>

                  {stops.length > 0 && (
                    <div className="space-y-1.5">
                      {stops.map((stop, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs gap-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 truncate">
                              {stop.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center gap-0.5 bg-white px-2 py-0.5 rounded-lg border border-slate-200 font-bold text-slate-800 text-xs">
                              <span className="text-slate-400 text-[10px]">₹</span>
                              <input
                                type="number"
                                value={stop.price}
                                onChange={(e) => handleStopPriceChange(idx, Number(e.target.value) || 0)}
                                className="w-10 text-xs font-bold text-slate-800 focus:outline-none text-right"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveStop(idx)}
                              className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compact Single-Line Add Stop Bar */}
                  <div className="flex items-center gap-1.5 pt-1">
                    <div className="flex-1 min-w-0">
                      <LocationSearchInput
                        value={newStopName}
                        placeholder="Add stop (e.g. Kathipara)"
                        showCurrentLocation={false}
                        onChange={(loc) => {
                          setNewStopName(loc.address.split(",")[0]);
                          setNewStopAddress(loc.address);
                          setNewStopLat(loc.latitude);
                          setNewStopLng(loc.longitude);
                        }}
                        className="h-9 text-xs"
                      />
                    </div>
                    <div className="relative w-16 shrink-0">
                      <span className="absolute left-2 top-2 text-xs text-slate-400 font-bold">₹</span>
                      <Input
                        type="number"
                        placeholder="Fare"
                        value={newStopPrice}
                        onChange={(e) => setNewStopPrice(Number(e.target.value))}
                        className="pl-5 pr-1 text-xs font-bold rounded-xl h-9 text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddStop}
                      disabled={!newStopName.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 font-bold text-xs rounded-xl h-9 px-3 shrink-0"
                    >
                      + Add
                    </Button>
                  </div>
                </div>

                {/* 4. Schedule, Date, Time & Available Seats */}
                <div className="grid grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <Label htmlFor="departureDate" className="text-[10px] font-bold uppercase text-slate-500 block">
                      Date
                    </Label>
                    <Input
                      id="departureDate"
                      type="date"
                      value={formData.departureDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, departureDate: e.target.value }))}
                      className="rounded-xl h-9 text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="departureTime" className="text-[10px] font-bold uppercase text-slate-500 block">
                      Time
                    </Label>
                    <Input
                      id="departureTime"
                      placeholder="08:30 AM"
                      value={formData.departureTime}
                      onChange={(e) => setFormData((prev) => ({ ...prev, departureTime: e.target.value }))}
                      className="rounded-xl h-9 text-xs font-semibold"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="availableSeats" className="text-[10px] font-bold uppercase text-slate-500 block">
                      Seats
                    </Label>
                    <Input
                      id="availableSeats"
                      type="number"
                      min={1}
                      max={selectedVehicle?.seatingCapacity || 6}
                      value={formData.availableSeats}
                      onChange={(e) => setFormData((prev) => ({ ...prev, availableSeats: Number(e.target.value) }))}
                      className="rounded-xl h-9 text-xs text-center font-bold"
                      required
                    />
                  </div>
                </div>

                {/* 5. Driver Notes */}
                <div className="space-y-1 pt-1 border-t border-slate-100">
                  <Label htmlFor="notes" className="text-[10px] font-bold uppercase text-slate-500">
                    Driver Notes (Optional)
                  </Label>
                  <Input
                    id="notes"
                    placeholder="e.g. AC will be on, leaving sharp from campus gate"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    className="rounded-xl text-xs h-9"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Mobile Only: Ride Summary & Post Button directly below form */}
            <div className="block lg:hidden">
              {renderRideSummaryCard()}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
