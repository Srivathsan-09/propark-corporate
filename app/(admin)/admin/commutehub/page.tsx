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
  Download,
  FileSpreadsheet,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
      badge: corridors.length > 0 ? corridors.length : undefined,
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
    },
    {
      id: "tips",
      label: "Admin Insights",
      icon: Sparkles,
      badge: insights.length > 0 ? insights.length : undefined,
    },
  ];

  // CSV Export helpers
  const escapeCSV = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const s = String(val);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const triggerCSVDownload = (filename: string, content: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = (type: "all" | "corridors" | "hours" | "carpool" | "areas" = "all") => {
    if (!data) return;

    const dateStr = new Date().toISOString().split("T")[0];
    const campusLabel =
      selectedCampus === "all"
        ? "All_Campuses"
        : campuses.find((c) => c.campusId === selectedCampus)?.name.replace(/[^a-zA-Z0-9]/g, "_") ||
          selectedCampus;

    if (type === "corridors") {
      const headers = [
        "Corridor ID",
        "Corridor Name",
        "Origin",
        "Destination",
        "Status",
        "Total Rides",
        "Active Scheduled Rides",
        "Completed Rides",
        "Total Seats Offered",
        "Total Seats Booked",
        "Occupancy Rate (%)",
        "Unique Drivers",
        "Unique Passengers",
        "Average Distance (km)",
        "Average Price (INR)",
        "Frequent Stops",
      ];
      const rows = corridors.map((c) => [
        escapeCSV(c.id),
        escapeCSV(c.name),
        escapeCSV(c.originName || ""),
        escapeCSV(c.destinationName || ""),
        escapeCSV(c.status),
        c.totalRides ?? 0,
        c.scheduledRides ?? 0,
        c.completedRides ?? 0,
        c.totalSeatsOffered ?? 0,
        c.totalSeatsBooked ?? 0,
        c.occupancyRate ?? 0,
        c.uniqueDrivers ?? 0,
        c.uniquePassengers ?? 0,
        c.avgDistanceKm ?? 0,
        c.avgPrice ?? 0,
        escapeCSV(c.frequentStops?.map((s) => s.name).join("; ") || ""),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Corridors_${campusLabel}_${dateStr}.csv`, csv);
      return;
    }

    if (type === "hours") {
      const headers = [
        "Hour Window",
        "Total Rides",
        "Pickup Rides (To Campus)",
        "Drop Rides (From Campus)",
        "Seats Offered",
        "Seats Booked",
        "Occupancy Rate (%)",
      ];
      const distribution = patterns?.rushHourDistribution || [];
      const rows = distribution.map((h) => [
        escapeCSV(h.hour),
        h.totalRides ?? 0,
        h.pickupRides ?? 0,
        h.dropRides ?? 0,
        h.seatsOffered ?? 0,
        h.seatsBooked ?? 0,
        h.occupancyRate ?? 0,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Hourly_Patterns_${campusLabel}_${dateStr}.csv`, csv);
      return;
    }

    if (type === "carpool") {
      const headers = [
        "Opportunity ID",
        "Corridor",
        "Time Window",
        "Origin Area",
        "Destination Area",
        "Available Seats",
        "Passenger Demand",
        "Match Score (%)",
        "Potential Vehicle Reduction",
        "Estimated Daily CO2 Saved (kg)",
        "Recurring Days",
      ];
      const rows = carpoolOpportunities.map((op) => [
        escapeCSV(op.id),
        escapeCSV(op.corridor),
        escapeCSV(op.timeWindow),
        escapeCSV(op.originArea),
        escapeCSV(op.destinationArea),
        op.availableSeats ?? 0,
        op.passengerDemand ?? 0,
        op.matchScore ?? 0,
        op.potentialVehicleReduction ?? 0,
        op.estimatedDailyCo2SavingKg ?? 0,
        escapeCSV(op.recurringDays?.join(", ") || ""),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Carpool_Opportunities_${campusLabel}_${dateStr}.csv`, csv);
      return;
    }

    if (type === "areas") {
      const headers = ["Area Name", "Type", "Rides Count", "Commuters Count", "Percentage (%)"];
      const origins = (frequentOrigins || []).map((o) => [
        escapeCSV(o.name),
        escapeCSV("Origin"),
        o.ridesCount ?? 0,
        o.commutersCount ?? 0,
        o.percentage ?? 0,
      ]);
      const destinations = (frequentDestinations || []).map((d) => [
        escapeCSV(d.name),
        escapeCSV("Destination"),
        d.ridesCount ?? 0,
        d.commutersCount ?? 0,
        d.percentage ?? 0,
      ]);
      const rows = [...origins, ...destinations];
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Demand_Areas_${campusLabel}_${dateStr}.csv`, csv);
      return;
    }

    // Comprehensive Full Report
    const lines: string[] = [];
    lines.push(`"COMMUTEX CORPORATE MOBILITY & CARPOOL ANALYTICS REPORT"`);
    lines.push(`"Generated On",${escapeCSV(new Date().toLocaleString())}`);
    lines.push(`"Campus Filter",${escapeCSV(selectedCampus === "all" ? "All Campuses" : selectedCampus)}`);
    lines.push(`"Timeframe",${escapeCSV(selectedDateRange)}`);
    lines.push("");

    // Section 1: Executive KPI Overview
    lines.push(`"--- EXECUTIVE SUMMARY & KEY METRICS ---"`);
    lines.push(`"Metric","Value","Unit"`);
    lines.push(`"Total Carpools Analyzed",${overview?.totalCarpoolsAnalyzed ?? 0},"rides"`);
    lines.push(`"Scheduled Active Rides",${overview?.scheduledActiveRides ?? 0},"rides"`);
    lines.push(`"Completed Rides",${overview?.completedRides ?? 0},"rides"`);
    lines.push(`"Total Commuters",${overview?.totalCommuters ?? 0},"employees"`);
    lines.push(`"Unique Drivers",${overview?.uniqueDrivers ?? 0},"drivers"`);
    lines.push(`"Unique Passengers",${overview?.uniquePassengers ?? 0},"passengers"`);
    lines.push(`"Total Seats Offered",${overview?.totalSeatsOffered ?? 0},"seats"`);
    lines.push(`"Total Seats Booked",${overview?.totalSeatsBooked ?? 0},"seats"`);
    lines.push(`"Unused Seat Capacity",${overview?.unusedSeatCapacity ?? 0},"seats"`);
    lines.push(`"Average Occupancy Rate",${overview?.avgOccupancyRate ?? 0},"%"`);
    lines.push(`"Estimated Fuel Cost Saved",${overview?.estimatedCostSavedInr ?? 0},"INR"`);
    lines.push(`"Estimated CO2 Emissions Avoided",${overview?.estimatedCo2SavedKg ?? 0},"kg CO2"`);
    lines.push(`"Active Travel Corridors",${overview?.activeCorridorsCount ?? 0},"routes"`);
    lines.push("");

    // Section 2: Corridors
    lines.push(`"--- POPULAR TRAVEL ROUTES & CORRIDORS ---"`);
    lines.push(
      [
        "Corridor Name",
        "Origin",
        "Destination",
        "Status",
        "Total Rides",
        "Active Rides",
        "Completed Rides",
        "Seats Offered",
        "Seats Booked",
        "Occupancy Rate (%)",
        "Drivers",
        "Passengers",
        "Avg Distance (km)",
        "Avg Price (INR)",
        "Frequent Stops",
      ].map(escapeCSV).join(",")
    );
    corridors.forEach((c) => {
      lines.push(
        [
          escapeCSV(c.name),
          escapeCSV(c.originName || ""),
          escapeCSV(c.destinationName || ""),
          escapeCSV(c.status),
          c.totalRides ?? 0,
          c.scheduledRides ?? 0,
          c.completedRides ?? 0,
          c.totalSeatsOffered ?? 0,
          c.totalSeatsBooked ?? 0,
          c.occupancyRate ?? 0,
          c.uniqueDrivers ?? 0,
          c.uniquePassengers ?? 0,
          c.avgDistanceKm ?? 0,
          c.avgPrice ?? 0,
          escapeCSV(c.frequentStops?.map((s) => s.name).join("; ") || ""),
        ].join(",")
      );
    });
    lines.push("");

    // Section 3: Rush Hours
    lines.push(`"--- HOURLY DISTRIBUTION & BUSY HOURS ---"`);
    lines.push(
      [
        "Hour Window",
        "Total Rides",
        "Pickup Rides",
        "Drop Rides",
        "Seats Offered",
        "Seats Booked",
        "Occupancy Rate (%)",
      ].map(escapeCSV).join(",")
    );
    (patterns?.rushHourDistribution || []).forEach((h) => {
      lines.push(
        [
          escapeCSV(h.hour),
          h.totalRides ?? 0,
          h.pickupRides ?? 0,
          h.dropRides ?? 0,
          h.seatsOffered ?? 0,
          h.seatsBooked ?? 0,
          h.occupancyRate ?? 0,
        ].join(",")
      );
    });
    lines.push("");

    // Section 4: Carpool Opportunities
    lines.push(`"--- CARPOOL MATCHING & SEAT OPPORTUNITIES ---"`);
    lines.push(
      [
        "Corridor",
        "Time Window",
        "Origin Area",
        "Destination Area",
        "Available Seats",
        "Passenger Demand",
        "Match Score (%)",
        "Potential Vehicle Reduction",
        "Daily CO2 Saved (kg)",
      ].map(escapeCSV).join(",")
    );
    carpoolOpportunities.forEach((op) => {
      lines.push(
        [
          escapeCSV(op.corridor),
          escapeCSV(op.timeWindow),
          escapeCSV(op.originArea),
          escapeCSV(op.destinationArea),
          op.availableSeats ?? 0,
          op.passengerDemand ?? 0,
          op.matchScore ?? 0,
          op.potentialVehicleReduction ?? 0,
          op.estimatedDailyCo2SavingKg ?? 0,
        ].join(",")
      );
    });
    lines.push("");

    // Section 5: Recommended Pickup Areas
    if (recommendedPickupAreas.length > 0) {
      lines.push(`"--- RECOMMENDED PICKUP HUBS & AREAS ---"`);
      lines.push(["Area Name", "Corridor", "Observed Demand", "Peak Window", "Rationale"].map(escapeCSV).join(","));
      recommendedPickupAreas.forEach((p) => {
        lines.push(
          [
            escapeCSV(p.name),
            escapeCSV(p.corridor),
            p.observedCommuterDemand ?? 0,
            escapeCSV(p.peakWindow),
            escapeCSV(p.rationale),
          ].join(",")
        );
      });
    }

    triggerCSVDownload(`CommuteX_Analytics_Report_${campusLabel}_${dateStr}.csv`, lines.join("\r\n"));
  };

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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={!data || isLoading}
                className="h-8 text-xs rounded-lg border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 px-2.5 gap-1.5 font-medium shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-purple-600" />
                <span>Export CSV</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 shadow-lg">
              <DropdownMenuItem
                onClick={() => handleExportCSV("all")}
                className="text-xs font-semibold text-purple-900 cursor-pointer hover:bg-purple-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-purple-600" />
                Full Analytics Report (.csv)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExportCSV("corridors")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <Route className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Popular Routes & Corridors
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportCSV("hours")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <Clock className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Hourly Commute Patterns
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportCSV("carpool")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <Users className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Carpool & Seat Matches
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportCSV("areas")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Origin & Destination Areas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Top 5 Key Stats Cards (Consistent, compact KPI cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Card 1: Total Rides */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
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

        {/* Card 2: Total Commuters */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Commuters</span>
            <div className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Users className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-900">{overview?.totalCommuters ?? 0}</span>
            <span className="text-xs text-slate-500">commuters</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {overview?.uniqueDrivers ?? 0} {overview?.uniqueDrivers === 1 ? "driver" : "drivers"} · {overview?.uniquePassengers ?? 0} {overview?.uniquePassengers === 1 ? "passenger" : "passengers"}
          </p>
        </div>

        {/* Card 3: Seat Occupancy */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seat Occupancy</span>
            <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-emerald-600">{overview?.avgOccupancyRate ?? 0}%</span>
            <span className="text-xs text-slate-500">occupied</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            {overview?.totalSeatsBooked ?? 0} booked of {overview?.totalSeatsOffered ?? 0} seats
          </p>
        </div>

        {/* Card 4: Fuel Cost Saved */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fuel Cost Saved</span>
            <div className="p-1 rounded-md bg-indigo-50 text-indigo-600">
              <IndianRupee className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-slate-900">₹{(overview?.estimatedCostSavedInr ?? 0).toLocaleString()}</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            Estimated commuter fuel savings
          </p>
        </div>

        {/* Card 5: CO2 Emissions Avoided */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CO₂ Emissions Avoided</span>
            <div className="p-1 rounded-md bg-teal-50 text-teal-600">
              <Leaf className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-1">
            <span className="text-xl font-extrabold text-teal-700">{overview?.estimatedCo2SavedKg ?? 0}</span>
            <span className="text-xs text-slate-500">kg CO₂</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 truncate">
            Carbon avoided through carpooling
          </p>
        </div>
      </div>

      {/* 3. Simple Tab Switcher */}
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
      {/* TAB 1: POPULAR ROUTES (Origin, Destination, Rides, Seats)  */}
      {/* ========================================================= */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          {corridors.length === 0 ? (
            <div className="bg-white border border-slate-200/90 rounded-xl p-8 text-center shadow-2xs">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Route className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">No route data for this period</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Popular commute routes will automatically appear here as employees schedule and complete shared rides.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Route className="h-4 w-4 text-purple-600" />
                    Frequently Used Commute Routes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Active travel corridors showing origin, campus destination, ride volume, and open seats.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                  {corridors.length} {corridors.length === 1 ? "Active Route" : "Active Routes"}
                </span>
              </div>

              {/* Compact Route List */}
              <div className="divide-y divide-slate-100">
                {corridors.map((c, idx) => {
                  const origin = c.originName || (c.frequentStops.length > 0 ? c.frequentStops[0].name : "Origin");
                  const destination = c.destinationName || (c.frequentStops.length > 1 ? c.frequentStops[c.frequentStops.length - 1].name : "Campus");
                  const emptySeats = Math.max(0, c.totalSeatsOffered - c.totalSeatsBooked);

                  return (
                    <div
                      key={c.id || idx}
                      className="py-3.5 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{origin}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            <span>{destination}</span>
                          </span>
                          <span className="text-xs text-slate-400 font-medium">({c.name})</span>
                        </div>
                        <p className="text-xs text-slate-500">{c.description}</p>
                        {c.frequentStops.length > 0 && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 pt-0.5 flex-wrap">
                            <span className="font-semibold text-slate-400">Stops:</span>
                            {c.frequentStops.map((s, sIdx) => (
                              <span key={sIdx} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px]">
                                {s.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 shrink-0 sm:text-right">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Rides</span>
                          <span className="text-sm font-bold text-slate-900">{c.totalRides}</span>
                          <span className="text-[10px] text-slate-400 block">{c.scheduledRides} active · {c.completedRides} done</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Available Seats</span>
                          <span className="text-sm font-bold text-emerald-600">{emptySeats}</span>
                          <span className="text-[10px] text-slate-400 block">of {c.totalSeatsOffered} total</span>
                        </div>

                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Occupancy</span>
                          <span className="text-sm font-bold text-slate-700">{c.occupancyRate}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: BUSY HOURS (Single Hourly Commuting Activity Chart) */}
      {/* ========================================================= */}
      {activeTab === "hours" && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-purple-600" />
                Hourly Commuting Activity
              </h3>
              <p className="text-xs text-slate-500">
                Hourly departure distribution showing morning inbound and evening outbound commutes.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Morning / Inbound (To Campus)
              </span>
              <span className="flex items-center gap-1.5 text-purple-700">
                <span className="h-2.5 w-2.5 rounded-full bg-purple-500" /> Evening / Outbound (From Campus)
              </span>
            </div>
          </div>

          {patterns?.rushHourDistribution.every((b) => b.totalRides === 0) ? (
            <div className="py-12 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Clock className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">No hourly activity for this period</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Hourly departure patterns will appear as employees schedule morning and evening carpools.
              </p>
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={patterns?.rushHourDistribution || []}
                  margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="hour" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      fontSize: "12px",
                      padding: "8px 12px",
                    }}
                  />
                  <Bar dataKey="pickupRides" name="To Campus (Morning)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="dropRides" name="From Campus (Evening)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: CARPOOL & SEATS (Combined Capacity & Real Matches)   */}
      {/* ========================================================= */}
      {activeTab === "carpool" && (
        <div className="space-y-4">
          {/* Combined Compact Vehicle Capacity & Seat Occupancy Section */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Car className="h-4 w-4 text-purple-600" />
                Vehicle Capacity & Seat Occupancy
              </h3>
              <p className="text-xs text-slate-500">
                Total vehicle capacity, booked seats, and open seats available across carpool trips.
              </p>
            </div>

            {/* 4 Compact Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Capacity</span>
                <span className="text-lg font-bold text-slate-900">{capacity?.totalCapacitySeats ?? 0} seats</span>
                <span className="text-[10px] text-slate-500 block">offered across vehicles</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Booked Seats</span>
                <span className="text-lg font-bold text-purple-700">{capacity?.filledSeats ?? 0} seats</span>
                <span className="text-[10px] text-slate-500 block">reserved by commuters</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Available Seats</span>
                <span className="text-lg font-bold text-emerald-700">{capacity?.emptySeats ?? 0} seats</span>
                <span className="text-[10px] text-slate-500 block">vacant for sharing</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Seat Occupancy</span>
                <span className="text-lg font-bold text-emerald-600">{capacity?.overallUtilizationRate ?? 0}%</span>
                <span className="text-[10px] text-slate-500 block">booked / total capacity</span>
              </div>
            </div>

            {/* Vehicle Type Breakdown if present */}
            {capacity?.vehicleTypeBreakdown && capacity.vehicleTypeBreakdown.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">Breakdown by Vehicle Type:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {capacity.vehicleTypeBreakdown.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                      <span className="font-semibold text-slate-800">{v.type} ({v.ridesCount} {v.ridesCount === 1 ? "ride" : "rides"})</span>
                      <span className="font-bold text-emerald-600">{v.avgOccupancyRate}% occupied</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Carpool Opportunities (Real Data Only) */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Carpool Opportunities
                </h3>
                <p className="text-xs text-slate-500">
                  Potential ride matches detected from overlapping routes and open vehicle seats.
                </p>
              </div>
              {carpoolOpportunities.length > 0 && (
                <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                  {carpoolOpportunities.length} {carpoolOpportunities.length === 1 ? "Opportunity" : "Opportunities"}
                </span>
              )}
            </div>

            {carpoolOpportunities.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs text-slate-500">
                  No matching carpool pairings detected for this timeframe. Carpool opportunities appear when multiple employees travel along the same corridor with open seats.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {carpoolOpportunities.map((opp) => (
                  <div
                    key={opp.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{opp.corridor}</span>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                        {opp.matchScore}% Route Match
                      </Badge>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-0.5 bg-white p-2 rounded border border-slate-200/60">
                      <div><strong>Route:</strong> {opp.originArea} &rarr; {opp.destinationArea}</div>
                      <div><strong>Timing:</strong> {opp.timeWindow}</div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-600 font-semibold">{opp.availableSeats} open seats</span>
                      <span className="text-purple-700 font-bold">{opp.passengerDemand} passengers</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: ADMIN INSIGHTS (Max 3 Data-Driven Observations)      */}
      {/* ========================================================= */}
      {activeTab === "tips" && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                Data-Driven Admin Insights
              </h3>
              <p className="text-xs text-slate-500">
                Concise observations based strictly on verified carpool activity.
              </p>
            </div>
            {insights.length > 0 && (
              <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md">
                {insights.length} {insights.length === 1 ? "Insight" : "Insights"}
              </span>
            )}
          </div>

          {insights.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-slate-800">Insufficient commute data</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Data-driven administrator recommendations will automatically generate once employees schedule or complete carpools for this period.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {insights.slice(0, 3).map((ins) => (
                <div key={ins.id} className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
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
                    <span className="text-[9px] text-slate-500 uppercase font-bold block">Key Metric</span>
                    <span className="text-xs font-bold text-purple-700">{ins.impactMetric}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
