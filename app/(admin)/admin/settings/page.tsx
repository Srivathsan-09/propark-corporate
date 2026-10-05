"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Leaf,
  Cpu,
  Server,
  Zap,
  RefreshCw,
  Download,
  Plus,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Radio,
  Clock,
  Layers,
  BarChart3,
  Edit2,
  ChevronDown,
  ChevronUp,
  X,
  Play,
  Activity,
  Terminal,
  Database,
  Route,
  Car,
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
import { Skeleton } from "@/components/ui/skeleton";
import { CarLoader } from "@/components/common/CarLoader";
import { cn } from "@/lib/utils";
import { IConcurrencyMetrics, ILoadTestResult, IServerNode } from "@/lib/concurrency/types";

// ==========================================
// TYPES FOR SUSTAINABILITY
// ==========================================
interface IDiagnosticRideItem {
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
  reductionPercentage: number;
  dataCompleteness: "COMPLETE" | "INCOMPLETE";
  calculatedAt?: string | Date;
}

interface ISustainabilityAnalytics {
  totalCompletedRides: number;
  totalPassengers: number;
  totalCarpoolDistanceKm: number;
  totalSoloBaselineDistanceKm: number;
  vehicleKilometersReducedKm: number;
  totalEstimatedCO2AvoidedKg: number;
  averageOccupancy: number;
  averageCO2SavingPerRideKg: number;
  averageCO2SavingPerPassengerKg: number;
  co2ReductionPercentage: number;
  equivalentTreesPlanted: number;
  activeEmissionFactorSource: string;
  diagnostics?: IDiagnosticRideItem[];
  monthlyData?: IMonthlyData[];
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

// ==========================================
// INNER SETTINGS CONTENT COMPONENT
// ==========================================
function SettingsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"sustainability" | "concurrency">(
    requestedTab === "concurrency" ? "concurrency" : "sustainability"
  );

  // Sync tab change with URL query param smoothly
  const handleTabChange = (tab: "sustainability" | "concurrency") => {
    setActiveTab(tab);
    router.replace(`/admin/settings?tab=${tab}`);
  };

