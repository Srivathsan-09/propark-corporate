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
  MapPin,
  ArrowRight,
  Zap,
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
      console.error("Failed to fetch CommuteHub data:", err);
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
        <CarLoader size="page" message="Loading CommuteHub mobility metrics..." />
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
    { id: "corridors", label: "Corridors", icon: Route },
    { id: "temporal", label: "Peak Hours", icon: Clock },
    {
      id: "carpool",
      label: "Carpool Matches",
      icon: Sparkles,
      badge: carpoolOpportunities.length,
    },
    { id: "capacity", label: "Capacity & Pickups", icon: Car },
    { id: "insights", label: "Insights", icon: Zap },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10 animate-in fade-in-50 duration-300">
      {/* Natural, Compact Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              CommuteHub
            </h1>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] font-semibold py-0.5 px-2">
              Admin Analytics
            </Badge>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Updating
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Commute corridor flows, peak hours, and vehicle seat utilization.
          </p>
        </div>

        {/* Compact Filters */}
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

      {/* Small, Compact KPI Boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {/* Box 1 */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Commutes</span>
            <div className="p-1 rounded-md bg-purple-50 text-purple-600">
              <Route className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900">{overview?.totalCarpoolsAnalyzed ?? 0}</span>
            <span className="text-[11px] text-slate-500">rides</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {overview?.scheduledActiveRides ?? 0} active · {overview?.completedRides ?? 0} done
          </p>
        </div>

        {/* Box 2 */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Commuters</span>
            <div className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900">{overview?.totalCommuters ?? 0}</span>
            <span className="text-[11px] text-slate-500">people</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {overview?.uniqueDrivers ?? 0} drivers · {overview?.uniquePassengers ?? 0} passengers
          </p>
        </div>

        {/* Box 3 */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seat Occupancy</span>
            <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-bold text-emerald-600">{overview?.avgOccupancyRate ?? 0}%</span>
          </div>
          <div className="mt-1 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.min(100, overview?.avgOccupancyRate || 0)}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            {overview?.unusedSeatCapacity ?? 0} vacant seats
          </p>
        </div>

        {/* Box 4 */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carbon Avoided</span>
            <div className="p-1 rounded-md bg-teal-50 text-teal-600">
              <Leaf className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-bold text-teal-700">{overview?.estimatedCo2SavedKg ?? 0}</span>
            <span className="text-[11px] text-slate-500">kg CO₂</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {overview?.totalPassengerDistanceKm ?? 0} carpool km
          </p>
        </div>

        {/* Box 5 */}
        <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost Saved</span>
            <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
              <IndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-lg font-bold text-slate-900">₹{overview?.estimatedCostSavedInr?.toLocaleString() ?? 0}</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            Commuter fuel savings
          </p>
        </div>
      </div>

      {/* Compact Segmented Tabs */}
      <div className="bg-slate-100/90 p-1 rounded-lg border border-slate-200/80 inline-flex items-center gap-1 overflow-x-auto max-w-full">
        {tabItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-white text-slate-900 shadow-2xs font-semibold"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Icon className={cn("h-3 w-3", isActive ? "text-purple-600" : "text-slate-400")} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.1 rounded-full text-[9px] font-bold",
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

      {/* Tab 1: Corridors & Flows */}
      {activeTab === "corridors" && (
        <div className="space-y-3.5">
          {/* Corridors List */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Route className="h-4 w-4 text-purple-600" />
                  Commute Corridors
                </h3>
                <p className="text-[11px] text-slate-500">
                  Arterial routes connecting origin points, intermediate stops, and campus gates.
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                {corridors.length} {corridors.length === 1 ? "Corridor" : "Corridors"}
              </span>
            </div>

            <div className="space-y-2.5">
              {corridors.map((c, idx) => (
                <div
                  key={c.id || idx}
                  className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 hover:bg-white hover:border-slate-300 transition-all space-y-2"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900">{c.name}</span>
                      {c.status === "high_demand" && (
                        <span className="bg-emerald-50 text-emerald-700 text-[10px] font-medium border border-emerald-200 px-1.5 py-0.2 rounded">
                          High Demand
                        </span>
                      )}
                      {c.status === "balanced" && (
                        <span className="bg-blue-50 text-blue-700 text-[10px] font-medium border border-blue-200 px-1.5 py-0.2 rounded">
                          Balanced
                        </span>
                      )}
                      {c.status === "underserved" && (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-medium border border-amber-200 px-1.5 py-0.2 rounded">
                          Underserved
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-600">
                      <span><strong>{c.totalRides}</strong> rides</span>
                      <span>·</span>
                      <span className="text-emerald-700 font-semibold">{c.occupancyRate}% filled</span>
                      <span>·</span>
                      <span>₹{c.avgPrice} avg</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">{c.description}</p>

                  {/* Compact Route Sequence */}
                  {c.frequentStops.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-700 pt-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase mr-1">Route:</span>
                      {c.frequentStops.map((stop, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <span className="bg-white border border-slate-200 px-1.5 py-0.5 rounded text-[11px] text-slate-700">
                            {stop.name}
                          </span>
                          {sIdx < c.frequentStops.length - 1 && (
                            <ArrowRight className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                    <span>{c.uniqueDrivers} drivers · {c.uniquePassengers} passengers</span>
                    <span>Distance: {c.avgDistanceKm} km</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compact Frequent Origins & Destinations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Origins */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                Frequent Origin Areas
              </h4>
              <div className="space-y-2">
                {frequentOrigins.map((area, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{area.name}</span>
                      <span className="text-slate-400">{area.ridesCount} rides ({area.percentage}%)</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, area.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Destinations */}
            <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs space-y-2.5">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-purple-600" />
                Frequent Campus Destinations
              </h4>
              <div className="space-y-2">
                {frequentDestinations.map((area, idx) => (
                  <div key={idx} className="space-y-0.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{area.name}</span>
                      <span className="text-slate-400">{area.ridesCount} rides ({area.percentage}%)</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
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

      {/* Tab 2: Peak Hours */}
      {activeTab === "temporal" && (
        <div className="space-y-3.5">
          {/* Small Peak Windows */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Morning Rush</span>
                <span className="text-sm font-bold text-slate-900">{patterns?.peakMorningWindow || "08:15 AM – 09:15 AM"}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Evening Rush</span>
                <span className="text-sm font-bold text-slate-900">{patterns?.peakEveningWindow || "05:30 PM – 06:45 PM"}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Direction</span>
                <span className="text-sm font-bold text-slate-900">
                  {patterns?.directionalSplit.pickupPercent ?? 58}% In / {patterns?.directionalSplit.dropPercent ?? 42}% Out
                </span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-purple-600" />
              Hourly Departures
            </h4>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={patterns?.rushHourDistribution || []}
                  margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: "6px",
                      color: "#fff",
                      fontSize: "11px",
                      padding: "6px 10px",
                    }}
                  />
                  <Bar dataKey="pickupRides" name="Inbound" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="dropRides" name="Outbound" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Day of Week */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs">
            <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-600" />
              Weekly Commute Volume
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {patterns?.dayOfWeekDistribution.map((d, idx) => (
                <div key={idx} className="p-2 bg-slate-50 border border-slate-200/70 rounded-lg text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">{d.day.substring(0, 3)}</span>
                  <span className="text-sm font-bold text-purple-700">{d.ridesCount}</span>
                  <span className="text-[9px] text-slate-400 block">{d.occupancyRate}% occ.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Carpool Matches (2nd box removed; compact cards) */}
      {activeTab === "carpool" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {carpoolOpportunities.map((opp) => (
            <div
              key={opp.id}
              className="bg-white border border-slate-200/80 rounded-xl p-3.5 shadow-2xs hover:border-slate-300 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{opp.corridor}</span>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] font-bold">
                  {opp.matchScore}% Match
                </Badge>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2 rounded-lg">
                <div className="truncate"><strong>From:</strong> {opp.originArea}</div>
                <div className="truncate"><strong>To:</strong> {opp.destinationArea}</div>
                <div><strong>Time:</strong> {opp.timeWindow}</div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                <span className="text-slate-500">{opp.availableSeats} empty seats</span>
                <span className="text-emerald-700 font-semibold">{opp.passengerDemand} seeking rides</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Capacity & Pickups (3rd box removed; compact widgets) */}
      {activeTab === "capacity" && (
        <div className="space-y-3.5">
          {/* Seat Capacity Widget */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Car className="h-3.5 w-3.5 text-purple-600" />
                  Vehicle Seat Capacity Breakdown
                </h4>
                <p className="text-[11px] text-slate-500">
                  Fleet-wide seat allocation across active carpool vehicles.
                </p>
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-500 font-medium">Filled / Total: </span>
                <strong className="text-emerald-700">{capacity?.filledSeats ?? 0}</strong>
                <span className="text-slate-400"> / {capacity?.totalCapacitySeats ?? 0} seats</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {capacity?.vehicleTypeBreakdown.map((v, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                  <span className="font-medium text-slate-700">{v.type} ({v.ridesCount})</span>
                  <span className="font-semibold text-emerald-600">{v.avgOccupancyRate}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recommended Pickup Areas (Compact) */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-purple-600" />
                  Recommended Boarding Areas
                </h4>
                <p className="text-[11px] text-slate-500">
                  Areas with frequent commuter requests to help drivers plan intermediate stops.
                </p>
              </div>
              <span className="text-[10px] text-slate-500 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Advisory Insights
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {recommendedPickupAreas.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/40 hover:bg-white transition-all space-y-1.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <span className="font-bold text-slate-900 leading-snug">{rec.name}</span>
                    <span className="bg-purple-50 text-purple-700 text-[10px] font-bold border border-purple-200 px-1.5 py-0.2 rounded shrink-0">
                      {rec.observedCommuterDemand} commuters
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    <span>{rec.corridor}</span> · <span>{rec.peakWindow}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200/60 leading-relaxed">
                    {rec.rationale}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Insights (Natural, compact list instead of 4 giant AI cards) */}
      {activeTab === "insights" && (
        <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-600" />
                Mobility Observations & Actions
              </h4>
              <p className="text-[11px] text-slate-500">
                Key patterns and transit actions based on observed employee rides.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">
              {insights.length} Observations
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {insights.map((ins) => (
              <div key={ins.id} className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">{ins.title}</span>
                    {ins.severity === "high" && (
                      <span className="text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.2 rounded">
                        High
                      </span>
                    )}
                    {ins.severity === "medium" && (
                      <span className="text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                        Medium
                      </span>
                    )}
                    {ins.severity === "info" && (
                      <span className="text-[9px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                        Note
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{ins.description}</p>
                  <p className="text-[11px] text-slate-700 font-medium">
                    <span className="text-slate-400">Action:</span> {ins.recommendedAction}
                  </p>
                </div>

                <div className="text-right shrink-0 self-start sm:self-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Impact</span>
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
