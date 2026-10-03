"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Route,
  Clock,
  Users,
  Car,
  TrendingUp,
  Leaf,
  IndianRupee,
  Sparkles,
  BarChart3,
  Calendar,
  Building2,
  RefreshCw,
  MapPin,
  ArrowRight,
  Zap,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CarLoader } from "@/components/common/CarLoader";
import {
  ICommuteHubIntelligencePayload,
  ICorridorMetric,
  IAreaMetric,
  ICarpoolOpportunity,
  IRecommendedPickupArea,
  IMobilityInsight,
} from "@/lib/services/commuteHubIntelligence";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

export default function AdminCommuteHubPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const campusAdminId = session?.user?.campusId;

  const [campuses, setCampuses] = useState<{ campusId: string; name: string; city: string }[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("30d");
  const [data, setData] = useState<ICommuteHubIntelligencePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"routes" | "hours" | "carpool" | "tips">("routes");

  useEffect(() => {
    async function loadCampuses() {
      try {
        const res = await fetch("/api/admin/campuses");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCampuses(json.data);
        }
      } catch (err) {
        console.error("Failed to load campuses:", err);
      }
    }
    if (isSuperAdmin) {
      loadCampuses();
    }
  }, [isSuperAdmin]);

  const fetchIntelligence = async () => {
    setIsRefreshing(true);
    try {
      const campusParam = isSuperAdmin ? selectedCampus : campusAdminId || "";
      let url = `/api/admin/commutehub/analytics?dateRange=${encodeURIComponent(selectedDateRange)}`;
      if (campusParam && campusParam !== "all") {
        url += `&campusId=${encodeURIComponent(campusParam)}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch (err) {
      console.error("Failed to fetch CommuteX Analytics data:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [selectedCampus, selectedDateRange]);

  if (isLoading && !data) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-2xs">
        <CarLoader size="page" message="Loading CommuteX Analytics..." />
      </div>
    );
  }

  const overview = data?.overview;
  const corridors = data?.corridors || [];
  const frequentOrigins = data?.frequentOrigins || [];
  const frequentDestinations = data?.frequentDestinations || [];
  const patterns = data?.patterns;
  const carpoolOpportunities = data?.carpoolOpportunities || [];
  const capacity = data?.capacity;
  const recommendedPickupAreas = data?.recommendedPickupAreas || [];
  const insights = data?.insights || [];

  const tabItems: {
    id: "routes" | "hours" | "carpool" | "tips";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }[] = [
    {
      id: "routes",
      label: "Popular Routes",
      icon: Route,
      badge: corridors.length,
    },
    {
      id: "hours",
      label: "Busy Hours",
      icon: Clock,
    },
    {
      id: "carpool",
      label: "Carpool & Seats",
      icon: Users,
      badge: `${overview?.unusedSeatCapacity ?? 0} open seats`,
    },
    {
      id: "tips",
      label: "Admin Tips",
      icon: Sparkles,
      badge: insights.length,
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 animate-in fade-in-50 duration-300">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              CommuteX Analytics
            </h1>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] font-bold py-0.5 px-2">
              Admin Analytics
            </Badge>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Updating
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Clear, real-time insights on employee rides, popular travel routes, busy hours, and vehicle sharing.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin ? (
            <div className="w-40">
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="h-8 bg-white border-slate-200 text-slate-800 text-xs font-medium focus:ring-purple-500">
                  <Building2 className="h-3 w-3 mr-1 text-slate-500 shrink-0" />
                  <SelectValue placeholder="All Campuses" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-800">
                  <SelectItem value="all" className="text-xs">All Campuses</SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.campusId} value={c.campusId} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
              <Building2 className="h-3 w-3 text-purple-600" />
              <span>{campusAdminId || "Assigned Campus"}</span>
            </div>
          )}

          <div className="w-32">
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="h-8 bg-white border-slate-200 text-slate-800 text-xs font-medium focus:ring-purple-500">
                <Calendar className="h-3 w-3 mr-1 text-slate-500 shrink-0" />
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-800">
                <SelectItem value="today" className="text-xs">Today</SelectItem>
                <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                <SelectItem value="all" className="text-xs">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchIntelligence}
            disabled={isRefreshing}
            className="h-8 text-xs rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 px-2.5 gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 2. Top 5 Key Stats Cards (Easy to understand at a glance) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Card 1: Total Rides */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Rides</span>
            <div className="p-1 rounded-md bg-purple-50 text-purple-600">
              <Car className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-900">{overview?.totalCarpoolsAnalyzed ?? 0}</span>
            <span className="text-xs text-slate-500">{overview?.totalCarpoolsAnalyzed === 1 ? "ride" : "rides"}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {overview?.scheduledActiveRides ?? 0} active · {overview?.completedRides ?? 0} completed
          </p>
        </div>

        {/* Card 2: Employees Commuting */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commuters</span>
            <div className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-900">{overview?.totalCommuters ?? 0}</span>
            <span className="text-xs text-slate-500">people</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {overview?.uniqueDrivers ?? 0} {overview?.uniqueDrivers === 1 ? "driver" : "drivers"} · {overview?.uniquePassengers ?? 0} {overview?.uniquePassengers === 1 ? "passenger" : "passengers"}
          </p>
        </div>

        {/* Card 3: Seats Filled */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seats Filled</span>
            <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-emerald-600">{overview?.avgOccupancyRate ?? 0}%</span>
            <span className="text-xs text-slate-500">filled</span>
          </div>
          <div className="mt-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, overview?.avgOccupancyRate || 0)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1 truncate font-medium">
            {overview?.unusedSeatCapacity ?? 0} {overview?.unusedSeatCapacity === 1 ? "empty seat" : "empty seats"} available
          </p>
        </div>

        {/* Card 4: Fuel Cost Saved */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fuel Money Saved</span>
            <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
              <IndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-900">₹{(overview?.estimatedCostSavedInr ?? 0).toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            Saved together by carpooling
          </p>
        </div>

        {/* Card 5: Carbon Saved */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CO₂ Reduced</span>
            <div className="p-1 rounded-md bg-teal-50 text-teal-600">
              <Leaf className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-teal-700">{overview?.estimatedCo2SavedKg ?? 0}</span>
            <span className="text-xs text-slate-500">kg CO₂</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            from {overview?.totalPassengerDistanceKm ?? 0} km carpooled
          </p>
        </div>
      </div>

      {/* 3. Simple Tab Switcher (4 clear, easy options) */}
      <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 inline-flex items-center gap-1 overflow-x-auto max-w-full">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-white text-slate-900 shadow-2xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive ? "text-purple-600" : "text-slate-400")} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-bold",
                    isActive ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: POPULAR ROUTES (Where Employees Travel)             */}
      {/* ========================================================= */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Route className="h-4 w-4 text-purple-600" />
                  Popular Commute Routes
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time routes taken by employee drivers and passengers, showing seat availability and boarding stops.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                {corridors.length} {corridors.length === 1 ? "Active Route" : "Active Routes"}
              </span>
            </div>

            {/* Route Cards */}
            <div className="space-y-3">
              {corridors.map((c, idx) => {
                const origin = c.originName || (c.frequentStops.length > 0 ? c.frequentStops[0].name : "Origin");
                const destination = c.destinationName || (c.frequentStops.length > 1 ? c.frequentStops[c.frequentStops.length - 1].name : "Campus");
                const emptySeats = Math.max(0, c.totalSeatsOffered - c.totalSeatsBooked);

                return (
                  <div
                    key={c.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/30 hover:bg-white hover:border-purple-200 hover:shadow-xs transition-all space-y-3"
                  >
                    {/* Route Top Row: From -> To and Status */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{origin}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            <span>{destination}</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">({c.name})</span>
                        </div>
                        <p className="text-xs text-slate-500">{c.description}</p>
                      </div>

                      {/* Clear Human Status Badge */}
                      <div className="shrink-0">
                        {emptySeats > 0 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {emptySeats} {emptySeats === 1 ? "Empty Seat Available" : "Empty Seats Available"}
                          </span>
                        ) : c.occupancyRate >= 80 ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            High Demand (Almost Full)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Balanced Route
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Rides Offered</span>
                        <span className="text-sm font-bold text-slate-900">{c.totalRides} {c.totalRides === 1 ? "Ride" : "Rides"}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {c.uniqueDrivers} driver · {c.uniquePassengers} passenger
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Seat Bookings</span>
                        <span className="text-sm font-bold text-emerald-600">{c.totalSeatsBooked} of {c.totalSeatsOffered} booked</span>
                        <span className="text-[10px] text-slate-500 block">{c.occupancyRate}% seats occupied</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Average Fare</span>
                        <span className="text-sm font-bold text-slate-900">₹{c.avgPrice}</span>
                        <span className="text-[10px] text-slate-500 block">per commuter seat</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-white border border-slate-200/70">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Distance</span>
                        <span className="text-sm font-bold text-slate-900">{c.avgDistanceKm} km</span>
                        <span className="text-[10px] text-slate-500 block">commute length</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/60">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span className="font-medium">Vehicle Seating Progress</span>
                        <span className="font-bold text-slate-800">
                          {c.occupancyRate}% Full ({emptySeats} {emptySeats === 1 ? "empty seat" : "empty seats"} left)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            c.occupancyRate >= 80 ? "bg-amber-500" : c.occupancyRate > 0 ? "bg-emerald-500" : "bg-slate-300"
                          )}
                          style={{ width: `${Math.max(4, c.occupancyRate)}%` }}
                        />
                      </div>
                    </div>

                    {/* Intermediate Pickup Stops */}
                    {c.frequentStops.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1 text-slate-600">
                        <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1 mr-1">
                          <MapPin className="h-3 w-3 text-emerald-600" /> Stops along route:
                        </span>
                        {c.frequentStops.map((stop, sIdx) => (
                          <span
                            key={sIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-white text-slate-800 border border-slate-200 font-medium"
                          >
                            {stop.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Starting Areas & Top Campus Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Top Pickup Areas */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Where Employees Start From (Pickup Areas)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Most common neighborhoods where drivers pick up passengers.
                </p>
              </div>

              <div className="space-y-2.5">
                {frequentOrigins.map((area, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-semibold">{area.name}</span>
                      <span className="text-slate-500">{area.ridesCount} {area.ridesCount === 1 ? "ride" : "rides"} ({area.percentage}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, area.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Destinations */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
              <div>
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  Where Employees Arrive (Office Destinations)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Primary corporate campus gates and arrival drop-off locations.
                </p>
              </div>

              <div className="space-y-2.5">
                {frequentDestinations.map((area, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-semibold">{area.name}</span>
                      <span className="text-slate-500">{area.ridesCount} {area.ridesCount === 1 ? "ride" : "rides"} ({area.percentage}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min(100, area.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BUSY HOURS (When Employees Travel)                  */}
      {/* ========================================================= */}
      {activeTab === "hours" && (
        <div className="space-y-4">
          {/* Top 3 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Morning Office Rush</span>
                <span className="text-sm font-bold text-slate-900">{patterns?.peakMorningWindow || "08:15 AM – 09:15 AM"}</span>
                <span className="text-[10px] text-slate-500 block">Peak arrival at campus gates</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Evening Return Rush</span>
                <span className="text-sm font-bold text-slate-900">{patterns?.peakEveningWindow || "05:30 PM – 06:45 PM"}</span>
                <span className="text-[10px] text-slate-500 block">Peak departure returning home</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Travel Direction</span>
                <span className="text-sm font-bold text-slate-900">
                  {patterns?.directionalSplit.pickupPercent ?? 58}% Inbound / {patterns?.directionalSplit.dropPercent ?? 42}% Outbound
                </span>
                <span className="text-[10px] text-slate-500 block">To campus vs Returning home</span>
              </div>
            </div>
          </div>

          {/* Hourly Ride Chart */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-purple-600" />
                  Hourly Ride Departures
                </h4>
                <p className="text-[11px] text-slate-500">
                  See what times of day have the most carpool departures.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> To Office (Morning)
                </span>
                <span className="flex items-center gap-1 text-purple-700">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> From Office (Evening)
                </span>
              </div>
            </div>

            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={patterns?.rushHourDistribution || []}
                  margin={{ top: 5, right: 10, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "8px 12px",
                    }}
                  />
                  <Bar dataKey="pickupRides" name="To Office" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="dropRides" name="From Office" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Weekly Commute Volume */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-600" />
                Weekly Commute Volume (Monday to Sunday)
              </h4>
              <p className="text-[11px] text-slate-500">
                Number of rides posted across each day of the week.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {patterns?.dayOfWeekDistribution.map((d, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl text-center space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">{d.day.substring(0, 3)}</span>
                  <span className="text-base font-bold text-purple-700 block">{d.ridesCount}</span>
                  <span className="text-[10px] text-slate-400 block">{d.occupancyRate}% filled</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CARPOOL & SEATS (Empty Seats & Sharing Opportunities)*/}
      {/* ========================================================= */}
      {activeTab === "carpool" && (
        <div className="space-y-4">
          {/* Smart Ride Matches */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Smart Carpool Opportunities
              </h4>
              <p className="text-[11px] text-slate-500">
                Coworkers traveling along similar routes and times who could share a ride to reduce empty seats.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {carpoolOpportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-purple-300 transition-all space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 truncate max-w-[170px]">{opp.corridor}</span>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                      {opp.matchScore}% Match
                    </Badge>
                  </div>

                  <div className="text-[11px] text-slate-600 space-y-1 bg-white p-2.5 rounded-lg border border-slate-200/70">
                    <div><strong>From:</strong> {opp.originArea}</div>
                    <div><strong>To:</strong> {opp.destinationArea}</div>
                    <div><strong>Time:</strong> {opp.timeWindow}</div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-slate-600 font-semibold">{opp.availableSeats} open seats</span>
                    <span className="text-purple-700 font-bold">{opp.passengerDemand} seeking rides</span>
                  </div>
                  <div className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-center font-medium">
                    🌱 Saves ~{opp.estimatedDailyCo2SavingKg} kg CO₂ daily
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle Fleet Seat Utilization */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-purple-600" />
                  Vehicle Seat Capacity & Utilization
                </h4>
                <p className="text-[11px] text-slate-500">
                  How effectively are employee vehicles being filled across carpools?
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-500 font-medium">Booked / Total: </span>
                <strong className="text-emerald-700">{capacity?.filledSeats ?? 0}</strong>
                <span className="text-slate-400"> / {capacity?.totalCapacitySeats ?? 0} seats</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
              {capacity?.vehicleTypeBreakdown.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                  <div>
                    <span className="font-bold text-slate-800 block">{v.type}</span>
                    <span className="text-[10px] text-slate-400">{v.ridesCount} {v.ridesCount === 1 ? "ride" : "rides"} active</span>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-600">{v.avgOccupancyRate}% full</span>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
              💡 <strong>Administrator Takeaway:</strong> Vehicles currently have {overview?.unusedSeatCapacity ?? 0} empty seats. Encouraging coworkers to book open seats reduces campus parking pressure and decreases single-car traffic.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ADMIN TIPS (Simple, Actionable Recommendations)     */}
      {/* ========================================================= */}
      {activeTab === "tips" && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Actionable Commute Suggestions
              </h4>
              <p className="text-[11px] text-slate-500">
                Simple, automated tips to help campus administrators fill open seats and improve daily commutes.
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
              {insights.length} Suggestions
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {insights.map((ins) => (
              <div key={ins.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{ins.title}</span>
                    {ins.severity === "high" && (
                      <span className="text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.2 rounded-full">
                        Priority
                      </span>
                    )}
                    {ins.severity === "medium" && (
                      <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.2 rounded-full">
                        Opportunity
                      </span>
                    )}
                    {ins.severity === "info" && (
                      <span className="text-[9px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.2 rounded-full">
                        Insight
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                  <div className="text-xs text-slate-800 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200/70">
                    <span className="text-purple-700 font-bold">Suggested Action:</span> {ins.recommendedAction}
                  </div>
                </div>

                <div className="text-right shrink-0 self-start sm:self-center bg-purple-50 p-2 rounded-lg border border-purple-100">
                  <span className="text-[9px] text-slate-500 uppercase font-bold block">Estimated Benefit</span>
                  <span className="text-xs font-bold text-purple-700">{ins.impactMetric}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
