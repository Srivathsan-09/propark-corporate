"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Leaf,
  Car,
  Users,
  Route,
  TrendingDown,
  Info,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
  BarChart3,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { CarLoader } from "@/components/common/CarLoader";
import { cn } from "@/lib/utils";

export interface IDiagnosticRideItem {
  rideId: string;
  driverSoloDistanceKm?: number;
  passengerCount: number;
  soloDistancePerPassenger: string;
  soloDistances: number[];
  soloBaselineCO2Kg: number;
  actualSharedVehicleDistanceKm: number;
  carpoolEmissionsKg: number;
  grossDifferenceKg: number;
  avoidedEmissionsKg: number;
  netEmissionsIncreaseKg?: number;
  reductionPercentage: number;
  dataCompleteness: "COMPLETE" | "INCOMPLETE";
  dataCompletenessReason: string;
  calculatedAt?: string | Date;
}

interface ISustainabilityAnalytics {
  totalCompletedRides: number;
  totalPassengers: number;
  totalCarpoolDistanceKm: number;
  totalSoloBaselineDistanceKm: number;
  vehicleKilometersReducedKm: number;
  totalSoloBaselineCO2Kg?: number;
  totalEstimatedCO2EmittedKg: number;
  totalEstimatedCO2AvoidedKg: number;
  grossDifferenceKg?: number;
  netEmissionsIncreaseKg?: number;
  averageOccupancy: number;
  averageCO2SavingPerRideKg: number;
  averageCO2SavingPerPassengerKg: number;
  co2ReductionPercentage: number;
  equivalentTreesPlanted: number;
  activeEmissionFactorSource: string;
  activeSourceReference: string;
  diagnostics?: IDiagnosticRideItem[];
  monthlyData?: IMonthlyData[];
}

interface IMonthlyData {
  month: string;
  label: string;
  co2AvoidedKg: number;
  co2EmittedKg: number;
  soloCO2Kg: number;
  netEmissionsIncreaseKg?: number;
  vkrKm: number;
  ridesCount: number;
  passengersCount: number;
}

interface IOccupancyData {
  occupancy: number;
  label: string;
  ridesCount: number;
  avgCO2PerOccupantKg: number;
}

interface IEmissionFactorItem {
  _id: string;
  factorId: string;
  vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
  fuelType: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
  engineCategory: "<=1200cc" | ">1200cc" | "default";
  gramsCO2PerKm: number;
  source: string;
  sourceReference?: string;
  isActive: boolean;
}

