"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Compass,
  Plus,
  Search,
  MapPin,
  Route,
  Users,
  Car,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  Edit3,
  Trash2,
  Power,
  Building2,
  Map as MapIcon,
  RefreshCw,
  Layers,
  TrendingUp,
  BarChart3,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  IndianRupee,
  Leaf,
  Calendar,
  ArrowUpRight,
  Activity,
  Flame,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";
import type {
  ICommuteHubOverview,
  ICorridorMetric,
  IPatternMetric,
  IDemandMetric,
  ISmartRecommendation,
} from "@/lib/services/commuteHubAnalytics";

interface IHubItem {
  _id: string;
  hubId: string;
  name: string;
  corridor: string;
  origin: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  campusId: string;
  campusName: string;
  distanceKm: number;
  durationMinutes: number;
  status: "active" | "inactive";
  activeRidesCount: number;
  commutersCount: number;
  createdAt: string;
}

export default function CommuteHubAdminDashboard() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab State
  const initialTab = searchParams.get("tab") || "overview";
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  // Data States
  const [overview, setOverview] = useState<ICommuteHubOverview | null>(null);
  const [corridors, setCorridors] = useState<ICorridorMetric[]>([]);
  const [patterns, setPatterns] = useState<IPatternMetric | null>(null);
  const [demand, setDemand] = useState<IDemandMetric | null>(null);
  const [recommendations, setRecommendations] = useState<ISmartRecommendation[]>([]);
  const [hubs, setHubs] = useState<IHubItem[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Corridors & Hub Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [corridorFilter, setCorridorFilter] = useState<string>("all");
  const [recFilter, setRecFilter] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  // Sync tab with URL if changed
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && t !== activeTab) {
      setActiveTab(t);
    }
  }, [searchParams]);

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", newTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const fetchAnalytics = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [overviewRes, corridorsRes, patternsRes, demandRes, recsRes, hubsRes] = await Promise.all([
        fetch("/api/admin/commutehub/overview"),
        fetch("/api/admin/commutehub/corridors"),
        fetch("/api/admin/commutehub/patterns"),
        fetch("/api/admin/commutehub/demand"),
        fetch("/api/admin/commutehub/recommendations"),
        fetch("/api/commutehub/hubs"),
      ]);

      if (overviewRes.ok) {
        const d = await overviewRes.json();
        if (d.success) setOverview(d.data);
      }
      if (corridorsRes.ok) {
        const d = await corridorsRes.json();
        if (d.success) setCorridors(d.data.corridors || []);
      }
      if (patternsRes.ok) {
        const d = await patternsRes.json();
        if (d.success) setPatterns(d.data.patterns);
      }
      if (demandRes.ok) {
        const d = await demandRes.json();
        if (d.success) setDemand(d.data.demand);
      }
      if (recsRes.ok) {
        const d = await recsRes.json();
        if (d.success) setRecommendations(d.data.recommendations || []);
      }
      if (hubsRes.ok) {
        const d = await hubsRes.json();
        if (d.hubs) setHubs(d.hubs);
      }
    } catch (err: any) {
      console.error("CommuteHub dashboard load error:", err);
      setError(err.message || "Failed to load CommuteHub analytics.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  // Hub status toggle handler
  const handleToggleStatus = async (hub: IHubItem) => {
    const nextStatus = hub.status === "active" ? "inactive" : "active";
    setActionLoadingId(hub._id);
    try {
      const res = await fetch(`/api/commutehub/hubs/${hub._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update hub status.");
      }
      setHubs((prev) =>
        prev.map((h) => (h._id === hub._id ? { ...h, status: nextStatus } : h))
      );
    } catch (err: any) {
      alert(err.message || "Failed to toggle hub status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered Corridors
  const filteredCorridors = useMemo(() => {
    return corridors.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name.toLowerCase().includes(q);
        const matchStop = c.frequentStops.some((s) => s.name.toLowerCase().includes(q));
        if (!matchName && !matchStop) return false;
      }
      if (corridorFilter !== "all" && c.status !== corridorFilter) return false;
      return true;
    });
  }, [corridors, searchQuery, corridorFilter]);

  // Filtered Recommendations
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((r) => {
      if (recFilter !== "all" && r.severity !== recFilter && r.type !== recFilter) {
        return false;
      }
      return true;
    });
  }, [recommendations, recFilter]);

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <CarLoader size="page" message="Loading CommuteHub Corporate Intelligence..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300 max-w-7xl mx-auto pt-0 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2 leading-tight">
              <Compass className="h-5 w-5 text-emerald-600" />
              CommuteHub Intelligence
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border-emerald-200">
              Admin Analytical Engine
            </Badge>
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" /> Syncing
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time corridor analytics, demand pattern tracking, and optimization intelligence derived from CommuteX.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/map">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 h-8">
              <MapIcon className="h-3.5 w-3.5 text-slate-500" />
              Corridor Map
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchAnalytics(true)}
            disabled={isRefreshing}
            className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 h-8"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Strip */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl overflow-x-auto text-xs font-semibold border border-slate-200/80">
        <button
          onClick={() => handleTabChange("overview")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "overview"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Activity className="h-3.5 w-3.5 text-emerald-600" /> Overview
        </button>

        <button
          onClick={() => handleTabChange("corridors")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "corridors"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Route className="h-3.5 w-3.5 text-indigo-600" /> Corridors ({corridors.length})
        </button>

        <button
          onClick={() => handleTabChange("patterns")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "patterns"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 text-purple-600" /> Travel Patterns
        </button>

        <button
          onClick={() => handleTabChange("demand")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "demand"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5 text-amber-600" /> Demand & Deficit
        </button>

        <button
          onClick={() => handleTabChange("recommendations")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "recommendations"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-rose-500" /> Recommendations ({recommendations.length})
        </button>

        <button
          onClick={() => handleTabChange("manage")}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all whitespace-nowrap ${
            activeTab === "manage"
              ? "bg-white text-slate-900 shadow-xs font-bold"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-slate-500" /> Manage Corridors ({hubs.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Carpools Analyzed</span>
                <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Car className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {overview?.totalCarpoolsAnalyzed || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Active: <strong>{overview?.scheduledActiveRides || 0}</strong></span>
                <span>Completed: <strong>{overview?.completedRides || 0}</strong></span>
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Active Commuters</span>
                <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">
                {overview?.totalCommuters || 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Drivers: <strong>{overview?.totalDrivers || 0}</strong></span>
                <span>Passengers: <strong>{overview?.totalPassengers || 0}</strong></span>
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Network Occupancy</span>
                <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-indigo-600 mt-2">
                {overview?.avgOccupancyRate || 0}%
              </div>
              <div className="text-[11px] text-slate-500 mt-1 pt-2 border-t border-slate-100">
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full"
                    style={{ width: `${overview?.avgOccupancyRate || 0}%` }}
                  />
                </div>
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase">
                <span>Corporate Savings</span>
                <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <IndianRupee className="h-4 w-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-emerald-700 mt-2">
                ₹{overview?.estimatedCostSavedInr ? overview.estimatedCostSavedInr.toLocaleString() : 0}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between pt-2 border-t border-slate-100">
                <span>Distance: <strong>{overview?.totalPassengerDistanceKm || 0} km</strong></span>
                <span className="text-emerald-700 font-semibold">🌱 {overview?.estimatedCo2SavedKg || 0} kg CO₂</span>
              </div>
            </Card>
          </div>

          {/* Quick Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Route className="h-4 w-4 text-emerald-600" /> Primary Commute Arterial
              </div>
              <div className="text-sm font-bold text-slate-900 mt-2">
                {overview?.topCorridorName || "OMR IT Express Corridor"}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Highest concentration of daily campus carpools and verified colleague commuters.
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleTabChange("corridors")}
                  className="text-emerald-700 hover:underline font-semibold text-[11px] flex items-center gap-1"
                >
                  View all corridors <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-purple-600" /> Peak Congestion Windows
              </div>
              <div className="space-y-1.5 mt-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Morning Pickup:</span>
                  <span className="font-bold text-slate-900">{patterns?.peakMorningWindow || "08:00 – 09:30 AM"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Evening Return:</span>
                  <span className="font-bold text-slate-900">{patterns?.peakEveningWindow || "17:30 – 19:00 PM"}</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleTabChange("patterns")}
                  className="text-purple-700 hover:underline font-semibold text-[11px] flex items-center gap-1"
                >
                  Inspect temporal curves <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-rose-500" /> Actionable Recommendations
              </div>
              <div className="text-sm font-bold text-slate-900 mt-2">
                {recommendations.length} Active Operational Proposals
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Data-driven proposals to eliminate passenger wait times and boost colleague carpooling.
              </p>
              <div className="mt-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleTabChange("recommendations")}
                  className="text-rose-700 hover:underline font-semibold text-[11px] flex items-center gap-1"
                >
                  Review recommendations <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: CORRIDORS INTELLIGENCE */}
      {activeTab === "corridors" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search corridors, residential clusters, stops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={corridorFilter}
                onChange={(e) => setCorridorFilter(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-xl px-2.5 bg-white text-slate-700 font-semibold"
              >
                <option value="all">All Demand Levels</option>
                <option value="high_demand">High Demand (&ge;75% Occupancy)</option>
                <option value="balanced">Balanced</option>
                <option value="underserved">Underserved Capacity</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCorridors.map((corridor) => (
              <Card key={corridor.id} className="rounded-2xl border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <Route className="h-4 w-4 text-emerald-600" />
                        {corridor.name}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{corridor.description}</p>
                    </div>

                    <Badge
                      className={`text-[9px] font-bold px-2 py-0.5 ${
                        corridor.status === "high_demand"
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : corridor.status === "underserved"
                          ? "bg-amber-100 text-amber-800 border-amber-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }`}
                    >
                      {corridor.status === "high_demand"
                        ? "High Demand"
                        : corridor.status === "underserved"
                        ? "Underserved"
                        : "Balanced"}
                    </Badge>
                  </div>

                  {/* Corridor Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Commutes</span>
                      <span className="font-bold text-slate-900 text-sm">{corridor.totalRides}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Commuters</span>
                      <span className="font-bold text-slate-900 text-sm">{corridor.uniqueDrivers + corridor.uniquePassengers}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Fare Volume</span>
                      <span className="font-bold text-emerald-700 text-sm">₹{corridor.totalFare}</span>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Seat Occupancy</span>
                      <span className="font-bold text-slate-900">
                        {corridor.totalSeatsBooked} / {corridor.totalSeatsOffered} ({corridor.occupancyRate}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          corridor.occupancyRate >= 75
                            ? "bg-rose-500"
                            : corridor.occupancyRate >= 45
                            ? "bg-emerald-600"
                            : "bg-amber-500"
                        }`}
                        style={{ width: `${corridor.occupancyRate}%` }}
                      />
                    </div>
                  </div>

                  {/* Frequent Stops */}
                  {corridor.frequentStops.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">
                        Frequent Pickups on Corridor:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {corridor.frequentStops.map((st, sIdx) => (
                          <span
                            key={sIdx}
                            className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-[10px] text-slate-700 font-medium"
                          >
                            {st.name} <span className="text-slate-400">({st.count} rides • ₹{st.avgPrice})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Avg Distance: <strong>{corridor.avgDistanceKm} km</strong></span>
                  <span>Avg Travel Time: <strong>{corridor.avgDurationMins} mins</strong></span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: TRAVEL PATTERNS */}
      {activeTab === "patterns" && (
        <div className="space-y-4">
          {/* Rush Hour Time Distributions */}
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                Hourly Commute Distribution (Rush Hours)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aggregate pickup vs drop departure time bands across campus corporate carpools.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {patterns?.rushHourDistribution.map((slot) => {
                const maxRides = Math.max(1, ...patterns.rushHourDistribution.map((s) => s.totalRides));
                const barWidth = Math.round((slot.totalRides / maxRides) * 100);

                return (
                  <div key={slot.hour} className="flex items-center gap-3 text-xs">
                    <span className="w-12 font-mono font-bold text-slate-600 shrink-0 text-right">
                      {slot.hour}
                    </span>
                    <div className="flex-1 bg-slate-100 h-6 rounded-lg overflow-hidden flex relative">
                      <div
                        className="bg-amber-400 h-full transition-all"
                        style={{ width: `${slot.totalRides > 0 ? (slot.pickupRides / slot.totalRides) * barWidth : 0}%` }}
                        title={`Morning Pickup: ${slot.pickupRides}`}
                      />
                      <div
                        className="bg-indigo-600 h-full transition-all"
                        style={{ width: `${slot.totalRides > 0 ? (slot.dropRides / slot.totalRides) * barWidth : 0}%` }}
                        title={`Evening Drop: ${slot.dropRides}`}
                      />
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-slate-800">
                        {slot.totalRides > 0 ? `${slot.totalRides} rides (${slot.passengers} passengers)` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-4 text-xs pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-amber-400" /> Morning Pickup (to Campus)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-md bg-indigo-600" /> Evening Drop (from Campus)
              </span>
            </div>
          </Card>

          {/* Weekday Trends */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4 space-y-3">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-600" /> Day-of-Week Attendance Profile
              </div>
              <div className="space-y-2 text-xs">
                {patterns?.dayOfWeekDistribution.map((day) => (
                  <div key={day.day} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="font-bold text-slate-800">{day.day}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500">{day.ridesCount} carpools</span>
                      <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
                        {day.occupancyRate}% occupancy
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4 space-y-3">
              <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600" /> Commute Directional Balance
              </div>
              <div className="space-y-3 text-xs pt-1">
                <div>
                  <div className="flex justify-between text-slate-600 font-semibold mb-1">
                    <span>Morning Pickup</span>
                    <span>{patterns?.directionalSplit.pickupPercent || 50}% ({patterns?.directionalSplit.pickupCount || 0} rides)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${patterns?.directionalSplit.pickupPercent || 50}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-slate-600 font-semibold mb-1">
                    <span>Evening Drop</span>
                    <span>{patterns?.directionalSplit.dropPercent || 50}% ({patterns?.directionalSplit.dropCount || 0} rides)</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full"
                      style={{ width: `${patterns?.directionalSplit.dropPercent || 50}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: DEMAND & DEFICIT */}
      {activeTab === "demand" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Fully Claimed Carpools</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {demand?.fullyBookedRidesCount || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Rides where 100% of seats were filled</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="text-[10px] text-slate-400 font-bold uppercase">Unmet Passenger Requests</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">
                {demand?.totalRejectedRequests || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Requests rejected due to zero remaining seats</p>
            </Card>

            <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
              <div className="text-[10px] text-slate-400 font-bold uppercase">High-Demand Boarding Clusters</div>
              <div className="text-2xl font-bold text-indigo-600 mt-1">
                {demand?.topBoardingStops.length || 0}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Active pickup & drop intermediate hot zones</p>
            </Card>
          </div>

          {/* Top Boarding Points Table */}
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900">
                Top Passenger Boarding Hotspots
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Stops where colleague commuters request boarding most frequently across corridors.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100">
                    <tr>
                      <th className="py-2.5 px-4">Boarding Stop</th>
                      <th className="py-2.5 px-4">Corridor</th>
                      <th className="py-2.5 px-4 text-center">Total Requests</th>
                      <th className="py-2.5 px-4 text-center">Confirmed Passengers</th>
                      <th className="py-2.5 px-4 text-center">Unmet / Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demand?.topBoardingStops.map((stop, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                          {stop.stopName}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{stop.corridorName}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-800">{stop.totalRequests}</td>
                        <td className="py-3 px-4 text-center font-semibold text-emerald-700">
                          {stop.confirmedPassengers}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {stop.rejectedOrPending > 0 ? (
                            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                              {stop.rejectedOrPending}
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: SMART RECOMMENDATIONS */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">Filter Proposals:</span>
            <select
              value={recFilter}
              onChange={(e) => setRecFilter(e.target.value)}
              className="h-8 text-xs border border-slate-200 rounded-xl px-2.5 bg-white text-slate-700 font-semibold"
            >
              <option value="all">All Proposals</option>
              <option value="high">High Priority Only</option>
              <option value="medium">Medium Priority</option>
              <option value="supply_incentive">Driver Incentives</option>
              <option value="stop_optimization">Stop Optimizations</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRecommendations.map((rec) => (
              <Card key={rec.id} className="rounded-2xl border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      className={`text-[10px] font-bold ${
                        rec.severity === "high"
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : rec.severity === "medium"
                          ? "bg-blue-100 text-blue-800 border-blue-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {rec.severity.toUpperCase()} PRIORITY
                    </Badge>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      {rec.corridorOrArea}
                    </span>
                  </div>

                  <h2 className="font-bold text-sm text-slate-900">{rec.title}</h2>
                  <p className="text-xs text-slate-600">{rec.description}</p>

                  <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>Impact: {rec.impactMetric}</span>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-700">
                    <strong className="block text-slate-900 mb-0.5">Recommended Campus Action:</strong>
                    {rec.suggestedAction}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: MANAGE HUBS (PRESERVED) */}
      {activeTab === "manage" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Virtual Commute Corridors & Hubs</h2>
              <p className="text-xs text-slate-500">Configured departure and corridor stops on campus network.</p>
            </div>
            <Link href="/admin/hubs/create">
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5 h-8">
                <Plus className="h-3.5 w-3.5" /> Create Hub
              </Button>
            </Link>
          </div>

          {hubs.length === 0 ? (
            <Card className="p-12 text-center rounded-2xl border-slate-200 bg-white">
              <Layers className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <div className="text-sm font-bold text-slate-800">No Designated Hubs Registered</div>
              <p className="text-xs text-slate-500 mt-1">Create a hub to define designated corporate corridor meeting points.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hubs.map((hub) => (
                <Card key={hub._id} className="rounded-2xl border-slate-200 bg-white shadow-xs p-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">{hub.name}</span>
                      <Badge className={hub.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                        {hub.status}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Corridor: <strong>{hub.corridor}</strong>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Origin: {hub.origin?.name} → Campus
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actionLoadingId === hub._id}
                      onClick={() => handleToggleStatus(hub)}
                      className="h-7 text-xs rounded-lg"
                    >
                      <Power className="h-3 w-3 mr-1" />
                      {hub.status === "active" ? "Deactivate" : "Activate"}
                    </Button>

                    <Link href={`/admin/hubs/${hub._id}/edit`}>
                      <Button size="sm" variant="ghost" className="h-7 text-xs rounded-lg">
                        <Edit3 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
