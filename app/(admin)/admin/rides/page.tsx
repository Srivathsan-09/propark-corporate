"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Car,
  Users,
  Search,
  Route,
  MapPin,
  Calendar,
  Clock,
  Building2,
  Phone,
  ArrowLeft,
  ShieldCheck,
  IndianRupee,
  Navigation2,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertCircle,
  Sun,
  Moon,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CarLoader } from "@/components/common/CarLoader";
import MapView from "@/components/map/MapView";
import { getInitials } from "@/lib/utils";

interface IPassengerRequest {
  _id: string;
  passenger: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    companyName?: string;
    phone?: string;
  };
  pickupStop: string;
  dropStop: string;
  seatsRequested: number;
  fare: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: string;
}

interface IAdminRide {
  _id: string;
  driver: {
    _id: string;
    name: string;
    email: string;
    employeeId: string;
    department: string;
    companyName?: string;
    phone?: string;
  };
  vehicle: {
    _id: string;
    vehicleModel: string;
    vehicleType: string;
    registrationNumber: string;
    seatingCapacity: number;
  };
  vehicleType: string;
  rideType?: "pickup" | "drop";
  startingLocation: string;
  destination: string;
  startLocation?: { address: string; latitude: number; longitude: number };
  endLocation?: { address: string; latitude: number; longitude: number };
  distanceKm?: number;
  durationMinutes?: number;
  departureDate: string;
  departureTime: string;
  totalSeats: number;
  availableSeats: number;
  basePrice: number;
  stops: { name: string; price: number; address?: string; latitude?: number; longitude?: number }[];
  notes?: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  requests: IPassengerRequest[];
  totalSeatsBooked: number;
  totalFareGenerated: number;
  createdAt: string;
}

interface IAdminStats {
  totalRides: number;
  scheduledRides: number;
  totalPassengersJoined: number;
  totalRevenueGenerated: number;
}