export default function AdminSustainabilityPage() {
  const [analytics, setAnalytics] = useState<ISustainabilityAnalytics | null>(null);
  const [monthlyData, setMonthlyData] = useState<IMonthlyData[]>([]);
  const [occupancyData, setOccupancyData] = useState<IOccupancyData[]>([]);
  const [emissionFactors, setEmissionFactors] = useState<IEmissionFactorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Expandable secondary insights section
  const [isInsightsExpanded, setIsInsightsExpanded] = useState(false);

  // Chart 2 view mode (auto selects bar for single month, line for multi-month)
  const [savingsChartMode, setSavingsChartMode] = useState<"auto" | "bar" | "line">("auto");

  // Calculation transparency toggle
  const [showCalculationModal, setShowCalculationModal] = useState(false);

  // Emission Factor Dialog States
  const [isFactorDialogOpen, setIsFactorDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<IEmissionFactorItem | null>(null);
  const [factorForm, setFactorForm] = useState<{
    factorId: string;
    vehicleType: "Car" | "SUV" | "Van" | "Bike" | "Other";
    fuelType: "Petrol" | "Diesel" | "CNG" | "Electric" | "Hybrid";
    engineCategory: "<=1200cc" | ">1200cc" | "default";
    gramsCO2PerKm: number;
    source: string;
    sourceReference: string;
    isActive: boolean;
  }>({
    factorId: "",
    vehicleType: "Car",
    fuelType: "Petrol",
    engineCategory: "default",
    gramsCO2PerKm: 130,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "",
    isActive: true,
  });
  const [factorSubmitting, setFactorSubmitting] = useState(false);
  const [factorError, setFactorError] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    loadAllSustainabilityData();
  }, []);

  const loadAllSustainabilityData = async () => {
    try {
      setIsLoading(true);
      const [analyticsRes, monthlyRes, occRes, factorsRes] = await Promise.all([
        fetch("/api/carbon/analytics"),
        fetch("/api/carbon/analytics/monthly"),
        fetch("/api/carbon/analytics/occupancy"),
        fetch("/api/carbon/emission-factors"),
      ]);

      if (analyticsRes.ok) {
        const aJson = await analyticsRes.json();
        setAnalytics(aJson.analytics);
        if (aJson.analytics?.monthlyData) {
          setMonthlyData(aJson.analytics.monthlyData);
        } else if (monthlyRes.ok) {
          const mJson = await monthlyRes.json();
          setMonthlyData(mJson.data || []);
        }
      } else if (monthlyRes.ok) {
        const mJson = await monthlyRes.json();
        setMonthlyData(mJson.data || []);
      }
      if (occRes.ok) {
        const oJson = await occRes.json();
        setOccupancyData(oJson.data || []);
      }
      if (factorsRes.ok) {
        const fJson = await factorsRes.json();
        setEmissionFactors(fJson.emissionFactors || []);
      }
    } catch (err) {
      console.error("Failed to load sustainability analytics:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleOpenAddFactor = () => {
    setEditingFactor(null);
    setFactorForm({
      factorId: "",
      vehicleType: "Car",
      fuelType: "Petrol",
      engineCategory: "default",
      gramsCO2PerKm: 130,
      source: "IPCC 2006 / MoEFCC India GHG Platform",
      sourceReference: "",
      isActive: true,
    });
    setFactorError(null);
    setIsFactorDialogOpen(true);
  };

  const handleOpenEditFactor = (f: IEmissionFactorItem) => {
    setEditingFactor(f);
    setFactorForm({
      factorId: f.factorId,
      vehicleType: f.vehicleType,
      fuelType: f.fuelType,
      engineCategory: f.engineCategory,
      gramsCO2PerKm: f.gramsCO2PerKm,
      source: f.source,
      sourceReference: f.sourceReference || "",
      isActive: f.isActive,
    });
    setFactorError(null);
    setIsFactorDialogOpen(true);
  };

  const handleFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFactorSubmitting(true);
    setFactorError(null);

    try {
      if (editingFactor) {
        const res = await fetch(`/api/carbon/emission-factors/${editingFactor._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(factorForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update emission factor");
      } else {
        const res = await fetch("/api/carbon/emission-factors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(factorForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create emission factor");
      }

      setIsFactorDialogOpen(false);
      loadAllSustainabilityData();
    } catch (err: any) {
      setFactorError(err?.message || "Failed to save emission factor");
    } finally {
      setFactorSubmitting(false);
    }
  };

  const handleToggleActive = async (f: IEmissionFactorItem) => {
    try {
      const res = await fetch(`/api/carbon/emission-factors/${f._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !f.isActive }),
      });
      if (res.ok) {
        loadAllSustainabilityData();
      }
    } catch (err) {
      console.error("Failed to toggle factor active status:", err);
    }
  };

  // Solo baseline vs Carpool emissions calculations (safe independent aggregation & honest reporting)
  const soloBaselineCO2 =
    analytics?.totalSoloBaselineCO2Kg !== undefined
      ? Math.round(analytics.totalSoloBaselineCO2Kg * 100) / 100
      : 0;
  const actualCarpoolCO2 =
    analytics?.totalEstimatedCO2EmittedKg !== undefined
      ? Math.round(analytics.totalEstimatedCO2EmittedKg * 100) / 100
      : 0;

  // Net CO₂ avoided = Solo baseline emissions - Actual carpool emissions
  const co2Avoided =
    analytics?.totalEstimatedCO2AvoidedKg !== undefined
      ? analytics.totalEstimatedCO2AvoidedKg
      : Math.round((soloBaselineCO2 - actualCarpoolCO2) * 100) / 100;

  // Net emissions increase = Actual carpool emissions - Solo baseline emissions (when positive)
  const netEmissionsIncrease =
    analytics?.netEmissionsIncreaseKg !== undefined
      ? analytics.netEmissionsIncreaseKg
      : Math.max(0, Math.round((actualCarpoolCO2 - soloBaselineCO2) * 100) / 100);

  const isNetIncrease = actualCarpoolCO2 > soloBaselineCO2;
  const isEqual = actualCarpoolCO2 === soloBaselineCO2;

  // Reduction % = (Net CO₂ avoided / Solo baseline emissions) * 100
  const reductionPct =
    analytics?.co2ReductionPercentage !== undefined
      ? analytics.co2ReductionPercentage
      : soloBaselineCO2 > 0
      ? Math.round((co2Avoided / soloBaselineCO2) * 100 * 100) / 100
      : 0;

  // Chart 1: Solo vs Carpool Emissions (Two discrete bars: Solo Emissions and Carpool Emissions)
  // Single source of truth: Displays exactly two bars matching top dashboard metrics directly
  const comparisonBarData = [
    {
      name: "Solo Emissions",
      emissions: soloBaselineCO2,
      fill: "#f43f5e",
    },
    {
      name: "Carpool Emissions",
      emissions: actualCarpoolCO2,
      fill: "#10b981",
    },
  ];

  // Debug logging: logs the exact values supplied to both chart components
  useEffect(() => {
    if (!isLoading) {
      console.log("[SustainabilityCharts] Chart 1 (Solo vs Carpool Emissions):", comparisonBarData);
      console.log("[SustainabilityCharts] Chart 2 (Monthly CO2 Savings):", monthlyData);
    }
  }, [soloBaselineCO2, actualCarpoolCO2, monthlyData, isLoading]);

  // CSV Export helper
  const handleExportSustainabilityCSV = (type: "all" | "monthly" | "rides" = "all") => {
    if (!analytics) return;

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

    const dateStr = new Date().toISOString().split("T")[0];

    if (type === "monthly") {
      const headers = [
        "Month Code",
        "Month Label",
        "Solo Baseline CO2 (kg)",
        "Carpool Emissions (kg)",
        "Net CO2 Avoided (kg)",
        "Net Emissions Increase (kg)",
        "Vehicle-KM Reduced (km)",
        "Completed Rides",
        "Passengers Carried",
      ];
      const rows = (analytics.monthlyData || []).map((m) => [
        escapeCSV(m.month),
        escapeCSV(m.label),
        m.soloCO2Kg,
        m.co2EmittedKg,
        m.co2AvoidedKg,
        m.netEmissionsIncreaseKg ?? 0,
        m.vkrKm,
        m.ridesCount,
        m.passengersCount,
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Sustainability_Monthly_${dateStr}.csv`, csv);
      return;
    }

    if (type === "rides") {
      const headers = [
        "Ride ID",
        "Calculated At",
        "Passenger Count",
        "Passenger Solo Distances (km)",
        "Driver Solo Distance (km)",
        "Solo Baseline CO2 (kg)",
        "Actual Carpool Distance (km)",
        "Actual Carpool CO2 (kg)",
        "Net CO2 Avoided (kg)",
        "Net Emissions Increase (kg)",
        "CO2 Reduction (%)",
        "Completeness Status",
        "Completeness Reason",
      ];
      const rows = (analytics.diagnostics || []).map((d) => [
        escapeCSV(d.rideId),
        escapeCSV(d.calculatedAt ? new Date(d.calculatedAt).toISOString() : ""),
        d.passengerCount,
        escapeCSV(d.soloDistancePerPassenger),
        d.driverSoloDistanceKm ?? "",
        d.soloBaselineCO2Kg,
        d.actualSharedVehicleDistanceKm,
        d.carpoolEmissionsKg,
        d.avoidedEmissionsKg,
        d.netEmissionsIncreaseKg,
        d.reductionPercentage,
        escapeCSV(d.dataCompleteness),
        escapeCSV(d.dataCompletenessReason),
      ]);
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
      triggerCSVDownload(`CommuteX_Completed_Rides_Carbon_${dateStr}.csv`, csv);
      return;
    }

    // Comprehensive Full Sustainability Report
    const lines: string[] = [];
    lines.push(`"COMMUTEX SUSTAINABILITY & ESG CARBON ACCOUNTING REPORT"`);
    lines.push(`"Generated On",${escapeCSV(new Date().toLocaleString())}`);
    lines.push(`"Methodology Standards",${escapeCSV("IPCC 2006 / MoEFCC India GHG Platform")}`);
    lines.push(`"Active Emission Source",${escapeCSV(analytics.activeEmissionFactorSource || "")}`);
    lines.push("");

    // Section 1: Executive KPI Overview
    lines.push(`"--- EXECUTIVE SUSTAINABILITY SUMMARY ---"`);
    lines.push(`"Metric","Value","Unit"`);
    lines.push(`"Solo Commuting Baseline CO2",${soloBaselineCO2},"kg CO2"`);
    lines.push(`"Actual Shared Carpool CO2",${actualCarpoolCO2},"kg CO2"`);
    lines.push(`"Net Estimated CO2 Avoided",${co2Avoided},"kg CO2"`);
    lines.push(`"Net Emissions Increase",${netEmissionsIncrease},"kg CO2"`);
    lines.push(`"CO2 Reduction Percentage",${reductionPct},"%"`);
    lines.push(`"Total Verified Completed Rides",${analytics.totalCompletedRides ?? 0},"rides"`);
    lines.push(`"Total Shared Passengers Carried",${analytics.totalPassengers ?? 0},"passengers"`);
    lines.push(`"Actual Carpool Vehicle Travel Distance",${analytics.totalCarpoolDistanceKm ?? 0},"km"`);
    lines.push(`"Vehicle-Kilometres Reduced (VKR)",${analytics.vehicleKilometersReducedKm ?? 0},"km"`);
    lines.push(`"Average Carpool Occupancy",${analytics.averageOccupancy ?? 0},"commuters/car"`);
    lines.push(`"Equivalent Mature Trees Absorbing CO2/yr",${analytics.equivalentTreesPlanted ?? 0},"trees"`);
    lines.push("");

    // Section 2: Monthly Time Series
    lines.push(`"--- MONTHLY TIME-SERIES DATA ---"`);
    lines.push(
      [
        "Month Code",
        "Month Label",
        "Solo Baseline CO2 (kg)",
        "Carpool Emissions (kg)",
        "Net CO2 Avoided (kg)",
        "Net Emissions Increase (kg)",
        "VKR (km)",
        "Rides Count",
        "Passengers Count",
      ].map(escapeCSV).join(",")
    );
    (analytics.monthlyData || []).forEach((m) => {
      lines.push(
        [
          escapeCSV(m.month),
          escapeCSV(m.label),
          m.soloCO2Kg,
          m.co2EmittedKg,
          m.co2AvoidedKg,
          m.netEmissionsIncreaseKg ?? 0,
          m.vkrKm,
          m.ridesCount,
          m.passengersCount,
        ].join(",")
      );
    });
    lines.push("");

    // Section 3: Diagnostic Per-Ride Records
    lines.push(`"--- COMPLETED RIDES CARBON ACCOUNTING DIAGNOSTICS ---"`);
    lines.push(
      [
        "Ride ID",
        "Calculated At",
        "Passengers Count",
        "Passenger Solo Distances (km)",
        "Driver Solo Distance (km)",
        "Solo Baseline CO2 (kg)",
        "Carpool Distance (km)",
        "Carpool CO2 (kg)",
        "Net Avoided (kg)",
        "Net Increase (kg)",
        "Reduction (%)",
        "Completeness Status",
        "Completeness Reason",
      ].map(escapeCSV).join(",")
    );
    (analytics.diagnostics || []).forEach((d) => {
      lines.push(
        [
          escapeCSV(d.rideId),
          escapeCSV(d.calculatedAt ? new Date(d.calculatedAt).toISOString() : ""),
          d.passengerCount,
          escapeCSV(d.soloDistancePerPassenger),
          d.driverSoloDistanceKm ?? "",
          d.soloBaselineCO2Kg,
          d.actualSharedVehicleDistanceKm,
          d.carpoolEmissionsKg,
          d.avoidedEmissionsKg,
          d.netEmissionsIncreaseKg,
          d.reductionPercentage,
          escapeCSV(d.dataCompleteness),
          escapeCSV(d.dataCompletenessReason),
        ].join(",")
      );
    });

    triggerCSVDownload(`CommuteX_Sustainability_Full_Report_${dateStr}.csv`, lines.join("\r\n"));
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
              <Leaf className="h-2.5 w-2.5 mr-1 text-emerald-600" /> Sustainability & Environmental Impact
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium text-slate-500 border-slate-300">
              IPCC 2006 / India GHG Standard
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sustainability Analytics & Carbon Accounting
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quantitative analysis of CO₂ emissions avoided, vehicle-km reductions, and commuter sustainability metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsRefreshing(true);
              loadAllSustainabilityData();
            }}
            disabled={isRefreshing}
            className="h-8 gap-1.5 text-xs text-slate-600 rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="h-8 gap-1.5 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 rounded-lg font-medium cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Export CSV</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border-slate-200 shadow-lg">
              <DropdownMenuItem
                onClick={() => handleExportSustainabilityCSV("all")}
                className="text-xs font-semibold text-emerald-900 cursor-pointer hover:bg-emerald-50"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-emerald-600" />
                Full Sustainability Report (.csv)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleExportSustainabilityCSV("monthly")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <Leaf className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Monthly Emissions Summary
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportSustainabilityCSV("rides")}
                className="text-xs cursor-pointer text-slate-700 hover:bg-slate-50"
              >
                <Route className="h-3.5 w-3.5 mr-2 text-slate-500" />
                Completed Rides Diagnostics
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            onClick={handleOpenAddFactor}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Emission Factor
          </Button>
        </div>
      </div>

      {/* 2. Main Sustainability Summary Banner (Dark-Themed Environmental Impact Card) */}
      <Card className="border-emerald-300 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white shadow-md overflow-hidden relative rounded-2xl">
        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Leaf className={`h-5 w-5 ${isNetIncrease ? "text-rose-400" : "text-emerald-400"}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${isNetIncrease ? "text-rose-300" : "text-emerald-400"}`}>
                  Quantitative Environmental Impact Summary
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-48 bg-slate-700" />
                ) : isNetIncrease ? (
                  <span>
                    +{netEmissionsIncrease.toLocaleString()} kg Net Emissions Increase{" "}
                    <span className="text-sm font-semibold text-rose-300">
                      ({co2Avoided.toLocaleString()} kg CO₂ Avoided)
                    </span>
                  </span>
                ) : isEqual ? (
                  <span>No Net Emissions Change (0 kg)</span>
                ) : (
                  `+${co2Avoided.toLocaleString()} kg CO₂ Avoided`
                )}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                {isNetIncrease
                  ? `Actual carpool emissions (${actualCarpoolCO2.toLocaleString()} kg) exceed the solo commuting baseline (${soloBaselineCO2.toLocaleString()} kg) by ${netEmissionsIncrease.toLocaleString()} kg CO₂ due to vehicle route distance exceeding passenger solo travel.`
                  : "Cumulative carbon emissions saved across completed campus carpool rides compared to if each passenger had driven an individual solo vehicle."}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalculationModal(true)}
              className="border-emerald-500/50 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50 hover:text-white h-8 text-xs gap-1.5 w-fit rounded-lg"
            >
              <HelpCircle className="h-3.5 w-3.5 text-emerald-400" /> View Calculation Formula
            </Button>
          </div>

          {/* 4 Key Metrics in Main Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
            {/* 1. Solo Commuting Baseline */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                Solo Commuting Baseline
              </span>
              <div className="text-xl font-black text-rose-400 mt-1">
                {isLoading ? <Skeleton className="h-6 w-20 bg-slate-700" /> : `${soloBaselineCO2.toLocaleString()} kg`}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">If all commuters drove solo</span>
            </div>

            {/* 2. CommuteX Carpool Emissions */}
            <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700">
              <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                CommuteX Carpool Emissions
              </span>
              <div className="text-xl font-black text-blue-300 mt-1">
                {isLoading ? <Skeleton className="h-6 w-20 bg-slate-700" /> : `${actualCarpoolCO2.toLocaleString()} kg`}
              </div>
              <span className="text-[10px] text-slate-400 block mt-0.5">Actual vehicle emissions</span>
            </div>

            {/* 3. CO2 Avoided / Net Emissions Increase / No Net Emissions Change */}
            <div
              className={`p-3.5 rounded-xl border ${
                isNetIncrease
                  ? "bg-rose-950/40 border-rose-500/40"
                  : isEqual
                  ? "bg-slate-800/60 border-slate-700"
                  : "bg-emerald-900/30 border-emerald-500/40"
              }`}
            >
              <span
                className={`text-[11px] font-semibold block uppercase tracking-wider ${
                  isNetIncrease ? "text-rose-300" : isEqual ? "text-slate-400" : "text-emerald-300"
                }`}
              >
                {co2Avoided > 0
                  ? "CO₂ Avoided"
                  : isNetIncrease
                  ? "Net Emissions Increase"
                  : "No Net Emissions Change"}
              </span>
              <div
                className={`text-xl font-black mt-1 ${
                  isNetIncrease ? "text-rose-400" : isEqual ? "text-slate-300" : "text-emerald-400"
                }`}
              >
                {isLoading ? (
                  <Skeleton className="h-6 w-20 bg-slate-700" />
                ) : isNetIncrease ? (
                  `+${netEmissionsIncrease.toLocaleString()} kg`
                ) : isEqual ? (
                  "0.00 kg"
                ) : (
                  `+${co2Avoided.toLocaleString()} kg`
                )}
              </div>
              <span
                className={`text-[10px] block mt-0.5 ${
                  isNetIncrease ? "text-rose-300 font-medium" : isEqual ? "text-slate-400" : "text-emerald-300"
                }`}
              >
                {isNetIncrease
                  ? `CO₂ Avoided: ${co2Avoided.toLocaleString()} kg`
                  : isEqual
                  ? "Carpool equals baseline"
                  : "Solo Baseline − Carpool"}
              </span>
            </div>

            {/* 4. CO2 Reduction Percentage */}
            <div
              className={`p-3.5 rounded-xl border ${
                reductionPct < 0
                  ? "bg-rose-950/40 border-rose-500/40"
                  : isEqual
                  ? "bg-slate-800/60 border-slate-700"
                  : "bg-emerald-900/30 border-emerald-500/40"
              }`}
            >
              <span
                className={`text-[11px] font-semibold block uppercase tracking-wider ${
                  reductionPct < 0 ? "text-rose-300" : isEqual ? "text-slate-400" : "text-emerald-300"
                }`}
              >
                CO₂ Reduction Percentage
              </span>
              <div
                className={`text-xl font-black mt-1 ${
                  reductionPct < 0 ? "text-rose-400" : isEqual ? "text-slate-300" : "text-emerald-400"
                }`}
              >
                {isLoading ? (
                  <Skeleton className="h-6 w-16 bg-slate-700" />
                ) : (
                  `${reductionPct > 0 ? "+" : ""}${reductionPct}%`
                )}
              </div>
              <span
                className={`text-[10px] block mt-0.5 ${
                  reductionPct < 0 ? "text-rose-300 font-medium" : isEqual ? "text-slate-400" : "text-emerald-300"
                }`}
              >
                {reductionPct < 0
                  ? `Net emissions increase (+${netEmissionsIncrease.toLocaleString()} kg)`
                  : isEqual
                  ? "Zero net change"
                  : "Net carbon reduction ratio"}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Four Primary Supporting KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* KPI 1: Completed Carpools */}
        <Card className="border-slate-200/90 shadow-2xs rounded-xl bg-white">
          <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Completed Carpools</CardTitle>
            <div className="p-1 rounded-md bg-emerald-50 text-emerald-600">
              <Route className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (analytics?.totalCompletedRides ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Verified completed trips</p>
          </CardContent>
        </Card>

        {/* KPI 2: Total Shared Passengers */}
        <Card className="border-slate-200/90 shadow-2xs rounded-xl bg-white">
          <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Total Shared Passengers</CardTitle>
            <div className="p-1 rounded-md bg-blue-50 text-blue-600">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? <Skeleton className="h-7 w-12" /> : (analytics?.totalPassengers ?? 0)}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Accepted commuter passengers</p>
          </CardContent>
        </Card>

        {/* KPI 3: Actual Carpool Distance */}
        <Card className="border-slate-200/90 shadow-2xs rounded-xl bg-white">
          <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Actual Carpool Distance</CardTitle>
            <div className="p-1 rounded-md bg-purple-50 text-purple-600">
              <Car className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-2xl font-black text-slate-900">
              {isLoading ? <Skeleton className="h-7 w-16" /> : `${analytics?.totalCarpoolDistanceKm ?? 0} km`}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Total vehicle travel distance</p>
          </CardContent>
        </Card>

        {/* KPI 4: Vehicle-Kilometres Reduced (VKR) */}
        <Card className="border-slate-200/90 shadow-2xs rounded-xl bg-white">
          <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500">Vehicle-Kilometres Reduced (VKR)</CardTitle>
            <div className="p-1 rounded-md bg-teal-50 text-teal-600">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="px-3.5 pb-3.5">
            <div className="text-2xl font-black text-emerald-700">
              {isLoading ? <Skeleton className="h-7 w-16" /> : `${analytics?.vehicleKilometersReducedKm ?? 0} km`}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">Road congestion miles eliminated</p>
          </CardContent>
        </Card>
      </div>

      {/* 4. Two Primary Essential Charts */}
      {isMounted && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Chart 1: Solo vs Carpool Emissions (Bar Chart) */}
          <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    Solo vs. Carpool Emissions
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Comparing total solo baseline emissions against actual carpool emissions (kg CO₂)
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-300 font-semibold">
                  Comparative Model
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-64 w-full">
                {soloBaselineCO2 === 0 && actualCarpoolCO2 === 0 && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-1">
                    <Leaf className="h-6 w-6 text-slate-300" />
                    <p className="font-medium text-slate-600">No completed trip emissions recorded yet</p>
                    <p className="text-[11px] text-slate-400">Emissions will populate as completed rides accumulate.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, _name: any, item: any) => [
                          `${value} kg CO₂`,
                          item?.payload?.name || "Emissions",
                        ]}
                      />
                      <Bar dataKey="emissions" radius={[6, 6, 0, 0]}>
                        {comparisonBarData.map((entry, index) => (
                          <Cell key={`comparison-bar-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Chart 2: Monthly CO₂ Savings */}
          <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Leaf className="h-4 w-4 text-emerald-600" />
                    Monthly CO₂ Savings
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Monthly net CO₂ savings (Solo Baseline − Actual Carpool) from completed carpool trips (kg CO₂)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {monthlyData.length > 1 && (
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSavingsChartMode("bar")}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-colors ${
                          savingsChartMode === "bar"
                            ? "bg-white text-slate-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Bar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavingsChartMode("line")}
                        className={`px-2 py-0.5 text-[10px] font-semibold rounded cursor-pointer transition-colors ${
                          savingsChartMode === "line" || (savingsChartMode === "auto" && monthlyData.length > 1)
                            ? "bg-white text-slate-800 shadow-2xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        Line
                      </button>
                    </div>
                  )}
                  <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-300 font-semibold">
                    {monthlyData.length === 1 ? "Single Reporting Month" : "Monthly Trend"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-64 w-full">
                {monthlyData.length === 0 && !isLoading ? (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400 space-y-1">
                    <Clock className="h-6 w-6 text-slate-300" />
                    <p className="font-medium text-slate-600">No monthly historical data yet</p>
                    <p className="text-[11px] text-slate-400">Monthly savings will display as trips are verified and completed.</p>
                  </div>
                ) : savingsChartMode === "bar" || (savingsChartMode === "auto" && monthlyData.length === 1) ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="2 2" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, _name: any, item: any) => {
                          const payload = item?.payload;
                          if (payload && payload.soloCO2Kg !== undefined) {
                            const avoided = payload.co2AvoidedKg;
                            return [
                              `${avoided >= 0 ? "+" : ""}${avoided} kg (Solo: ${payload.soloCO2Kg} kg − Carpool: ${payload.co2EmittedKg} kg)`,
                              avoided >= 0 ? "CO₂ Avoided" : "Net Increase",
                            ];
                          }
                          return [`${value} kg`, "CO₂ Avoided"];
                        }}
                      />
                      <Bar dataKey="co2AvoidedKg" name="CO₂ Avoided (kg)" radius={[6, 6, 0, 0]}>
                        {monthlyData.map((entry, index) => (
                          <Cell
                            key={`monthly-bar-${index}`}
                            fill={entry.co2AvoidedKg >= 0 ? "#10b981" : "#f43f5e"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "10px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any, item: any) => {
                          const payload = item?.payload;
                          if (payload && payload.soloCO2Kg !== undefined) {
                            const avoided = payload.co2AvoidedKg;
                            return [
                              `${avoided >= 0 ? "+" : ""}${avoided} kg (Solo: ${payload.soloCO2Kg} kg − Carpool: ${payload.co2EmittedKg} kg)`,
                              avoided >= 0 ? "CO₂ Avoided" : "Net Increase",
                            ];
                          }
                          return [`${value} kg`, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Line
                        type="monotone"
                        dataKey="co2AvoidedKg"
                        name="CO₂ Avoided (kg)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 5, fill: "#10b981", stroke: "#047857", strokeWidth: 2 }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 5. Optional Expandable Section: Additional Environmental Insights */}
      <div className="space-y-4 pt-1">
        <button
          type="button"
          onClick={() => setIsInsightsExpanded((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all shadow-2xs group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                Additional Environmental Insights
              </span>
              <p className="text-xs text-slate-500">
                Secondary indicators, vehicle fleet occupancy curves, and multi-variable research charts.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            <span>{isInsightsExpanded ? "Hide Secondary Data" : "View Secondary Data"}</span>
            {isInsightsExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>

        {isInsightsExpanded && (
          <div className="space-y-5 animate-in fade-in-50 duration-300">
            {/* Secondary KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Secondary 1: Average Occupancy */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Occupancy</span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {analytics?.averageOccupancy ? `${analytics.averageOccupancy}` : "1.0"}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Persons per active vehicle</span>
              </div>

              {/* Secondary 2: Estimated Carpool CO2 Emitted */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carpool CO₂ Emitted</span>
                <div className="text-lg font-black text-slate-800 mt-1">
                  {analytics?.totalEstimatedCO2EmittedKg ?? 0} kg
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Actual fleet tailpipe output</span>
              </div>

              {/* Secondary 3: Mature Tree Equivalent */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mature Tree Equivalent</span>
                <div className="text-lg font-black text-emerald-700 mt-1 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ~{analytics?.equivalentTreesPlanted ?? 0}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Annual absorption basis</span>
              </div>

              {/* Secondary 4: Solo Baseline Distance */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Solo Baseline Distance</span>
                <div className="text-lg font-black text-slate-900 mt-1">
                  {analytics?.totalSoloBaselineDistanceKm ?? 0} km
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5">Sum of individual solo routes</span>
              </div>

              {/* Secondary 5: Active Model */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Baseline Model</span>
                <div className="text-xs font-bold text-slate-800 mt-1 truncate" title={analytics?.activeEmissionFactorSource}>
                  {analytics?.activeEmissionFactorSource || "IPCC / MoEFCC"}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate" title={analytics?.activeSourceReference}>
                  Configured factor registry
                </span>
              </div>
            </div>

            {/* Secondary Research Charts (Moved here from primary view) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Secondary Chart 1: Vehicle-Kilometers Reduced Over Time */}
              <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Vehicle-Kilometres Reduced (VKR) Over Time
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Cumulative reduction in urban road mileage (km)
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-blue-800 border-blue-300">
                      Congestion Index
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-60 w-full">
                    {monthlyData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No VKR time series data available yet.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                          <YAxis stroke="#94a3b8" fontSize={11} unit=" km" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "#ffffff",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="vkrKm" name="VKR (km)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Secondary Chart 2: Vehicle Occupancy vs CO2 per Occupant */}
              <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900">
                        Vehicle Occupancy vs. CO₂ per Occupant
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Demonstrates that increasing vehicle occupancy reduces per-person emissions
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-purple-800 border-purple-300">
                      Research Curve
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-2">
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={occupancyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Line
                          type="monotone"
                          dataKey="avgCO2PerOccupantKg"
                          name="Avg CO₂ / Person (kg)"
                          stroke="#8b5cf6"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: "#8b5cf6" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Secondary Chart 3: Carpool Trips Completed and Passenger Volume Over Time */}
            <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Carpool Trips Completed and Passenger Volume Over Time
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Correlating completed ride growth with commuter passenger volume
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-slate-700 border-slate-300">
                    Adoption Scale
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-60 w-full">
                  {monthlyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No trip adoption data recorded yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                        <Bar dataKey="ridesCount" name="Completed Carpool Rides" fill="#0f172a" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="passengersCount" name="Carpool Passengers Carried" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* 6. Academic Research Methodology & Scientific Assumptions Card */}
      <Card className="border-slate-200 bg-slate-50/80 shadow-2xs rounded-xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-700" />
            <CardTitle className="text-sm font-bold text-slate-900">
              Academic Research Methodology & Scientific Assumptions
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Mathematical model for thesis and scientific publication validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong>Estimation Notice:</strong> CommuteX calculates CO₂ emissions using verified travel distance and vehicle-specific emission factors expressed in grams of CO₂ per kilometre:
          </p>
          <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-slate-800 text-[11px] space-y-1">
            <div>CO₂ Emissions (g) = Travel Distance (km) × Emission Factor (g CO₂/km)</div>
            <div>CO₂ Emissions (kg) = CO₂ Emissions (g) / 1000</div>
            <div>CO₂ Avoided (kg) = Solo Baseline Emissions (kg) − Actual Carpool Emissions (kg)</div>
            <div>Vehicle-Kilometres Reduced (VKR) = Solo Baseline Distance (km) − Actual Carpool Distance (km)</div>
            <div>CO₂ Reduction % = (CO₂ Avoided / Solo Baseline Emissions) × 100</div>
          </div>
          <p>
            The calculated values represent <strong>rigorous computational estimates</strong> based on IPCC 2006 guidelines and the India GHG Platform. Actual vehicle emissions may vary based on vehicle maintenance condition, traffic congestion, driver habits, air conditioning load, and passenger weight.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[11px] text-slate-500 pt-1 border-t border-slate-200">
            <div>
              <span className="font-semibold text-slate-700">Authoritative Source:</span>{" "}
              {analytics?.activeEmissionFactorSource || "IPCC 2006 / MoEFCC India GHG Platform"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Reference:</span>{" "}
              {analytics?.activeSourceReference || "India GHG Platform / IPCC National Inventory"}
            </div>
            <div>
              <span className="font-semibold text-slate-700">Distance Source Preference:</span> GPS Tracked Telemetry &gt; OSRM Route Calculation
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6B. Completed Rides Carbon Diagnostics Table */}
      <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-bold text-emerald-700 border-emerald-200 bg-emerald-50">
                Diagnostic Verification
              </Badge>
              <CardTitle className="text-sm font-bold text-slate-900">
                Completed Rides Carbon Calculation Diagnostics
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Ride-level audit trail verifying independent calculations, individual passenger journeys, and data completeness.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {!analytics?.diagnostics || analytics.diagnostics.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No completed rides recorded for carbon diagnostics yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Ride ID</th>
                    <th className="py-2.5 px-3">Passengers</th>
                    <th className="py-2.5 px-3">Solo Dist / Pax</th>
                    <th className="py-2.5 px-3">Solo Baseline</th>
                    <th className="py-2.5 px-3">Shared Vehicle Dist</th>
                    <th className="py-2.5 px-3">Carpool CO₂</th>
                    <th className="py-2.5 px-3">Gross Diff</th>
                    <th className="py-2.5 px-3">Net Avoided / Increase</th>
                    <th className="py-2.5 px-3">Reduction %</th>
                    <th className="py-2.5 px-3">Data Completeness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.diagnostics.map((d, idx) => (
                    <tr key={d.rideId || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-800" title={d.rideId}>
                        {d.rideId.length > 12 ? `${d.rideId.slice(0, 8)}...` : d.rideId}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge variant="secondary" className="text-[10px] font-medium">
                          {d.passengerCount} {d.passengerCount === 1 ? "passenger" : "passengers"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {d.soloDistancePerPassenger}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-rose-600">
                        {d.soloBaselineCO2Kg} kg
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {d.actualSharedVehicleDistanceKm} km
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-600">
                        {d.carpoolEmissionsKg} kg
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        <span className={d.grossDifferenceKg >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {d.grossDifferenceKg >= 0 ? `+${d.grossDifferenceKg}` : d.grossDifferenceKg} kg
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {d.avoidedEmissionsKg > 0 ? (
                          <span className="text-emerald-700">+{d.avoidedEmissionsKg} kg</span>
                        ) : d.avoidedEmissionsKg < 0 ? (
                          <span className="text-rose-600">
                            {d.avoidedEmissionsKg} kg{" "}
                            <span className="text-[10px] font-normal text-rose-500">
                              (+{Math.abs(d.avoidedEmissionsKg)} kg Increase)
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-500">0.00 kg</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        <span className={d.reductionPercentage >= 0 ? "text-emerald-700 font-bold" : "text-rose-600 font-bold"}>
                          {d.reductionPercentage > 0 ? `+${d.reductionPercentage}%` : `${d.reductionPercentage}%`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-0.5">
                          {d.dataCompleteness === "COMPLETE" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold border-0 w-fit">
                              COMPLETE
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="bg-amber-100 text-amber-800 text-[10px] font-semibold border-0 w-fit">
                              INCOMPLETE
                            </Badge>
                          )}
                          {d.dataCompletenessReason && (
                            <span className="text-[10px] text-slate-400 max-w-[200px] truncate" title={d.dataCompletenessReason}>
                              {d.dataCompletenessReason}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 7. Configurable Emission Factors Registry Table */}
      <Card className="border-slate-200 shadow-2xs rounded-xl bg-white">
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-bold text-slate-900">
              Configurable Emission Factors Registry
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Administrators can adjust carbon factors without altering application source code
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenAddFactor}
            className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> Add New Factor
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Factor ID</th>
                  <th className="py-2.5 px-3">Vehicle Type</th>
                  <th className="py-2.5 px-3">Fuel Type</th>
                  <th className="py-2.5 px-3">Engine Category</th>
                  <th className="py-2.5 px-3">g CO₂/km</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emissionFactors.map((f) => (
                  <tr key={f._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{f.factorId}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="secondary" className="text-[10px] font-semibold">
                        {f.vehicleType}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-700">{f.fuelType}</td>
                    <td className="py-2.5 px-3 text-slate-500">{f.engineCategory}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                      {f.gramsCO2PerKm} g/km
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate" title={f.source}>
                      {f.source}
                    </td>
                    <td className="py-2.5 px-3">
                      {f.isActive ? (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold border-0">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] text-slate-500">
                          Inactive
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEditFactor(f)}
                        className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900 rounded-md"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(f)}
                        className={`h-7 px-2 text-[11px] rounded-md ${
                          f.isActive ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"
                        }`}
                      >
                        {f.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 8. Calculation Transparency Dialog */}
      <Dialog open={showCalculationModal} onOpenChange={setShowCalculationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-1">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-600" />
              Calculation Formula
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Simple 3-step calculation comparing solo commuting with carpooling
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2 text-xs">
            {/* Step 1: Solo Emissions */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-900 block">1. Solo Emissions</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Add the estimated emissions of all employees travelling separately.
              </p>
              <div className="mt-1.5 font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800">
                Solo CO₂ = Sum of individual trip emissions
              </div>
            </div>

            {/* Step 2: Carpool Emissions */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-900 block">2. Carpool Emissions</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Calculate emissions from the shared vehicle's actual trip.
              </p>
              <div className="mt-1.5 font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800">
                Carpool CO₂ = Distance × Vehicle Emission Factor ÷ 1000
              </div>
            </div>

            {/* Step 3: CO₂ Saved */}
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-semibold text-slate-900 block">3. CO₂ Saved</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Compare solo emissions with carpool emissions.
              </p>
              <div className="mt-1.5 font-mono text-[11px] bg-white px-2 py-1 rounded border border-slate-200 text-slate-800">
                CO₂ Saved = Solo Emissions − Carpool Emissions
              </div>
            </div>

            {/* Small Example */}
            <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-slate-700">
              <span className="font-semibold text-emerald-900 block text-[11px]">
                Example
              </span>
              <p className="text-[11px] text-slate-600 mt-0.5">
                4 employees travel 10 km separately, with an assumed emission factor of 150 g CO₂/km:
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-slate-700">
                <li>• Solo emissions: <strong className="text-slate-900">6 kg CO₂</strong></li>
                <li>• One shared car travelling 10 km: <strong className="text-slate-900">1.5 kg CO₂</strong></li>
                <li>• Estimated CO₂ saved: <strong className="text-emerald-700">4.5 kg (75% reduction)</strong></li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setShowCalculationModal(false)}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs rounded-lg"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 9. Add / Edit Emission Factor Dialog */}
      <Dialog open={isFactorDialogOpen} onOpenChange={setIsFactorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleFactorSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900">
                {editingFactor ? "Edit Carbon Emission Factor" : "Add New Emission Factor"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Configure baseline emission factors per vehicle and fuel classification
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-3">
              {factorError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{factorError}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="factorId" className="text-xs font-semibold text-slate-700">
                  Factor ID (Unique)
                </Label>
                <Input
                  id="factorId"
                  value={factorForm.factorId}
                  onChange={(e) => setFactorForm((prev) => ({ ...prev, factorId: e.target.value.toUpperCase() }))}
                  placeholder="e.g. PETROL_CAR_CUSTOM"
                  disabled={Boolean(editingFactor)}
                  className="uppercase font-mono rounded-xl text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="vehicleType" className="text-xs font-semibold text-slate-700">
                    Vehicle Type
                  </Label>
                  <Select
                    value={factorForm.vehicleType}
                    onValueChange={(val: any) => setFactorForm((prev) => ({ ...prev, vehicleType: val }))}
                    disabled={Boolean(editingFactor)}
                  >
                    <SelectTrigger id="vehicleType" className="rounded-xl text-xs">
                      <SelectValue placeholder="Vehicle type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Car">Car</SelectItem>
                      <SelectItem value="SUV">SUV</SelectItem>
                      <SelectItem value="Van">Van</SelectItem>
                      <SelectItem value="Bike">Bike</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="fuelType" className="text-xs font-semibold text-slate-700">
                    Fuel Type
                  </Label>
                  <Select
                    value={factorForm.fuelType}
                    onValueChange={(val: any) => setFactorForm((prev) => ({ ...prev, fuelType: val }))}
                    disabled={Boolean(editingFactor)}
                  >
                    <SelectTrigger id="fuelType" className="rounded-xl text-xs">
                      <SelectValue placeholder="Fuel type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Petrol">Petrol</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="CNG">CNG</SelectItem>
                      <SelectItem value="Electric">Electric</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="engineCategory" className="text-xs font-semibold text-slate-700">
                    Engine Category
                  </Label>
                  <Select
                    value={factorForm.engineCategory}
                    onValueChange={(val: any) => setFactorForm((prev) => ({ ...prev, engineCategory: val }))}
                  >
                    <SelectTrigger id="engineCategory" className="rounded-xl text-xs">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">default (any)</SelectItem>
                      <SelectItem value="<=1200cc">&le; 1200cc</SelectItem>
                      <SelectItem value=">1200cc">&gt; 1200cc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="gramsCO2PerKm" className="text-xs font-semibold text-slate-700">
                    Emission Factor (g/km)
                  </Label>
                  <Input
                    id="gramsCO2PerKm"
                    type="number"
                    step="0.01"
                    min="0"
                    value={factorForm.gramsCO2PerKm}
                    onChange={(e) =>
                      setFactorForm((prev) => ({ ...prev, gramsCO2PerKm: parseFloat(e.target.value) || 0 }))
                    }
                    className="rounded-xl font-mono text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="source" className="text-xs font-semibold text-slate-700">
                  Authoritative Source
                </Label>
                <Input
                  id="source"
                  value={factorForm.source}
                  onChange={(e) => setFactorForm((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="e.g. IPCC 2006 / MoEFCC India GHG Platform"
                  className="rounded-xl text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="sourceReference" className="text-xs font-semibold text-slate-700">
                  Source Reference / Citation
                </Label>
                <Input
                  id="sourceReference"
                  value={factorForm.sourceReference}
                  onChange={(e) => setFactorForm((prev) => ({ ...prev, sourceReference: e.target.value }))}
                  placeholder="e.g. India GHG Platform - Light Duty Fleet Baseline"
                  className="rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFactorDialogOpen(false)}
                className="text-xs rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={factorSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 rounded-lg"
              >
                {factorSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingFactor ? "Save Changes" : "Create Factor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
