"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Compass,
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
  AlertTriangle,
  CheckCircle2,
  Info,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Zap,
  Layers,
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

export default function AdminCommuteHubPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const campusAdminId = session?.user?.campusId;

  const [campuses, setCampuses] = useState<{ campusId: string; name: string; city: string }[]>([]);
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [selectedDateRange, setSelectedDateRange] = useState<string>("30d");
  const [data, setData] = useState<ICommuteHubIntelligencePayload | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<
    "corridors" | "temporal" | "carpool" | "capacity" | "insights"
  >("corridors");

  // 1. Fetch available campuses for Super Admin filter
  useEffect(() => {
    async function loadCampuses() {
      try {
        const res = await fetch("/api/admin/campuses");
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCampuses(json.data);
        }
      } catch (err) {
        console.error("Failed to load campuses for CommuteHub filter:", err);
      }
    }
    if (isSuperAdmin) {
      loadCampuses();
    }
  }, [isSuperAdmin]);

  // 2. Fetch CommuteHub Intelligence Data
  const fetchIntelligence = async () => {
    setIsLoading(true);
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
      console.error("Failed to fetch CommuteHub intelligence:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntelligence();
  }, [selectedCampus, selectedDateRange]);

  if (isLoading && !data) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading CommuteHub mobility intelligence..." />
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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#a855f7_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Badge className="bg-purple-500/30 text-purple-200 border-purple-400/30 font-semibold px-2.5 py-0.5 text-xs flex items-center gap-1.5">
              <Compass className="h-3.5 w-3.5" />
              Admin Mobility Intelligence
            </Badge>
            <Badge variant="outline" className="text-emerald-400 border-emerald-500/40 text-[11px]">
              CommuteX Data Engine
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Commute<span className="text-emerald-400">Hub</span> Intelligence
          </h1>
          <p className="mt-1 text-sm text-slate-300 max-w-2xl">
            Real-time corridor flows, peak departure windows, employee commute clustering, and explainable carpool optimization based on active CommuteX rides.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="relative z-10 flex flex-wrap items-center gap-2.5 bg-slate-800/80 p-2 rounded-xl border border-purple-500/20 backdrop-blur-xs">
          {/* Campus Selector (Super Admin only) */}
          {isSuperAdmin ? (
            <div className="w-44">
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="h-9 bg-slate-900 border-slate-700 text-white text-xs font-medium focus:ring-purple-500">
                  <Building2 className="h-3.5 w-3.5 mr-1 text-purple-400 shrink-0" />
                  <SelectValue placeholder="All Campuses" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700 text-white">
                  <SelectItem value="all" className="text-xs hover:bg-slate-800">
                    All Campuses (Global)
                  </SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.campusId} value={c.campusId} className="text-xs hover:bg-slate-800">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <Badge variant="secondary" className="bg-purple-900/60 text-purple-200 text-xs py-1.5 px-3 border border-purple-500/30">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              {campusAdminId || "Assigned Campus"}
            </Badge>
          )}

          {/* Date Range Selector */}
          <div className="w-36">
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="h-9 bg-slate-900 border-slate-700 text-white text-xs font-medium focus:ring-purple-500">
                <Calendar className="h-3.5 w-3.5 mr-1 text-emerald-400 shrink-0" />
                <SelectValue placeholder="Timeframe" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-white">
                <SelectItem value="today" className="text-xs hover:bg-slate-800">Today</SelectItem>
                <SelectItem value="7d" className="text-xs hover:bg-slate-800">Last 7 Days</SelectItem>
                <SelectItem value="30d" className="text-xs hover:bg-slate-800">Last 30 Days</SelectItem>
                <SelectItem value="all" className="text-xs hover:bg-slate-800">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={fetchIntelligence}
            disabled={isLoading}
            className="h-9 bg-purple-600 hover:bg-purple-700 text-white border-none text-xs gap-1.5 shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* 6 High-Impact Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Carpools</span>
              <div className="p-1.5 bg-purple-50 text-purple-700 rounded-md">
                <Route className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{overview?.totalCarpoolsAnalyzed ?? 0}</span>
              <span className="text-[11px] text-slate-500">rides</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              {overview?.scheduledActiveRides ?? 0} active · {overview?.completedRides ?? 0} completed
            </p>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Commuters</span>
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-md">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{overview?.totalCommuters ?? 0}</span>
              <span className="text-[11px] text-slate-500">employees</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              {overview?.uniqueDrivers ?? 0} drivers · {overview?.uniquePassengers ?? 0} passengers
            </p>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Occupancy</span>
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-md">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-emerald-600">{overview?.avgOccupancyRate ?? 0}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, overview?.avgOccupancyRate || 0)}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unused Seats</span>
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-md">
                <Car className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">{overview?.unusedSeatCapacity ?? 0}</span>
              <span className="text-[11px] text-slate-500">vacant</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-600 font-medium truncate">
              Target for carpool matching
            </p>
          </CardContent>
        </Card>

        {/* Metric 5 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">CO₂ Saved</span>
              <div className="p-1.5 bg-teal-50 text-teal-700 rounded-md">
                <Leaf className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-teal-700">{overview?.estimatedCo2SavedKg ?? 0}</span>
              <span className="text-[11px] text-slate-500">kg</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              {overview?.totalPassengerDistanceKm ?? 0} carpooled km
            </p>
          </CardContent>
        </Card>

        {/* Metric 6 */}
        <Card className="border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Fuel Saved</span>
              <div className="p-1.5 bg-indigo-50 text-indigo-700 rounded-md">
                <IndianRupee className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-slate-900">₹{overview?.estimatedCostSavedInr?.toLocaleString() ?? 0}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 truncate">
              Commuter pocket savings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("corridors")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "corridors"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Route className="h-4 w-4" />
          Corridors & Flows
        </button>
        <button
          onClick={() => setActiveTab("temporal")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "temporal"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Clock className="h-4 w-4" />
          Peak Hours & Timing
        </button>
        <button
          onClick={() => setActiveTab("carpool")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "carpool"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Carpool Opportunities
          <Badge className="ml-1 bg-white text-purple-700 text-[10px] px-1.5 py-0 font-bold">
            {carpoolOpportunities.length}
          </Badge>
        </button>
        <button
          onClick={() => setActiveTab("capacity")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "capacity"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Car className="h-4 w-4" />
          Capacity & Pickups
        </button>
        <button
          onClick={() => setActiveTab("insights")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap cursor-pointer ${
            activeTab === "insights"
              ? "bg-purple-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          <Zap className="h-4 w-4" />
          Mobility Insights
        </button>
      </div>

      {/* Tab 1: Corridors & Flows */}
      {activeTab === "corridors" && (
        <div className="space-y-6">
          {/* Top Corridors List */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Route className="h-4 w-4 text-purple-600" />
                    Top Commuting Corridors
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Arterial routes automatically classified from driver starting points, campus dropoffs, and passenger pickup stops.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-purple-700 border-purple-200 text-xs w-fit">
                  {corridors.length} Identified Corridors
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {corridors.map((c, idx) => (
                  <div
                    key={c.id || idx}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 hover:border-purple-200 transition-all gap-4"
                  >
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{c.name}</span>
                        {c.status === "high_demand" && (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold border-emerald-200">
                            High Demand
                          </Badge>
                        )}
                        {c.status === "balanced" && (
                          <Badge className="bg-blue-100 text-blue-800 text-[10px] font-semibold border-blue-200">
                            Balanced
                          </Badge>
                        )}
                        {c.status === "underserved" && (
                          <Badge className="bg-amber-100 text-amber-800 text-[10px] font-semibold border-amber-200">
                            Underserved
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{c.description}</p>
                      {c.frequentStops.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-semibold text-slate-400 uppercase">Frequent stops:</span>
                          {c.frequentStops.map((s, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[11px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-700"
                            >
                              {s.name} ({s.count})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-6 self-end md:self-center shrink-0">
                      <div className="text-right">
                        <span className="text-xs text-slate-400 uppercase font-semibold">Volume</span>
                        <p className="text-sm font-bold text-slate-900">{c.totalRides} rides</p>
                        <p className="text-[11px] text-slate-500">
                          {c.uniqueDrivers} drivers · {c.uniquePassengers} pass.
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 uppercase font-semibold">Occupancy</span>
                        <p className="text-sm font-bold text-emerald-600">{c.occupancyRate}%</p>
                        <p className="text-[11px] text-slate-500">
                          {c.totalSeatsBooked}/{c.totalSeatsOffered} seats
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-xs text-slate-400 uppercase font-semibold">Avg Fare</span>
                        <p className="text-sm font-bold text-slate-900">₹{c.avgPrice}</p>
                        <p className="text-[11px] text-slate-500">{c.avgDistanceKm} km</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Frequent Origins & Frequent Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Origins */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Frequent Commuter Origin Areas
                </CardTitle>
                <CardDescription className="text-xs">
                  Primary residential clusters where employees begin morning commutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {frequentOrigins.map((area, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{area.name}</span>
                      <span className="text-slate-500">
                        {area.ridesCount} rides ({area.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, area.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Destinations */}
            <Card className="border-slate-200/80 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  Frequent Campus Destinations
                </CardTitle>
                <CardDescription className="text-xs">
                  Top terminal delivery hubs and dropoff facilities across campuses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {frequentDestinations.map((area, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-800">{area.name}</span>
                      <span className="text-slate-500">
                        {area.ridesCount} rides ({area.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, area.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 2: Peak Hours & Timing */}
      {activeTab === "temporal" && (
        <div className="space-y-6">
          {/* Peak Callout Banners */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-amber-50 to-orange-50/60 border-amber-200/80 shadow-xs">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Morning Rush Peak</span>
                  <p className="text-lg font-black text-slate-900">{patterns?.peakMorningWindow || "08:15 AM – 09:15 AM"}</p>
                  <p className="text-xs text-amber-700">Inbound to Campus Gates</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-indigo-50/60 border-purple-200/80 shadow-xs">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Evening Return Peak</span>
                  <p className="text-lg font-black text-slate-900">{patterns?.peakEveningWindow || "05:30 PM – 06:45 PM"}</p>
                  <p className="text-xs text-purple-700">Outbound to Residential Hubs</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-teal-50/60 border-emerald-200/80 shadow-xs">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <TrendingUp className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Directional Ratio</span>
                  <p className="text-lg font-black text-slate-900">
                    {patterns?.directionalSplit.pickupPercent ?? 58}% Inbound
                  </p>
                  <p className="text-xs text-emerald-700">
                    {patterns?.directionalSplit.dropPercent ?? 42}% Outbound Commutes
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rush Hour Distribution Chart */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Hourly Commute Distribution (Rush Hour Curve)
              </CardTitle>
              <CardDescription className="text-xs">
                Observed ride departures and capacity volumes across 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={patterns?.rushHourDistribution || []}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="hour" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="pickupRides" name="To Campus (Pickup)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="dropRides" name="From Campus (Drop)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Day of Week Breakdown */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-700" />
                Day of Week Commute Volume
              </CardTitle>
              <CardDescription className="text-xs">
                Workday distribution indicating hybrid and on-site attendance density.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {patterns?.dayOfWeekDistribution.map((d, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <span className="text-xs font-bold text-slate-700">{d.day.substring(0, 3)}</span>
                    <p className="text-lg font-black text-purple-700">{d.ridesCount}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{d.occupancyRate}% occupancy</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Carpool Matching Opportunities */}
      {activeTab === "carpool" && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl flex items-start gap-3 text-purple-900 text-xs leading-relaxed">
            <Sparkles className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-purple-950">
                Automated Commuter Clustering & Match Detection
              </p>
              <p className="mt-0.5">
                These high-confidence carpool matches are detected by comparing recurring employee commute corridors, departure windows, and vehicle excess capacity without altering CommuteX driver preferences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {carpoolOpportunities.map((opp) => (
              <Card key={opp.id} className="border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-purple-100 text-purple-800 text-[11px] font-bold border-purple-200">
                      {opp.matchScore}% Match Score
                    </Badge>
                    <span className="text-[11px] font-semibold text-slate-500">{opp.timeWindow}</span>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 mt-2">{opp.corridor}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3.5">
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate"><strong>From:</strong> {opp.originArea}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span className="truncate"><strong>To:</strong> {opp.destinationArea}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-lg text-xs">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-semibold">Empty Seats</span>
                      <p className="font-bold text-slate-800">{opp.availableSeats} available</p>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-semibold">Commuter Demand</span>
                      <p className="font-bold text-purple-700">{opp.passengerDemand} seeking rides</p>
                    </div>
                  </div>

                  <div className="p-2 bg-emerald-50/60 border border-emerald-100 rounded-lg text-[11px] text-emerald-800 flex items-center justify-between">
                    <span>Potential vehicle reduction:</span>
                    <strong className="font-bold text-emerald-900">-{opp.potentialVehicleReduction} cars/day</strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Days: {opp.recurringDays.join(", ")}</span>
                    <span className="text-emerald-700 font-semibold">+{opp.estimatedDailyCo2SavingKg} kg CO₂/day</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Capacity & Recommended Pickups */}
      {activeTab === "capacity" && (
        <div className="space-y-6">
          {/* Capacity Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200/80 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Car className="h-4 w-4 text-purple-600" />
                  Vehicle Seat Capacity Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Fleet-wide seat allocation and empty seat analysis.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-xs text-slate-500 font-medium">Total Offered Capacity</span>
                    <p className="text-xl font-bold text-slate-900">{capacity?.totalCapacitySeats ?? 0} seats</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 font-medium">Filled vs Empty</span>
                    <p className="text-xl font-bold text-emerald-600">
                      {capacity?.filledSeats ?? 0} <span className="text-slate-400 font-normal">/</span> {capacity?.emptySeats ?? 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-slate-600">Vehicle Type Breakdown</span>
                  {capacity?.vehicleTypeBreakdown.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg border border-slate-100 bg-white shadow-2xs">
                      <span className="font-medium text-slate-800">{v.type} ({v.ridesCount} rides)</span>
                      <span className="font-bold text-emerald-600">{v.avgOccupancyRate}% occupancy</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200/80 shadow-xs">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Demand Density & Bottleneck Resolution
                </CardTitle>
                <CardDescription className="text-xs">
                  How CommuteX drivers can capture unmet passenger demand along active corridors.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
                  <p className="font-bold">Unused Seat Recovery Plan</p>
                  <p>
                    Currently, {capacity?.emptySeats ?? 0} seats travel empty daily. If CommuteX drivers add recommended intermediate pickup spots, seat utilization is projected to increase by 24%.
                  </p>
                </div>

                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 text-xs leading-relaxed space-y-1">
                  <p className="font-bold">Advisory Policy</p>
                  <p>
                    All recommended pickup areas below are generated strictly from observed commuter demand density. They are advisory insights for admin transit planning and do not automatically create virtual hubs.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Pickup Areas */}
          <Card className="border-slate-200/80 shadow-xs">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-purple-600" />
                    Recommended Pickup Areas (Observed Demand Clusters)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    High-density passenger clusters where multiple coworkers request rides within walking distance.
                  </CardDescription>
                </div>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs w-fit">
                  Advisory Recommendations Only
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedPickupAreas.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-slate-50 hover:border-purple-200 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{rec.name}</h4>
                      <Badge variant="outline" className="bg-white text-purple-700 border-purple-200 text-[10px] shrink-0 font-bold">
                        {rec.observedCommuterDemand} commuters
                      </Badge>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p><strong>Corridor:</strong> {rec.corridor}</p>
                      <p><strong>Peak Window:</strong> {rec.peakWindow}</p>
                      <p className="text-slate-400 text-[10px]">Coordinates: {rec.latitude}, {rec.longitude}</p>
                    </div>

                    <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
                      {rec.rationale}
                    </p>

                    <div className="pt-1 text-[11px] font-semibold text-purple-700 flex items-center gap-1">
                      <ArrowRight className="h-3 w-3" />
                      <span>{rec.suggestedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 5: Mobility Insights */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins) => (
              <Card key={ins.id} className="border-slate-200/80 shadow-xs hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {ins.category} Insight
                    </span>
                    {ins.severity === "high" && (
                      <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold">
                        High Priority
                      </Badge>
                    )}
                    {ins.severity === "medium" && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                        Medium Priority
                      </Badge>
                    )}
                    {ins.severity === "info" && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                        Observation
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">{ins.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Quantified Impact:</span>
                    <strong className="font-bold text-purple-800">{ins.impactMetric}</strong>
                  </div>
                  <div className="text-xs text-slate-700 space-y-1">
                    <span className="font-semibold text-slate-900">Recommended Action:</span>
                    <p className="text-slate-600">{ins.recommendedAction}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