export default function AdminRidesPage() {
  const [rides, setRides] = useState<IAdminRide[]>([]);
  const [stats, setStats] = useState<IAdminStats>({
    totalRides: 0,
    scheduledRides: 0,
    totalPassengersJoined: 0,
    totalRevenueGenerated: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterRideType, setFilterRideType] = useState<string>("all");
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);

  const fetchAdminRides = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const res = await fetch("/api/admin/rides");
      if (res.ok) {
        const data = await res.json();
        setRides(data.rides || []);
        setStats(data.stats || {
          totalRides: 0,
          scheduledRides: 0,
          totalPassengersJoined: 0,
          totalRevenueGenerated: 0,
        });
      }
    } catch (err) {
      console.error("Failed to load admin rides:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminRides();

    // Auto-refresh every 8 seconds for real-time tracking
    const interval = setInterval(() => {
      fetchAdminRides(true);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const filteredRides = rides.filter((ride) => {
    const term = searchTerm.toLowerCase().trim();
    const matchSearch =
      !term ||
      ride.driver.name.toLowerCase().includes(term) ||
      ride.driver.employeeId.toLowerCase().includes(term) ||
      (ride.driver.companyName && ride.driver.companyName.toLowerCase().includes(term)) ||
      ride.vehicle.registrationNumber.toLowerCase().includes(term) ||
      ride.vehicle.vehicleModel.toLowerCase().includes(term) ||
      ride.startingLocation.toLowerCase().includes(term) ||
      ride.destination.toLowerCase().includes(term) ||
      ride.requests.some((req) => req.passenger.name.toLowerCase().includes(term));

    const matchStatus = filterStatus === "all" || ride.status === filterStatus;
    const matchRideType =
      filterRideType === "all" ||
      (filterRideType === "pickup" && ride.rideType !== "drop") ||
      (filterRideType === "drop" && ride.rideType === "drop");

    return matchSearch && matchStatus && matchRideType;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Campus Rides Oversight & Manifest
            </h1>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Live Syncing
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Real-time monitoring of all campus carpools, route schedules, and complete employee passenger manifests
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchAdminRides()}
          disabled={isLoading}
          className="text-xs rounded-xl gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh Manifest
        </Button>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 bg-white shadow-xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Rides Posted</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">{stats.totalRides}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Car className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Passengers Joined</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">{stats.totalPassengersJoined}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Commutes</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{stats.scheduledRides}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <Route className="h-5 w-5" />
          </div>
        </Card>

        <Card className="border-slate-200 bg-white shadow-xs rounded-2xl p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Fare Volume</span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">₹{stats.totalRevenueGenerated}</span>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <IndianRupee className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-2xl">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search driver, passenger, company, vehicle plate, or route..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm rounded-xl"
              />
            </div>

            {/* Commute Type Filter */}
            <div>
              <Select value={filterRideType} onValueChange={setFilterRideType}>
                <SelectTrigger className="h-10 text-sm rounded-xl">
                  <SelectValue placeholder="All Commute Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Commutes</SelectItem>
                  <SelectItem value="pickup">Morning Pickup (To Campus)</SelectItem>
                  <SelectItem value="drop">Evening Drop (From Campus)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-10 text-sm rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rides & Passenger Manifest List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="lg" message="Loading campus carpool rides..." />
        </div>
      ) : filteredRides.length === 0 ? (
        <Card className="border-slate-200 bg-white p-12 text-center rounded-2xl">
          <Route className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-800">No Rides Match Your Filters</h2>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
            Try adjusting your search term or filter options to view corporate rides.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRides.map((ride) => {
            const isPickup = ride.rideType !== "drop";
            const acceptedPassengers = ride.requests.filter((r) => r.status === "accepted");
            const pendingRequests = ride.requests.filter((r) => r.status === "pending");
            const isExpanded = expandedRideId === ride._id;

            return (
              <Card
                key={ride._id}
                className="border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden hover:border-slate-300 transition-colors"
              >
                <CardHeader className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    {/* Driver Identity */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold text-xs">
                        {getInitials(ride.driver.name)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{ride.driver.name}</span>
                          <span className="text-[10px] font-mono font-semibold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {ride.driver.employeeId}
                          </span>
                          <ShieldCheck className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-semibold text-emerald-800 flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            {ride.driver.companyName || "Tech Mahindra"} ({ride.driver.department})
                          </span>
                          {ride.driver.phone && (
                            <span className="flex items-center gap-1 text-slate-600">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {ride.driver.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Quick Badges & Vehicle */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        className={`text-[10px] font-bold ${
                          isPickup ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-indigo-100 text-indigo-900 border-indigo-300"
                        }`}
                      >
                        {isPickup ? "Morning Pickup" : "Evening Drop"}
                      </Badge>
                      <Badge className="bg-slate-900 text-white font-bold text-[10px]">
                        {ride.vehicle.vehicleModel} ({ride.vehicle.registrationNumber})
                      </Badge>
                      <Badge
                        className={`text-[10px] font-bold ${
                          ride.status === "scheduled"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : ride.status === "completed"
                            ? "bg-blue-100 text-blue-800 border-blue-300"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {ride.status.toUpperCase()}
                      </Badge>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedRideId(isExpanded ? null : ride._id)}
                        className="h-8 text-xs font-bold text-slate-700 hover:bg-slate-200/60 rounded-xl gap-1"
                      >
                        {isExpanded ? (
                          <>
                            Hide Route Map <ChevronUp className="h-3.5 w-3.5" />
                          </>
                        ) : (
                          <>
                            View Route Map <ChevronDown className="h-3.5 w-3.5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Route & Timing Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
                    {/* Origin -> Stops -> Destination (6 cols) */}
                    <div className="md:col-span-6 p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Starting Origin</span>
                          <span className="font-bold text-slate-900">{ride.startingLocation}</span>
                        </div>
                      </div>

                      {ride.stops && ride.stops.length > 0 && (
                        <div className="ml-1 pl-3 border-l-2 border-emerald-200 space-y-1.5 my-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Intermediate {isPickup ? "Pickup Points" : "Drop Points"} & Fares
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {ride.stops.map((stop, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white text-slate-800 border border-slate-200 text-[11px] font-medium"
                              >
                                <span className="text-emerald-700 font-bold">{idx + 1}.</span>
                                <span>{stop.name}</span>
                                <span className="font-bold text-emerald-800">(₹{stop.price})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Campus Destination</span>
                          <span className="font-bold text-slate-900">{ride.destination}</span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule & Seating Metrics (6 cols) */}
                    <div className="md:col-span-6 grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Schedule
                        </span>
                        <span className="font-bold text-slate-900 block">{ride.departureDate}</span>
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {ride.departureTime}
                        </span>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                        <span className="text-[10px] text-slate-400 uppercase font-bold block flex items-center gap-1">
                          <Users className="h-3 w-3" /> Seat Capacity
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-sm">
                            {ride.totalSeats - ride.availableSeats} / {ride.totalSeats} Booked
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-700">
                            {ride.availableSeats} Left
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all"
                            style={{
                              width: `${((ride.totalSeats - ride.availableSeats) / ride.totalSeats) * 100}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Distance & Fare Volume */}
                      <div className="col-span-2 p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Navigation2 className="h-4 w-4 text-emerald-600" />
                          <span>Distance: <strong className="text-slate-900">{ride.distanceKm ? `${ride.distanceKm} km` : "N/A"}</strong></span>
                          <span>• Duration: <strong className="text-slate-900">{ride.durationMinutes ? `${ride.durationMinutes} mins` : "N/A"}</strong></span>
                        </div>
                        <div className="font-bold text-emerald-900 text-xs">
                          Fare Pool: ₹{ride.totalFareGenerated}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Leaflet Route Map */}
                  {isExpanded && (
                    <div className="rounded-xl overflow-hidden border border-slate-200 pt-2 animate-in fade-in-50">
                      <MapView
                        startLocation={{
                          name: ride.startingLocation,
                          address: ride.startLocation?.address || ride.startingLocation,
                          latitude: ride.startLocation?.latitude || 12.9249,
                          longitude: ride.startLocation?.longitude || 80.1332,
                        }}
                        destination={{
                          name: ride.destination,
                          address: ride.endLocation?.address || ride.destination,
                          latitude: ride.endLocation?.latitude || 12.8988,
                          longitude: ride.endLocation?.longitude || 80.2284,
                        }}
                        stops={ride.stops.map((s) => ({
                          name: s.name,
                          address: s.address || s.name,
                          latitude: s.latitude || 12.95,
                          longitude: s.longitude || 80.18,
                          price: s.price,
                        }))}
                        distanceText={ride.distanceKm ? `${ride.distanceKm} km` : undefined}
                        durationText={ride.durationMinutes ? `${ride.durationMinutes} mins` : undefined}
                        height="260px"
                      />
                    </div>
                  )}

                  {/* Joined Employees / Passenger Manifest Section (The Core Requirement) */}
                  <div className="pt-3 border-t border-slate-100 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-emerald-600" />
                        Passenger Commute Manifest ({ride.requests.length} total request{ride.requests.length === 1 ? "" : "s"})
                      </h2>

                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="h-3 w-3" /> {acceptedPassengers.length} Confirmed
                        </span>
                        {pendingRequests.length > 0 && (
                          <span className="flex items-center gap-1 text-amber-700 font-semibold">
                            <Clock3 className="h-3 w-3" /> {pendingRequests.length} Pending
                          </span>
                        )}
                      </div>
                    </div>

                    {ride.requests.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        No employees have requested to join this ride yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white overflow-hidden text-xs">
                        {ride.requests.map((req) => {
                          const isAccepted = req.status === "accepted";
                          const isPending = req.status === "pending";

                          return (
                            <div
                              key={req._id}
                              className={`p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                                isAccepted ? "bg-emerald-50/20" : isPending ? "bg-amber-50/20" : "bg-slate-50/40"
                              }`}
                            >
                              {/* Passenger Profile */}
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-slate-300 font-bold text-[11px] text-slate-700">
                                  {getInitials(req.passenger.name)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    {req.passenger.name}
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ({req.passenger.employeeId})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span className="font-semibold text-emerald-800">
                                      {req.passenger.companyName || "Tech Mahindra"}
                                    </span>
                                    <span>• {req.passenger.department}</span>
                                    {req.passenger.phone && (
                                      <span className="text-slate-600 font-mono flex items-center gap-1">
                                        <Phone className="h-3 w-3 text-slate-400" />
                                        {req.passenger.phone}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Boarding Point & Fare */}
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Boarding Stop</span>
                                  <span className="font-semibold text-slate-800">{req.pickupStop}</span>
                                </div>

                                <div className="text-right">
                                  <span className="text-[10px] text-slate-400 block">Seats & Fare</span>
                                  <span className="font-bold text-emerald-800">
                                    {req.seatsRequested} seat(s) • ₹{req.fare}
                                  </span>
                                </div>

                                <Badge
                                  className={`text-[10px] font-bold ${
                                    isAccepted
                                      ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : isPending
                                      ? "bg-amber-100 text-amber-800 border-amber-300"
                                      : "bg-rose-100 text-rose-800 border-rose-300"
                                  }`}
                                >
                                  {req.status === "accepted"
                                    ? "Joined / Confirmed"
                                    : req.status === "pending"
                                    ? "Pending Driver Approval"
                                    : req.status.toUpperCase()}
                                </Badge>
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
      )}
    </div>
  );
}