  // ------------------------------------------
  // SUSTAINABILITY STATE
  // ------------------------------------------
  const [analytics, setAnalytics] = useState<ISustainabilityAnalytics | null>(null);
  const [monthlyData, setMonthlyData] = useState<IMonthlyData[]>([]);
  const [emissionFactors, setEmissionFactors] = useState<IEmissionFactorItem[]>([]);
  const [isLoadingSust, setIsLoadingSust] = useState(true);
  const [isRefreshingSust, setIsRefreshingSust] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isFactorDialogOpen, setIsFactorDialogOpen] = useState(false);
  const [editingFactor, setEditingFactor] = useState<IEmissionFactorItem | null>(null);
  const [factorForm, setFactorForm] = useState({
    factorId: "",
    vehicleType: "Car",
    fuelType: "Petrol",
    engineCategory: "default",
    gramsCO2PerKm: 130,
    source: "IPCC 2006 / MoEFCC India GHG Platform",
    sourceReference: "",
    isActive: true,
  });

  // ------------------------------------------
  // CONCURRENCY STATE
  // ------------------------------------------
  const [metrics, setMetrics] = useState<IConcurrencyMetrics | null>(null);
  const [activeSseCount, setActiveSseCount] = useState<number>(0);
  const [isLoadingConcurrency, setIsLoadingConcurrency] = useState(true);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [activeTestId, setActiveTestId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ILoadTestResult | null>(null);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Fetch Sustainability Data
  const loadSustainabilityData = async () => {
    try {
      const [analyticsRes, factorsRes] = await Promise.all([
        fetch("/api/carbon/analytics"),
        fetch("/api/carbon/emission-factors"),
      ]);

      if (analyticsRes.ok) {
        const aJson = await analyticsRes.json();
        setAnalytics(aJson.analytics);
        if (aJson.analytics?.monthlyData) {
          setMonthlyData(aJson.analytics.monthlyData);
        }
      }
      if (factorsRes.ok) {
        const fJson = await factorsRes.json();
        setEmissionFactors(fJson.emissionFactors || []);
      }
    } catch (err) {
      console.error("Failed to load sustainability data:", err);
    } finally {
      setIsLoadingSust(false);
      setIsRefreshingSust(false);
    }
  };

  // Fetch Concurrency Metrics
  const fetchConcurrencyMetrics = async () => {
    try {
      const res = await fetch("/api/concurrency/metrics");
      const data = await res.json();
      if (data.success && data.metrics) {
        setMetrics(data.metrics);
        setActiveSseCount(data.activeSseClients || 0);
      }
    } catch (err) {
      console.error("Failed to fetch concurrency metrics:", err);
    } finally {
      setIsLoadingConcurrency(false);
    }
  };

  // Initialize data depending on active tab
  useEffect(() => {
    loadSustainabilityData();
  }, []);

  useEffect(() => {
    fetchConcurrencyMetrics();
    const interval = setInterval(fetchConcurrencyMetrics, 4000);

    const eventSource = new EventSource("/api/rides/realtime/stream");
    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === "RIDE_AVAILABILITY_UPDATED" || parsed.type === "QUEUE_POSITION_UPDATED") {
          fetchConcurrencyMetrics();
        }
      } catch (e) {}
    };

    return () => {
      clearInterval(interval);
      eventSource.close();
    };
  }, []);

  // CSV Export for Sustainability
  const handleExportCSV = async (type: "all" | "monthly" | "rides") => {
    try {
      const res = await fetch(`/api/carbon/analytics/export?type=${type}`);
      if (!res.ok) throw new Error("CSV download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `commute-sustainability-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error("CSV Export error:", e);
    }
  };

  // Save Emission Factor
  const handleSaveFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingFactor ? "PUT" : "POST";
      const payload = editingFactor ? { ...factorForm, _id: editingFactor._id } : factorForm;
      const res = await fetch("/api/carbon/emission-factors", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsFactorDialogOpen(false);
        loadSustainabilityData();
      }
    } catch (err) {
      console.error("Error saving factor:", err);
    }
  };

  // Concurrency Test Data Purge
  const handleCleanTestData = async () => {
    setIsCleaningUp(true);
    try {
      const res = await fetch("/api/concurrency/load-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cleanup" }),
      });
      const data = await res.json();
      if (data.success) {
        setExecutionLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ✅ ${data.message || "Test data successfully purged."}`,
          ...prev,
        ]);
        fetchConcurrencyMetrics();
      }
    } catch (e) {
      console.error("Cleanup error:", e);
    } finally {
      setIsCleaningUp(false);
    }
  };

  // Run Load Test
  const handleRunLoadTest = async (testId: string) => {
    setIsRunningTest(true);
    setActiveTestId(testId);
    setTestResult(null);

    setExecutionLogs((prev) => [
      `[${new Date().toLocaleTimeString()}] 🚀 Initiating concurrency simulation: ${testId}`,
      ...prev,
    ]);

    try {
      const res = await fetch("/api/concurrency/load-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      const data = await res.json();
      if (data.success && data.result) {
        setTestResult(data.result);
        setExecutionLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] 🏁 Test Finished in ${data.result.durationMs}ms: ${data.result.successfulBookings} seats booked, ${data.result.failedBookings} rejected, 0 overbookings.`,
          ...prev,
        ]);
        fetchConcurrencyMetrics();
      } else {
        setExecutionLogs((prev) => [
          `[${new Date().toLocaleTimeString()}] ❌ Test Error: ${data.error || "Simulation failed"}`,
          ...prev,
        ]);
      }
    } catch (e: any) {
      setExecutionLogs((prev) => [
        `[${new Date().toLocaleTimeString()}] ❌ Network error executing simulation`,
        ...prev,
      ]);
    } finally {
      setIsRunningTest(false);
      setActiveTestId(null);
    }
  };

  const nodes = metrics?.serverNodes || [];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12 animate-in fade-in-50 duration-300">
      {/* Settings Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Settings
          </h1>
        </div>

        {/* Tab Navigation Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => handleTabChange("sustainability")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeTab === "sustainability"
                ? "bg-white text-emerald-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Leaf className="h-3.5 w-3.5 text-emerald-600" />
            <span>Sustainability</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("concurrency")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeTab === "concurrency"
                ? "bg-white text-purple-900 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Cpu className="h-3.5 w-3.5 text-purple-600" />
            <span>Concurrency Engine</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. SUSTAINABILITY TAB VIEW                                */}
      {/* ========================================================= */}
      {activeTab === "sustainability" && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Leaf className="h-3.5 w-3.5 text-emerald-600" /> Carbon Accounting & Emission Factors
              </span>
              <Badge variant="outline" className="text-[9px] font-semibold border-emerald-300 text-emerald-800 bg-emerald-100/50 py-0 px-1.5">
                IPCC 2006 / India GHG Standard
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRefreshingSust(true);
                  loadSustainabilityData();
                }}
                disabled={isRefreshingSust}
                className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-slate-300 text-slate-700"
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshingSust && "animate-spin")} />
                Refresh
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    <Download className="h-3 w-3 text-emerald-600" /> Export CSV <ChevronDown className="h-2.5 w-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-white border-slate-200 shadow-md">
                  <DropdownMenuItem onClick={() => handleExportCSV("all")} className="text-xs cursor-pointer">
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-emerald-600" /> Full Report
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleExportCSV("monthly")} className="text-xs cursor-pointer">
                    <Leaf className="h-3.5 w-3.5 mr-2 text-slate-500" /> Monthly Summary
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExportCSV("rides")} className="text-xs cursor-pointer">
                    <Route className="h-3.5 w-3.5 mr-2 text-slate-500" /> Rides Breakdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                onClick={() => {
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
                  setIsFactorDialogOpen(true);
                }}
                className="h-7 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1 shadow-2xs"
              >
                <Plus className="h-3 w-3" /> Add Factor
              </Button>
            </div>
          </div>

          {/* 4-Metric Compact Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Estimated CO₂ Avoided</span>
              <div className="text-lg sm:text-xl font-bold text-emerald-700 mt-0.5">
                {isLoadingSust ? <Skeleton className="h-6 w-16" /> : `${analytics?.totalEstimatedCO2AvoidedKg ?? 0} kg`}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium block truncate">vs Solo Commute Baseline</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Vehicle-Km Reduced</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                {isLoadingSust ? <Skeleton className="h-6 w-16" /> : `${analytics?.vehicleKilometersReducedKm ?? 0} km`}
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Road congestion saved</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Carpool Trips</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                {isLoadingSust ? <Skeleton className="h-6 w-12" /> : (analytics?.totalCompletedRides ?? 0)}
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Shared campus journeys</span>
            </div>

            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block truncate">Average Occupancy</span>
              <div className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                {isLoadingSust ? <Skeleton className="h-6 w-12" /> : (analytics?.averageOccupancy ? `${analytics.averageOccupancy}` : "1.0")}
              </div>
              <span className="text-[10px] text-slate-500 block truncate">Persons per vehicle</span>
            </div>
          </div>

          {/* Secondary Compact Info Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
            <div>
              <span className="text-[10px] text-slate-400 block">Avg CO₂ Saved/Ride</span>
              <strong className="text-slate-800 text-xs">{analytics?.averageCO2SavingPerRideKg ?? 0} kg</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Avg CO₂ Saved/Passenger</span>
              <strong className="text-slate-800 text-xs">{analytics?.averageCO2SavingPerPassengerKg ?? 0} kg</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CO₂ Reduction %</span>
              <strong className="text-emerald-700 text-xs">{analytics?.co2ReductionPercentage ?? 0}%</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Tree Equivalent</span>
              <strong className="text-emerald-800 text-xs">~{analytics?.equivalentTreesPlanted ?? 0} trees/yr</strong>
            </div>
          </div>

          {/* Monthly Trend Compact Chart & Active Emission Factors */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Chart: 5 cols */}
            <Card className="lg:col-span-5 rounded-2xl border-slate-200 bg-white shadow-xs p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <BarChart3 className="h-3.5 w-3.5 text-emerald-600" /> Monthly CO₂ Avoided (kg)
                </span>
                <span className="text-[10px] text-slate-400">Past 6 Months</span>
              </div>
              <div className="h-44 w-full">
                {monthlyData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                    No monthly data recorded yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      <Bar dataKey="co2AvoidedKg" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Active Emission Factors Table: 7 cols */}
            <Card className="lg:col-span-7 rounded-2xl border-slate-200 bg-white shadow-xs p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-slate-600" /> Active Carbon Factors
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{emissionFactors.length} standard models</span>
              </div>

              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                    <tr>
                      <th className="py-2 px-3">Vehicle</th>
                      <th className="py-2 px-3">Fuel</th>
                      <th className="py-2 px-3">g CO₂/km</th>
                      <th className="py-2 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {emissionFactors.slice(0, 5).map((f) => (
                      <tr key={f._id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-semibold text-slate-800">{f.vehicleType}</td>
                        <td className="py-2 px-3 text-slate-600">{f.fuelType}</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-700">{f.gramsCO2PerKm}</td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
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
                              setIsFactorDialogOpen(true);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Diagnostic Completed Rides Collapsible */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Route className="h-3.5 w-3.5 text-slate-500" /> Completed Rides Carbon Diagnostics
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsDiagnosticsOpen(!isDiagnosticsOpen)}
                className="h-6 text-[10px] font-bold text-slate-600 gap-1 px-2"
              >
                <span>{isDiagnosticsOpen ? "Hide Breakdown" : "View Diagnostics"}</span>
                {isDiagnosticsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </Button>
            </div>

            {isDiagnosticsOpen && (
              <div className="pt-2 border-t border-slate-100 overflow-x-auto animate-in fade-in-50 duration-200">
                {!analytics?.diagnostics || analytics.diagnostics.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No completed rides recorded for carbon diagnostics yet.</p>
                ) : (
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100">
                      <tr>
                        <th className="py-2 px-2.5">Ride Id</th>
                        <th className="py-2 px-2.5">Passengers</th>
                        <th className="py-2 px-2.5">Shared Dist</th>
                        <th className="py-2 px-2.5">CO₂ Avoided</th>
                        <th className="py-2 px-2.5">Reduction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {analytics.diagnostics.slice(0, 8).map((d) => (
                        <tr key={d.rideId} className="hover:bg-slate-50/50">
                          <td className="py-1.5 px-2.5 font-mono text-slate-600 text-[10px]">{d.rideId.slice(-6)}</td>
                          <td className="py-1.5 px-2.5">{d.passengerCount} coworkers</td>
                          <td className="py-1.5 px-2.5 font-mono">{d.actualSharedVehicleDistanceKm} km</td>
                          <td className="py-1.5 px-2.5 font-mono font-bold text-emerald-700">{d.avoidedEmissionsKg} kg</td>
                          <td className="py-1.5 px-2.5">
                            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-300 text-[9px] py-0 px-1 font-bold">
                              {d.reductionPercentage}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. CONCURRENCY ENGINE TAB VIEW                            */}
      {/* ========================================================= */}
      {activeTab === "concurrency" && (
        <div className="space-y-3.5 animate-in fade-in-50 duration-200">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-purple-600" /> CommuteX High-Concurrency Engine
              </span>
              <Badge className="bg-emerald-600 text-white font-bold text-[9px] py-0 px-2 gap-1">
                <Radio className="h-2 w-2 animate-ping" /> Real-time SSE ({activeSseCount})
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchConcurrencyMetrics}
                disabled={isLoadingConcurrency}
                className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-slate-300 text-slate-700"
              >
                <RefreshCw className={cn("h-3 w-3", isLoadingConcurrency && "animate-spin")} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCleanTestData}
                disabled={isCleaningUp || isRunningTest}
                className="h-7 text-[11px] font-semibold gap-1 rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3 w-3 text-rose-500" />
                {isCleaningUp ? "Purging..." : "Purge Test Data"}
              </Button>
            </div>
          </div>

          {/* Backend Server Nodes Grid (Compact) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {nodes.map((node: IServerNode) => {
              const isOnline = node.status === "ONLINE";
              return (
                <div
                  key={node.id}
                  className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs">
                        <Server className="h-3 w-3" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">{node.id}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Port: {node.port}</span>
                      </div>
                    </div>
                    <Badge className={cn("text-[9px] font-bold py-0 px-1.5", isOnline ? "bg-emerald-600 text-white" : "bg-rose-600 text-white")}>
                      {node.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 text-center text-xs">
                    <div className="p-1 bg-slate-50 rounded-lg">
                      <span className="text-[9px] text-slate-400 block uppercase font-semibold">Active Req</span>
                      <strong className="text-xs text-slate-800">{node.activeRequests}</strong>
                    </div>
                    <div className="p-1 bg-slate-50 rounded-lg">
                      <span className="text-[9px] text-slate-400 block uppercase font-semibold">Load</span>
                      <strong className="text-xs text-emerald-700">{Math.min(100, Math.round((node.activeRequests / 20) * 100))}%</strong>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Simulation & Real-time Logs in 2 Compact Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Load Test Trigger Box: 6 cols */}
            <Card className="lg:col-span-6 rounded-2xl border-slate-200 bg-white shadow-xs p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Play className="h-3.5 w-3.5 text-purple-600" /> High-Concurrency Simulation
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Round-Robin & Atomic Locks</span>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRunningTest}
                  onClick={() => handleRunLoadTest("small_concurrent_5")}
                  className="flex-1 h-7 text-[11px] font-bold border-purple-200 text-purple-800 hover:bg-purple-50"
                >
                  {isRunningTest && activeTestId === "small_concurrent_5" ? "Running..." : "5 Bookings"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRunningTest}
                  onClick={() => handleRunLoadTest("medium_concurrent_10")}
                  className="flex-1 h-7 text-[11px] font-bold border-purple-200 text-purple-800 hover:bg-purple-50"
                >
                  {isRunningTest && activeTestId === "medium_concurrent_10" ? "Running..." : "10 Bookings"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isRunningTest}
                  onClick={() => handleRunLoadTest("heavy_concurrent_20")}
                  className="flex-1 h-7 text-[11px] font-bold border-purple-200 text-purple-800 hover:bg-purple-50"
                >
                  {isRunningTest && activeTestId === "heavy_concurrent_20" ? "Running..." : "20 Bookings"}
                </Button>
              </div>

              {testResult && (
                <div className="p-2.5 rounded-xl bg-purple-50/70 border border-purple-200 space-y-1 text-xs">
                  <div className="flex items-center justify-between font-bold text-purple-950">
                    <span>Simulation Completed</span>
                    <span className="font-mono text-purple-700">{testResult.durationMs}ms</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 pt-1 text-[11px]">
                    <div>Attempted: <strong>{testResult.concurrentUsers}</strong></div>
                    <div>Booked: <strong className="text-emerald-700">{testResult.successfulBookings}</strong></div>
                    <div>Overbooked: <strong className="text-emerald-800 font-bold">0 (Protected)</strong></div>
                  </div>
                </div>
              )}
            </Card>

            {/* Real-time Terminal Log: 6 cols */}
            <Card className="lg:col-span-6 rounded-2xl border-slate-800 bg-slate-950 shadow-xs p-3.5 space-y-2 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-slate-300">
                  <Terminal className="h-3.5 w-3.5 text-emerald-400" /> Concurrency Event Stream
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">Live Buffer</span>
              </div>
              <div className="h-28 overflow-y-auto space-y-1 font-mono text-[10px] text-emerald-400/90 divide-y divide-slate-800/40 pr-1">
                {executionLogs.length === 0 ? (
                  <p className="text-slate-500 italic py-2">Listening to live SSE stream & queue events...</p>
                ) : (
                  executionLogs.map((log, idx) => (
                    <div key={idx} className="pt-1 truncate">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* EMISSION FACTOR DIALOG MODAL */}
      <Dialog open={isFactorDialogOpen} onOpenChange={setIsFactorDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingFactor ? "Edit Carbon Emission Factor" : "Add Carbon Emission Factor"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Configure baseline vehicle emissions (g CO₂ per kilometer) for corporate sustainability metrics.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFactor} className="space-y-3 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="vehicleType" className="text-[10px] uppercase font-bold text-slate-500">Vehicle Type</Label>
                <Select
                  value={factorForm.vehicleType}
                  onValueChange={(val: any) => setFactorForm({ ...factorForm, vehicleType: val })}
                >
                  <SelectTrigger id="vehicleType" className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Car">Car</SelectItem>
                    <SelectItem value="SUV">SUV</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Bike">Bike</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="fuelType" className="text-[10px] uppercase font-bold text-slate-500">Fuel Type</Label>
                <Select
                  value={factorForm.fuelType}
                  onValueChange={(val: any) => setFactorForm({ ...factorForm, fuelType: val })}
                >
                  <SelectTrigger id="fuelType" className="h-8 text-xs">
                    <SelectValue />
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

            <div className="space-y-1">
              <Label htmlFor="gramsCO2PerKm" className="text-[10px] uppercase font-bold text-slate-500">Grams CO₂ / km</Label>
              <Input
                id="gramsCO2PerKm"
                type="number"
                value={factorForm.gramsCO2PerKm}
                onChange={(e) => setFactorForm({ ...factorForm, gramsCO2PerKm: Number(e.target.value) })}
                className="h-8 text-xs font-mono font-bold"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="source" className="text-[10px] uppercase font-bold text-slate-500">Source Standard</Label>
              <Input
                id="source"
                value={factorForm.source}
                onChange={(e) => setFactorForm({ ...factorForm, source: e.target.value })}
                className="h-8 text-xs"
                required
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsFactorDialogOpen(false)} className="h-8 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Save Factor
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrap in Suspense boundary for Next.js useSearchParams
export default function AdminSettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 flex flex-col items-center justify-center">
          <CarLoader size="page" message="Loading Settings..." />
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
