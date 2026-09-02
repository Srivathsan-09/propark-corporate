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
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Loader2,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface ISustainabilityAnalytics {
  totalCompletedRides: number;
  totalPassengers: number;
  totalCarpoolDistanceKm: number;
  totalSoloBaselineDistanceKm: number;
  vehicleKilometersReducedKm: number;
  totalEstimatedCO2EmittedKg: number;
  totalEstimatedCO2AvoidedKg: number;
  averageOccupancy: number;
  averageCO2SavingPerRideKg: number;
  averageCO2SavingPerPassengerKg: number;
  co2ReductionPercentage: number;
  equivalentTreesPlanted: number;
  activeEmissionFactorSource: string;
  activeSourceReference: string;
}

interface IMonthlyData {
  month: string;
  label: string;
  co2AvoidedKg: number;
  co2EmittedKg: number;
  soloCO2Kg: number;
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
      }
      if (monthlyRes.ok) {
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
        // PUT update
        const res = await fetch(`/api/carbon/emission-factors/${editingFactor._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(factorForm),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update emission factor");
      } else {
        // POST create
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

  // Pre-calculate solo vs carpool comparison for the primary display
  const soloBaselineCO2 = (analytics?.totalEstimatedCO2EmittedKg || 0) + (analytics?.totalEstimatedCO2AvoidedKg || 0);
  const actualCarpoolCO2 = analytics?.totalEstimatedCO2EmittedKg || 0;
  const co2Avoided = analytics?.totalEstimatedCO2AvoidedKg || 0;
  const reductionPct = analytics?.co2ReductionPercentage || 0;

  // Comparison chart data for Solo vs Carpool
  const comparisonBarData = [
    {
      name: "Commute Scenarios",
      "Solo Driving (Baseline)": Math.round(soloBaselineCO2 * 10) / 10,
      "CommuteX Shared Carpool": Math.round(actualCarpoolCO2 * 10) / 10,
    },
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
              <Leaf className="h-2.5 w-2.5 mr-1 text-emerald-600" /> Sustainability & Environmental Impact
            </Badge>
            <Badge variant="outline" className="text-[10px] font-medium text-slate-500 border-slate-300">
              Academic Research Grade
            </Badge>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Sustainability Analytics & Carbon Accounting
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Quantitative analysis of CO₂ emissions, vehicle-km reductions, and commuter sustainability metrics.
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
            className="h-8 gap-1.5 text-xs text-slate-600"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Data
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAddFactor}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Add Emission Factor
          </Button>
        </div>
      </div>

      {/* SOLO VS CARPOOL COMPARISON BANNER */}
      <Card className="border-emerald-300 bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white shadow-md overflow-hidden relative">
        <div className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Leaf className="h-5 w-5 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Quantitative Environmental Impact Summary
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-1">
                {isLoading ? <Skeleton className="h-8 w-48 bg-slate-700" /> : `${co2Avoided.toLocaleString()} kg CO₂ Avoided`}
              </h2>
              <p className="text-xs text-slate-300 mt-1 max-w-xl">
                Cumulative carbon emissions saved across all completed campus carpool rides compared to if each passenger had driven an individual solo vehicle.
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCalculationModal(true)}
              className="border-emerald-500/50 bg-emerald-900/30 text-emerald-200 hover:bg-emerald-900/50 hover:text-white h-8 text-xs gap-1.5 w-fit"
            >
              <HelpCircle className="h-3.5 w-3.5 text-emerald-400" /> View Calculation Formula
            </Button>
          </div>

          {/* Side-by-Side Comparison Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800">
            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                Solo Commuting Baseline
              </span>
              <div className="text-xl font-black text-rose-400 mt-1">
                {isLoading ? <Skeleton className="h-6 w-20 bg-slate-700" /> : `${soloBaselineCO2.toLocaleString()} kg`}
              </div>
              <span className="text-[10px] text-slate-400">If all rode individually</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700">
              <span className="text-[11px] font-medium text-slate-400 block uppercase tracking-wider">
                CommuteX Carpool Actual
              </span>
              <div className="text-xl font-black text-blue-300 mt-1">
                {isLoading ? <Skeleton className="h-6 w-20 bg-slate-700" /> : `${actualCarpoolCO2.toLocaleString()} kg`}
              </div>
              <span className="text-[10px] text-slate-400">Actual physical vehicle emissions</span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-500/40">
              <span className="text-[11px] font-medium text-emerald-300 block uppercase tracking-wider">
                Estimated Net Savings
              </span>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {isLoading ? <Skeleton className="h-6 w-20 bg-slate-700" /> : `${co2Avoided.toLocaleString()} kg`}
              </div>
              <span className="text-[10px] text-emerald-300">Baseline − Actual Carpool</span>
            </div>

            <div className="p-3 rounded-lg bg-emerald-900/30 border border-emerald-500/40">
              <span className="text-[11px] font-medium text-emerald-300 block uppercase tracking-wider">
                CO₂ Reduction %
              </span>
              <div className="text-xl font-black text-emerald-400 mt-1">
                {isLoading ? <Skeleton className="h-6 w-16 bg-slate-700" /> : `${reductionPct}%`}
              </div>
              <span className="text-[10px] text-emerald-300">Net reduction efficiency</span>
            </div>
          </div>
        </div>
      </Card>

      {/* 12 RESEARCH METRIC CARDS (4x3 GRID) */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Comprehensive Campus Transportation & Carbon Indicators
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* 1. Total Completed Rides */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Completed Carpools</CardTitle>
              <Route className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-12" /> : (analytics?.totalCompletedRides ?? 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Trips verified & completed</p>
            </CardContent>
          </Card>

          {/* 2. Total Passengers Carpooled */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Total Shared Passengers</CardTitle>
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-12" /> : (analytics?.totalPassengers ?? 0)}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Accepted commuter seats</p>
            </CardContent>
          </Card>

          {/* 3. Total Carpool Distance */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Actual Carpool Distance</CardTitle>
              <Car className="h-3.5 w-3.5 text-purple-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.totalCarpoolDistanceKm ?? 0} km`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Physical vehicle route sum</p>
            </CardContent>
          </Card>

          {/* 4. Total Solo Baseline Distance */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Solo Baseline Distance</CardTitle>
              <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.totalSoloBaselineDistanceKm ?? 0} km`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Sum of individual trips</p>
            </CardContent>
          </Card>

          {/* 5. Vehicle-Km Reduced (VKR) */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Vehicle-Km Reduced (VKR)</CardTitle>
              <Route className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-emerald-700">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.vehicleKilometersReducedKm ?? 0} km`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Traffic congestion eliminated</p>
            </CardContent>
          </Card>

          {/* 6. Total Estimated CO2 Emitted */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Est. Carpool CO₂ Emitted</CardTitle>
              <Info className="h-3.5 w-3.5 text-slate-500" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-800">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.totalEstimatedCO2EmittedKg ?? 0} kg`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Actual fleet tailpipe output</p>
            </CardContent>
          </Card>

          {/* 7. Average Occupancy */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Average Occupancy</CardTitle>
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-12" /> : (analytics?.averageOccupancy ? `${analytics.averageOccupancy}` : "1.0")}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Persons per active vehicle</p>
            </CardContent>
          </Card>

          {/* 8. Average CO2 Saving per Ride */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Avg CO₂ Saved / Ride</CardTitle>
              <Leaf className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-emerald-700">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.averageCO2SavingPerRideKg ?? 0} kg`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Per trip environmental benefit</p>
            </CardContent>
          </Card>

          {/* 9. Average CO2 Saving per Passenger */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Avg CO₂ Saved / Passenger</CardTitle>
              <Users className="h-3.5 w-3.5 text-indigo-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-slate-900">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `${analytics?.averageCO2SavingPerPassengerKg ?? 0} kg`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Per commuter emission savings</p>
            </CardContent>
          </Card>

          {/* 10. Tree Equivalent */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Mature Tree Equivalent</CardTitle>
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-emerald-700">
                {isLoading ? <Skeleton className="h-6 w-16" /> : `~${analytics?.equivalentTreesPlanted ?? 0}`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Annual CO₂ absorption basis</p>
            </CardContent>
          </Card>

          {/* 11. Fleet Reduction Percentage */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">CO₂ Reduction %</CardTitle>
              <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xl font-bold text-emerald-700">
                {isLoading ? <Skeleton className="h-6 w-12" /> : `${analytics?.co2ReductionPercentage ?? 0}%`}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">Emission reduction ratio</p>
            </CardContent>
          </Card>

          {/* 12. Active Factor Source */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-1 pt-3.5 px-3.5 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-[11px] font-semibold text-slate-500">Active Baseline Model</CardTitle>
              <Shield className="h-3.5 w-3.5 text-slate-600" />
            </CardHeader>
            <CardContent className="px-3.5 pb-3">
              <div className="text-xs font-bold text-slate-900 truncate" title={analytics?.activeEmissionFactorSource}>
                {isLoading ? <Skeleton className="h-6 w-24" /> : (analytics?.activeEmissionFactorSource || "IPCC / MoEFCC")}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate" title={analytics?.activeSourceReference}>
                Configured emission factor
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 5 RESEARCH CHARTS */}
      {isMounted && (
        <div className="space-y-6">
          {/* ROW 1: Solo vs Carpool Emissions (Chart 1) & Monthly CO2 Savings (Chart 2) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Solo vs Carpool Comparison */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Chart 1: Solo Baseline vs CommuteX Carpool Emissions
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Direct comparison of aggregate carbon emitted (kg CO₂)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-300">
                    Comparative Model
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonBarData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0",
                          fontSize: "12px",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                      <Bar dataKey="Solo Driving (Baseline)" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="CommuteX Shared Carpool" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Chart 2: Monthly CO2 Savings */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Chart 2: Monthly Estimated CO₂ Avoided
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Time-series trend of avoided emissions over time (kg CO₂)
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-emerald-800 border-emerald-300">
                    Time Series
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-64 w-full">
                  {monthlyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No monthly historical data yet. Trips will accumulate here as they complete.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="co2AvoidedGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="co2AvoidedKg"
                          name="CO₂ Avoided (kg)"
                          stroke="#10b981"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#co2AvoidedGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ROW 2: Monthly VKR (Chart 3) & Occupancy vs CO2 (Chart 4) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 3: Monthly VKR */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Chart 3: Vehicle-Kilometers Reduced (VKR) Over Time
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
                <div className="h-64 w-full">
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
                            borderRadius: "12px",
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

            {/* Chart 4: Occupancy vs CO2 per Passenger (Research Core) */}
            <Card className="border-slate-200 shadow-2xs">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      Chart 4: Vehicle Occupancy vs CO₂ per Occupant
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Demonstrates that increasing vehicle occupancy reduces per-person emissions
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-[10px] text-purple-800 border-purple-300">
                    Research Core
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={occupancyData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} unit=" kg" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#ffffff",
                          borderRadius: "12px",
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

          {/* ROW 3: Carpool Trips & Passenger Volume (Chart 5) */}
          <Card className="border-slate-200 shadow-2xs">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900">
                    Chart 5: Carpool Trips Completed & Passenger Volume Over Time
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Correlating ride volume growth with platform adoption
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] text-slate-700 border-slate-300">
                  Adoption Growth
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="h-64 w-full">
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
                          borderRadius: "12px",
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

      {/* METHODOLOGY & RESEARCH TRANSPARENCY SECTION */}
      <Card className="border-slate-200 bg-slate-50/80 shadow-2xs">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-emerald-700" />
            <CardTitle className="text-sm font-bold text-slate-900">
              Academic Research Methodology & Scientific Assumptions
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Formal disclosure for publication and thesis validation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <p>
            <strong>Estimation Notice:</strong> CommuteX estimates CO₂ emissions using travel distance and an emission factor expressed in grams of CO₂ per kilometre:
          </p>
          <div className="p-3 bg-white rounded-xl border border-slate-200 font-mono text-slate-800 text-[11px] space-y-1">
            <div>CO₂ Emissions (g) = Travel Distance (km) × Emission Factor (g CO₂/km)</div>
            <div>CO₂ Emissions (kg) = CO₂ Emissions (g) / 1000</div>
            <div>CO₂ Avoided (kg) = Total Passenger Solo Baseline CO₂ − Actual Carpool Vehicle CO₂</div>
            <div>Vehicle-Km Reduced (VKR) = Total Solo Distance − Actual Carpool Distance</div>
          </div>
          <p>
            The calculated values represent <strong>computational estimates rather than direct tailpipe measurements</strong>. Actual vehicle emissions may vary based on vehicle mechanical condition, route traffic congestion, individual driving behaviour, ambient temperature, air conditioning usage, fuel efficiency, and vehicle passenger load.
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

      {/* CONFIGURABLE EMISSION FACTORS MANAGEMENT TABLE */}
      <Card className="border-slate-200 shadow-2xs">
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
            className="h-8 gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
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
                        className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
                      >
                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(f)}
                        className={`h-7 px-2 text-[11px] ${
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

      {/* CALCULATION TRANSPARENCY DIALOG */}
      <Dialog open={showCalculationModal} onOpenChange={setShowCalculationModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-emerald-600" />
              Carbon Emission Calculation Methodology
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Complete mathematical model used across CommuteX research analysis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-3 text-xs text-slate-700">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">1. Solo Commuting Baseline Formula</span>
              <p className="text-[11px] text-slate-600">
                For each accepted passenger, the system evaluates individual travel distance (origin to destination) if they had driven solo:
              </p>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                Solo Passenger CO₂ (kg) = Solo Distance (km) × Factor (g/km) / 1000
              </div>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                Total Solo Baseline = ∑(All Passenger Solo CO₂)
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">2. Actual Physical Carpool Emissions</span>
              <p className="text-[11px] text-slate-600">
                The carpool vehicle physically drives its actual route distance (sourced from GPS telemetry when available, or OSRM route calculation):
              </p>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                Actual Carpool CO₂ (kg) = Actual Vehicle Distance (km) × Vehicle Factor (g/km) / 1000
              </div>
              <p className="text-[10px] text-amber-700 font-medium">
                Note: Total vehicle emissions are never artificially divided by passenger count; the car travels its physical route.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="font-bold text-slate-900 block">3. Net Environmental Savings</span>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                CO₂ Avoided (kg) = Total Solo Baseline − Actual Carpool CO₂
              </div>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                Vehicle-Km Reduced (VKR) = Total Solo Distance − Actual Vehicle Distance
              </div>
              <div className="font-mono text-[11px] bg-white p-2 rounded border border-slate-200">
                CO₂ Reduction % = (CO₂ Avoided / Total Solo Baseline) × 100
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setShowCalculationModal(false)}
              className="bg-slate-900 text-white text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ADD / EDIT EMISSION FACTOR DIALOG */}
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
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={factorSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
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
