"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
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
  ArrowLeft,
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
      console.error("Failed to fetch CommuteHub intelligence:", err);
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
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
        <CarLoader size="page" message="Synthesizing CommuteHub mobility intelligence..." />
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
    id: "corridors" | "temporal" | "carpool" | "capacity" | "insights";
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
  }[] = [
    { id: "corridors", label: "Corridors & Flows", icon: Route },
    { id: "temporal", label: "Peak Hours & Timing", icon: Clock },
    {
      id: "carpool",
      label: "Carpool Opportunities",
      icon: Sparkles,
      badge: carpoolOpportunities.length,
    },
    { id: "capacity", label: "Capacity & Pickups", icon: Car },
    { id: "insights", label: "Mobility Insights", icon: Zap },
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto pb-12 animate-in fade-in-50 duration-300">
      {/* Clean Modern Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <Compass className="h-3.5 w-3.5 text-purple-600" /> Admin Mobility Intelligence
            </span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs font-medium text-slate-500">CommuteX Analytics Engine</span>
            {isRefreshing && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold animate-pulse">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Live Syncing
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CommuteHub Intelligence
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Real-time arterial corridor flows, peak departure windows, employee commute clustering, and explainable carpool optimization.
          </p>
        </div>

        {/* Clean Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center">
          {/* Campus Selector (Super Admin) */}
          {isSuperAdmin ? (
            <div className="w-48">
              <Select value={selectedCampus} onValueChange={setSelectedCampus}>
                <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-xs font-medium focus:ring-purple-500 shadow-2xs">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
                  <SelectValue placeholder="All Campuses" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200 text-slate-800">
                  <SelectItem value="all" className="text-xs font-medium">
                    All Campuses (Global)
                  </SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.campusId} value={c.campusId} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-purple-600" />
              <span>{campusAdminId || "Assigned Campus"}</span>
            </div>
          )}

          {/* Date Range Selector */}
          <div className="w-36">
            <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
              <SelectTrigger className="h-9 bg-white border-slate-200 text-slate-800 text-xs font-medium focus:ring-purple-500 shadow-2xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-slate-500 shrink-0" />
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
            className="h-9 text-xs rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* 5 Well-Spaced, Balanced KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Metric 1 */}
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Commutes</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <Route className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {overview?.totalCarpoolsAnalyzed ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">rides</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {overview?.scheduledActiveRides ?? 0} active · {overview?.completedRides ?? 0} completed
            </p>
          </div>
        </Card>

        {/* Metric 2 */}
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Commuters</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Users className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {overview?.totalCommuters ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">people</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {overview?.uniqueDrivers ?? 0} drivers · {overview?.uniquePassengers ?? 0} passengers
            </p>
          </div>
        </Card>

        {/* Metric 3 */}
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fleet Occupancy</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">
              {overview?.avgOccupancyRate ?? 0}%
            </div>
            <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, overview?.avgOccupancyRate || 0)}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              {overview?.unusedSeatCapacity ?? 0} vacant seats available
            </p>
          </div>
        </Card>

        {/* Metric 4 */}
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Carbon Avoided</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <Leaf className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              {overview?.estimatedCo2SavedKg ?? 0}
              <span className="text-xs font-normal text-slate-400 ml-1">kg CO₂</span>
            </div>
            <p className="text-[11px] text-teal-600 font-medium mt-0.5">
              {overview?.totalPassengerDistanceKm ?? 0} carpooled km
            </p>
          </div>
        </Card>

        {/* Metric 5 */}
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fuel Cost Saved</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <IndianRupee className="h-4.5 w-4.5" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-slate-900 tracking-tight">
              ₹{overview?.estimatedCostSavedInr?.toLocaleString() ?? 0}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Employee transit savings
            </p>
          </div>
        </Card>
      </div>

      {/* Sleek Segmented Navigation Tab Bar */}
      <div className="bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 inline-flex items-center gap-1 overflow-x-auto max-w-full">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/70 font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", isActive ? "text-purple-600" : "text-slate-400")} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px] font-bold",
                    isActive ? "bg-purple-100 text-purple-700" : "bg-slate-200/70 text-slate-600"
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Corridors & Flows */}
      {activeTab === "corridors" && (
        <div className="space-y-5">
          {/* Top Corridors List */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
            <CardHeader className="p-5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Route className="h-4 w-4 text-purple-600" />
                    Top Commuting Corridors
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Arterial routes automatically detected from driver starting points, intermediate passenger stops, and campus destinations.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-purple-700 border-purple-200 bg-purple-50/50 text-xs w-fit">
                  {corridors.length} Identified {corridors.length === 1 ? "Corridor" : "Corridors"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5 pt-2 space-y-3.5">
              {corridors.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-purple-300 hover:shadow-xs transition-all space-y-3"
                >
                  {/* Row 1: Title & Top Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{c.name}</span>
                      {c.status === "high_demand" && (
                        <Badge className="bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                          High Demand
                        </Badge>
                      )}
                      {c.status === "balanced" && (
                        <Badge className="bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                          Balanced
                        </Badge>
                      )}
                      {c.status === "underserved" && (
                        <Badge className="bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200">
                          Underserved
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Volume</span>
                        <span className="font-bold text-slate-900">{c.totalRides} rides</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Occupancy</span>
                        <span className="font-bold text-emerald-600">{c.occupancyRate}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block">Avg Fare</span>
                        <span className="font-bold text-slate-900">₹{c.avgPrice}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed">{c.description}</p>

                  {/* Row 2: Route Pathway / Stops (Visual Sequence) */}
                  {c.frequentStops.length > 0 && (
                    <div className="p-3 bg-slate-50/70 border border-slate-200/70 rounded-xl space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                        <MapPin className="h-3 w-3 text-purple-600" />
                        <span>Observed Stops & Route Sequence</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {c.frequentStops.map((stop, sIdx) => (
                          <React.Fragment key={sIdx}>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs">
                              <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                              {stop.name}
                              <span className="text-[10px] text-slate-400 font-normal">({stop.count} trips)</span>
                            </span>
                            {sIdx < c.frequentStops.length - 1 && (
                              <ArrowRight className="h-3 w-3 text-slate-300 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Row 3: Meta details */}
                  <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-3">
                      <span>{c.uniqueDrivers} active drivers</span>
                      <span>·</span>
                      <span>{c.uniquePassengers} registered passengers</span>
                      <span>·</span>
                      <span>{c.totalSeatsBooked}/{c.totalSeatsOffered} seats filled</span>
                    </div>
                    <span className="font-medium text-slate-600">Average Distance: {c.avgDistanceKm} km</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Frequent Origins & Frequent Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Origins */}
            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Frequent Commuter Origins
                </CardTitle>
                <CardDescription className="text-xs">
                  Primary residential neighborhoods where employees initiate commutes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
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
            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
              <CardHeader className="p-5 pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-purple-600" />
                  Frequent Campus Destinations
                </CardTitle>
                <CardDescription className="text-xs">
                  Terminal dropoff facilities and campus delivery destinations.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-2 space-y-3">
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
        <div className="space-y-5">
          {/* Peak Callout Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Morning Inbound Peak</span>
                <p className="text-base font-bold text-slate-900">{patterns?.peakMorningWindow || "08:15 AM – 09:15 AM"}</p>
                <p className="text-[11px] text-amber-600 font-medium">To Campus Gates</p>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Evening Outbound Peak</span>
                <p className="text-base font-bold text-slate-900">{patterns?.peakEveningWindow || "05:30 PM – 06:45 PM"}</p>
                <p className="text-[11px] text-purple-600 font-medium">From Campus to Residential Hubs</p>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl p-4 flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Directional Split</span>
                <p className="text-base font-bold text-slate-900">
                  {patterns?.directionalSplit.pickupPercent ?? 58}% Inbound / {patterns?.directionalSplit.dropPercent ?? 42}% Outbound
                </p>
                <p className="text-[11px] text-emerald-600 font-medium">Balanced Daily Flow</p>
              </div>
            </Card>
          </div>

          {/* Rush Hour Distribution Chart */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-purple-600" />
                Hourly Commute Distribution (Rush Hour Curve)
              </CardTitle>
              <CardDescription className="text-xs">
                Observed ride departures and capacity volumes across 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
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
                    <Bar dataKey="pickupRides" name="Inbound (To Campus)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="dropRides" name="Outbound (From Campus)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Day of Week Breakdown */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-slate-700" />
                Day-of-Week Commute Density
              </CardTitle>
              <CardDescription className="text-xs">
                Weekly attendance density indicating hybrid vs on-site carpooling volume.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                {patterns?.dayOfWeekDistribution.map((d, idx) => (
                  <div key={idx} className="p-3 bg-slate-50/70 border border-slate-200 rounded-xl text-center space-y-1">
                    <span className="text-xs font-bold text-slate-700">{d.day.substring(0, 3)}</span>
                    <p className="text-lg font-bold text-purple-700">{d.ridesCount}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{d.occupancyRate}% occupancy</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 3: Carpool Opportunities */}
      {activeTab === "carpool" && (
        <div className="space-y-4">
          <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-2xl flex items-start gap-3 text-purple-900 text-xs leading-relaxed">
            <Sparkles className="h-4.5 w-4.5 text-purple-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-purple-950">
                Automated Commuter Clustering & Carpool Matching
              </p>
              <p className="mt-0.5 text-slate-600">
                These high-confidence opportunities are detected by comparing recurring employee commute corridors, departure windows, and vehicle excess capacity without altering CommuteX driver preferences.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {carpoolOpportunities.map((opp) => (
              <Card key={opp.id} className="border-slate-200 bg-white shadow-2xs rounded-2xl hover:border-purple-300 hover:shadow-xs transition-all">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-purple-100 text-purple-800 text-[11px] font-bold border-purple-200">
                      {opp.matchScore}% Match Score
                    </Badge>
                    <span className="text-[11px] font-medium text-slate-500">{opp.timeWindow}</span>
                  </div>
                  <CardTitle className="text-sm font-bold text-slate-900 mt-2">{opp.corridor}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-3">
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate"><strong>From:</strong> {opp.originArea}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <Building2 className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span className="truncate"><strong>To:</strong> {opp.destinationArea}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs">
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-semibold block">Empty Seats</span>
                      <span className="font-bold text-slate-800">{opp.availableSeats} available</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase text-[10px] font-semibold block">Demand</span>
                      <span className="font-bold text-purple-700">{opp.passengerDemand} seeking rides</span>
                    </div>
                  </div>

                  <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-lg text-[11px] text-emerald-800 flex items-center justify-between">
                    <span>Potential vehicle reduction:</span>
                    <strong className="font-bold text-emerald-900">-{opp.potentialVehicleReduction} cars/day</strong>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    <span>Days: {opp.recurringDays.join(", ")}</span>
                    <span className="text-emerald-700 font-semibold">+{opp.estimatedDailyCo2SavingKg} kg CO₂</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Capacity & Pickups */}
      {activeTab === "capacity" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Car className="h-4 w-4 text-purple-600" />
                  Vehicle Seat Capacity Status
                </CardTitle>
                <CardDescription className="text-xs">
                  Fleet-wide seat allocation and empty seat recovery targets.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
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

            <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-600" />
                  Demand Density & Transit Policy
                </CardTitle>
                <CardDescription className="text-xs">
                  Guidance for optimizing employee boarding efficiency along primary transit routes.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
                  <p className="font-bold">Unused Seat Recovery Plan</p>
                  <p>
                    Currently, {capacity?.emptySeats ?? 0} seats travel empty daily. If CommuteX drivers add recommended intermediate pickup spots, seat utilization is projected to increase significantly.
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
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl">
            <CardHeader className="p-5 pb-3">
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
            <CardContent className="p-5 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recommendedPickupAreas.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:shadow-xs transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-900 leading-snug">{rec.name}</h4>
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] shrink-0 font-bold">
                        {rec.observedCommuterDemand} commuters
                      </Badge>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-0.5">
                      <p><strong>Corridor:</strong> {rec.corridor}</p>
                      <p><strong>Peak Window:</strong> {rec.peakWindow}</p>
                      <p className="text-slate-400 text-[10px]">Coordinates: {rec.latitude}, {rec.longitude}</p>
                    </div>

                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 leading-relaxed">
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
              <Card
                key={ins.id}
                className={cn(
                  "border-slate-200 bg-white shadow-2xs rounded-2xl hover:shadow-xs transition-all border-l-4",
                  ins.severity === "high" && "border-l-rose-500",
                  ins.severity === "medium" && "border-l-amber-500",
                  ins.severity === "info" && "border-l-blue-500"
                )}
              >
                <CardHeader className="p-5 pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {ins.category} Insight
                    </span>
                    {ins.severity === "high" && (
                      <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                        High Priority
                      </Badge>
                    )}
                    {ins.severity === "medium" && (
                      <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                        Medium Priority
                      </Badge>
                    )}
                    {ins.severity === "info" && (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                        Observation
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base font-bold text-slate-900 mt-2">{ins.title}</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0 space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">{ins.description}</p>
                  <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Quantified Impact:</span>
                    <strong className="font-bold text-purple-800">{ins.impactMetric}</strong>
                  </div>
                  <div className="text-xs text-slate-700 space-y-0.5">
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
