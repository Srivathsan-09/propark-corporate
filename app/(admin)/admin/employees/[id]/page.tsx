"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ArrowLeft,
  Users,
  Car,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Shield,
  Eye,
  Check,
  X,
  Play,
  FileText,
  Compass,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  Map as MapIcon,
  Phone,
  Mail,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CarLoader } from "@/components/common/CarLoader";
import MapView from "@/components/map/MapView";
import { getInitials } from "@/lib/utils";
import type {
  CommuteSummary,
  CommutePattern,
  RouteHistoryItem,
  VehicleHistoryItem,
  FormattedRideItem,
  FormattedActivityItem,
} from "@/lib/services/historyService";

interface EmployeeProfile {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  campusId: string;
  campusName: string;
  department: string;
  role: string;
  verificationStatus: string;
  isApproved: boolean;
  profileImage: string;
  homeLocation: string;
  createdAt: string;
}

export default function EmployeeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const employeeId = params?.id as string;

  const [activeTab, setActiveTab] = useState<
    "overview" | "rides" | "driver" | "passenger" | "routes" | "vehicles" | "activity"
  >("overview");

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Data states
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [summary, setSummary] = useState<CommuteSummary | null>(null);
  const [pattern, setPattern] = useState<CommutePattern | null>(null);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);
  const [vehicleHistory, setVehicleHistory] = useState<VehicleHistoryItem[]>([]);
  const [driverRides, setDriverRides] = useState<FormattedRideItem[]>([]);
  const [passengerRides, setPassengerRides] = useState<FormattedRideItem[]>([]);
  const [rides, setRides] = useState<FormattedRideItem[]>([]);
  const [activities, setActivities] = useState<FormattedActivityItem[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Ride Details Modal State
  const [selectedRide, setSelectedRide] = useState<FormattedRideItem | null>(null);
  const [isRideModalOpen, setIsRideModalOpen] = useState(false);
  const [showMapInModal, setShowMapInModal] = useState(false);

  const fetchEmployeeData = async () => {
    if (!employeeId) return;
    try {
      setIsLoading(true);
      setErrorMessage(null);

      const query = new URLSearchParams();
      if (searchQuery) query.set("search", searchQuery);
      if (statusFilter !== "all") query.set("status", statusFilter);
      if (roleFilter !== "all") query.set("role", roleFilter);
      if (activityTypeFilter !== "all") query.set("activityType", activityTypeFilter);
      if (dateFrom) query.set("dateFrom", dateFrom);
      if (dateTo) query.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/employees/${employeeId}/history?${query.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to load employee details.");
        return;
      }

      setEmployee(data.employee);
      setSummary(data.summary);
      setPattern(data.pattern);
      setRouteHistory(data.routeHistory || []);
      setVehicleHistory(data.vehicleHistory || []);
      setDriverRides(data.driverRides || []);
      setPassengerRides(data.passengerRides || []);
      setRides(data.rides || []);
      setActivities(data.activities || []);
    } catch (err: any) {
      console.error("Fetch Employee Complete History Error:", err);
      setErrorMessage("Network error occurred while fetching employee commute history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId, statusFilter, roleFilter, activityTypeFilter, dateFrom, dateTo]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchEmployeeData();
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const openRideDetails = (ride: FormattedRideItem) => {
    setSelectedRide(ride);
    setShowMapInModal(false);
    setIsRideModalOpen(true);
  };

  if (isLoading && !employee) {
    return (
      <div className="py-24 flex flex-col items-center justify-center">
        <CarLoader size="lg" message="Loading employee commute history & activity audit..." />
      </div>
    );
  }

  if (errorMessage && !employee) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 shadow-xs">
          <XCircle className="h-10 w-10 text-rose-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-rose-900 mb-1">Access Restricted or Error</h2>
          <p className="text-xs text-rose-700 mb-5">{errorMessage}</p>
          <Link href="/admin/employees">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Employee Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-12 animate-in fade-in-50 duration-300">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/employees"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Employees
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border-emerald-200">
            CommuteX Audit Profile
          </Badge>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchEmployeeData}
            className="h-7 px-2 text-slate-500 hover:text-slate-800 text-xs"
            title="Refresh Data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 1. EMPLOYEE INFORMATION HEADER */}
      {employee && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-xl shrink-0 overflow-hidden border-2 border-emerald-500/30 shadow-xs">
                {employee.profileImage ? (
                  <img
                    src={employee.profileImage}
                    alt={employee.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitials(employee.name)
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">{employee.name}</h1>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {employee.employeeId}
                  </span>
                  {employee.role === "admin" ? (
                    <Badge className="bg-purple-100 text-purple-800 text-[10px] font-bold">Super Admin</Badge>
                  ) : employee.role === "campus_admin" ? (
                    <Badge className="bg-blue-100 text-blue-800 text-[10px] font-bold">Campus Admin</Badge>
                  ) : (
                    <Badge variant="outline" className="text-slate-600 text-[10px] font-medium">
                      Corporate Employee
                    </Badge>
                  )}
                  {employee.isApproved ? (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-semibold gap-1">
                      <Check className="h-3 w-3" /> Approved
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-semibold gap-1">
                      <AlertCircle className="h-3 w-3" /> Pending Verification
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-slate-400" /> {employee.email}
                  </span>
                  {employee.phone && employee.phone !== "—" && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" /> {employee.phone}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-slate-400" /> {employee.department} • {employee.campusName || employee.campusId}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200/80 shrink-0">
              <div>
                <span className="text-slate-400">Joined: </span>
                <span className="font-semibold text-slate-800">{employee.createdAt}</span>
              </div>
              <div>
                <span className="text-slate-400">Last Commute Activity: </span>
                <span className="font-semibold text-emerald-700">
                  {summary?.lastCommuteActivity || "No rides yet"}
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 2. COMMUTE SUMMARY CARD (Answers the 10-second inspection) */}
      {summary && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Commute Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Total Rides */}
            <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Rides</span>
              <span className="text-2xl font-black text-slate-900 mt-1">{summary.totalRides}</span>
              <span className="text-[10px] text-slate-400 mt-0.5">All CommuteX trips</span>
            </div>

            {/* As Driver */}
            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wider">Rides as Driver</span>
              <span className="text-2xl font-black text-purple-900 mt-1">{summary.ridesAsDriver}</span>
              <span className="text-[10px] text-purple-600/80 mt-0.5">Offered vehicle</span>
            </div>

            {/* As Passenger */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Rides as Passenger</span>
              <span className="text-2xl font-black text-blue-900 mt-1">{summary.ridesAsPassenger}</span>
              <span className="text-[10px] text-blue-600/80 mt-0.5">Carpool passenger</span>
            </div>

            {/* Completed */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Completed</span>
              <span className="text-2xl font-black text-emerald-900 mt-1">{summary.completed}</span>
              <span className="text-[10px] text-emerald-600/80 mt-0.5">Successful trips</span>
            </div>

            {/* Cancelled */}
            <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Cancelled</span>
              <span className="text-2xl font-black text-rose-900 mt-1">{summary.cancelled}</span>
              <span className="text-[10px] text-rose-600/80 mt-0.5">Cancelled rides</span>
            </div>

            {/* Total Distance */}
            <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Total Distance</span>
              <span className="text-xl font-black text-emerald-950 mt-1">
                {summary.totalDistanceKm > 0 ? `${summary.totalDistanceKm} km` : "Not enough data"}
              </span>
              <span className="text-[10px] text-emerald-700 mt-0.5">
                Avg: {summary.averageRideDistanceKm ? `${summary.averageRideDistanceKm} km` : "—"}
              </span>
            </div>
          </CardContent>

          {/* Quick Frequent Origin/Destination strip */}
          <div className="px-5 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Most Frequent Origin:</span>
              <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {summary.mostFrequentOrigin || "Not enough data"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Most Frequent Destination:</span>
              <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                {summary.mostFrequentDestination || "Not enough data"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Typical Departure:</span>
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {summary.typicalDepartureTime || "Not enough data"}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* 3. TABS NAVIGATION */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 overflow-x-auto text-xs font-semibold scrollbar-none">
        {[
          { id: "overview", label: "Overview", count: null },
          { id: "rides", label: "Ride History", count: rides.length },
          { id: "driver", label: "Driver History", count: driverRides.length },
          { id: "passenger", label: "Passenger History", count: passengerRides.length },
          { id: "routes", label: "Route History", count: routeHistory.length },
          { id: "vehicles", label: "Vehicles", count: vehicleHistory.length },
          { id: "activity", label: "Activity Audit", count: activities.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB A: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* Commute Pattern Analysis Card */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-emerald-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600" /> Historical Commute Pattern
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              {pattern?.hasSufficientData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Primary Commute Route</span>
                    <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>{pattern.primaryRoute}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Typical Departure & Arrival</span>
                    <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        {pattern.typicalDeparture} → {pattern.typicalArrival}
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Average Rides Per Week</span>
                    <div className="text-sm font-bold text-slate-900 mt-1">
                      {pattern.averageWeeklyRides} rides / week
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Most Frequent Intermediate Stop</span>
                    <div className="text-sm font-bold text-slate-900 mt-1">{pattern.mostFrequentStop}</div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Active Commute Days</span>
                    <div className="text-sm font-bold text-slate-900 mt-1">{pattern.mostFrequentDays}</div>
                  </div>

                  <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <span className="text-[11px] text-slate-500 font-medium">Average Trip Distance</span>
                    <div className="text-sm font-bold text-slate-900 mt-1">{pattern.averageDistance}</div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  <Compass className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-semibold text-slate-700">Not Enough Historical Data</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {pattern?.message || "Insufficient historical data to determine a reliable commute pattern."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Rides Quick Table */}
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Recent Commute Rides
              </CardTitle>
              <button
                type="button"
                onClick={() => setActiveTab("rides")}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                View Full Ride History <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </CardHeader>
            <CardContent className="p-0">
              {rides.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">No commute history yet.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {rides.slice(0, 5).map((r) => (
                    <div
                      key={r.id}
                      className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs shrink-0 ${
                            r.role === "Driver"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {r.role === "Driver" ? "DRV" : "PAX"}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                            <span>{r.rideCode}</span>
                            <span className="font-normal text-slate-400">•</span>
                            <span>
                              {r.from} → {r.to}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            <span>{r.date}</span>
                            <span>•</span>
                            <span>{r.departureTime}</span>
                            <span>•</span>
                            <span>{r.distanceKm} km</span>
                            <span>•</span>
                            <span>{r.vehicleModel}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={r.status} />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRideDetails(r)}
                          className="h-7 px-2.5 text-xs font-semibold"
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB B: COMPLETE RIDE HISTORY */}
      {activeTab === "rides" && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-4 px-5 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold text-slate-900">Complete Ride History</CardTitle>
              <div className="text-xs text-slate-500">
                Total matching records: <span className="font-bold text-slate-800">{rides.length}</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search Ride ID, route, vehicle..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs rounded-lg"
                />
              </div>

              {/* Role filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-8 w-auto inline-flex items-center justify-start gap-1.5 px-2.5 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all cursor-pointer">
                  <SelectValue placeholder="Role: All Roles" />
                </SelectTrigger>
                <SelectContent className="min-w-[150px] rounded-xl border-slate-200 shadow-lg bg-white p-1">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">Role: All Roles</SelectItem>
                  <SelectItem value="driver" className="text-xs font-medium cursor-pointer">Role: Driver</SelectItem>
                  <SelectItem value="passenger" className="text-xs font-medium cursor-pointer">Role: Passenger</SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-auto inline-flex items-center justify-start gap-1.5 px-2.5 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all cursor-pointer">
                  <SelectValue placeholder="Status: All Statuses" />
                </SelectTrigger>
                <SelectContent className="min-w-[180px] rounded-xl border-slate-200 shadow-lg bg-white p-1">
                  <SelectItem value="all" className="text-xs font-medium cursor-pointer">Status: All Statuses</SelectItem>
                  <SelectItem value="completed" className="text-xs font-medium cursor-pointer">Status: Completed</SelectItem>
                  <SelectItem value="cancelled" className="text-xs font-medium cursor-pointer">Status: Cancelled</SelectItem>
                  <SelectItem value="upcoming" className="text-xs font-medium cursor-pointer">Status: Upcoming (Scheduled)</SelectItem>
                  <SelectItem value="ongoing" className="text-xs font-medium cursor-pointer">Status: Ongoing (In Progress)</SelectItem>
                </SelectContent>
              </Select>

              {/* Date From */}
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 text-xs rounded-lg"
                placeholder="From Date"
              />

              {/* Date To */}
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 text-xs rounded-lg"
                placeholder="To Date"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {rides.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                No commute rides match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ minWidth: "850px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-3 font-bold">Ride ID</th>
                      <th className="py-3 px-3 font-bold">Role</th>
                      <th className="py-3 px-3 font-bold">From</th>
                      <th className="py-3 px-3 font-bold">To</th>
                      <th className="py-3 px-3 font-bold">Stops</th>
                      <th className="py-3 px-3 font-bold">Departure</th>
                      <th className="py-3 px-3 font-bold">Distance</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rides.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">{r.date}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-emerald-800">{r.rideCode}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.role === "Driver"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {r.role}
                          </span>
                        </td>
                        <td className="py-3 px-3 max-w-[140px] truncate text-slate-800" title={r.from}>
                          {r.from}
                        </td>
                        <td className="py-3 px-3 max-w-[140px] truncate text-slate-800" title={r.to}>
                          {r.to}
                        </td>
                        <td className="py-3 px-3 max-w-[150px] truncate text-slate-500 text-[11px]" title={r.stopsText}>
                          {r.stopsText}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">{r.departureTime}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">{r.distanceKm} km</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRideDetails(r)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB C: DRIVER HISTORY */}
      {activeTab === "driver" && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-slate-100 bg-purple-50/40">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-purple-900 flex items-center gap-2">
              <Car className="h-4 w-4 text-purple-600" /> Rides as Driver ({driverRides.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {driverRides.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No driver rides yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ minWidth: "800px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-3 font-bold">Ride ID</th>
                      <th className="py-3 px-3 font-bold">Vehicle</th>
                      <th className="py-3 px-3 font-bold">Route</th>
                      <th className="py-3 px-3 font-bold">Passengers</th>
                      <th className="py-3 px-3 font-bold">Seats Offered</th>
                      <th className="py-3 px-3 font-bold">Distance</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {driverRides.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">{r.date}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-purple-900">{r.rideCode}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                          <span className="font-semibold">{r.vehicleModel}</span>
                          {r.vehicleRegistration && (
                            <span className="text-[10px] text-slate-400 block">{r.vehicleRegistration}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 max-w-[200px] truncate text-slate-800">
                          {r.from} → {r.to}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">
                          {r.passengersCount} {r.passengersCount === 1 ? "Passenger" : "Passengers"}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">{r.seatsOffered} Seats</td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">{r.distanceKm} km</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRideDetails(r)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB D: PASSENGER HISTORY */}
      {activeTab === "passenger" && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-slate-100 bg-blue-50/40">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" /> Rides as Passenger ({passengerRides.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {passengerRides.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">No passenger rides yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ minWidth: "800px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-3 font-bold">Ride ID</th>
                      <th className="py-3 px-3 font-bold">Driver</th>
                      <th className="py-3 px-3 font-bold">Route</th>
                      <th className="py-3 px-3 font-bold">Departure</th>
                      <th className="py-3 px-3 font-bold">Distance</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {passengerRides.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-slate-800">{r.date}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-bold text-blue-900">{r.rideCode}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">
                          {r.driverName || "Corporate Driver"}
                        </td>
                        <td className="py-3 px-3 max-w-[200px] truncate text-slate-800">
                          {r.from} → {r.to}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-700">{r.departureTime}</td>
                        <td className="py-3 px-3 whitespace-nowrap font-medium text-slate-800">{r.distanceKm} km</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRideDetails(r)}
                            className="h-7 px-2.5 text-xs font-semibold"
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB E: ROUTE HISTORY */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
            <CardHeader className="py-3 px-5 border-b border-slate-100 bg-emerald-50/40">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600" /> Commute Route History (Derived from actual rides)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {routeHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">No route history recorded yet.</div>
              ) : (
                routeHistory.map((route, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border ${
                      idx === 0
                        ? "border-emerald-300 bg-emerald-50/30"
                        : "border-slate-200 bg-white hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                            Most Frequent Route
                          </Badge>
                        )}
                        <span className="text-xs font-bold text-slate-900">
                          Route #{idx + 1}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        Last Used: <span className="font-semibold text-slate-800">{route.lastUsed}</span>
                      </div>
                    </div>

                    {/* Route Visual Timeline */}
                    <div className="flex flex-wrap items-center gap-2 py-2 text-xs font-semibold text-slate-800">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
                        {route.origin}
                      </span>
                      {route.stops.map((st, sIdx) => (
                        <React.Fragment key={sIdx}>
                          <span className="text-slate-400">↓</span>
                          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                            {st}
                          </span>
                        </React.Fragment>
                      ))}
                      <span className="text-slate-400">↓</span>
                      <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-900">
                        {route.destination}
                      </span>
                    </div>

                    {/* Route Metrics */}
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Total Trips</span>
                        <span className="font-bold text-slate-900 text-sm">{route.trips}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Average Distance</span>
                        <span className="font-bold text-slate-900 text-sm">{route.averageDistanceKm} km</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block uppercase">Typical Departure</span>
                        <span className="font-bold text-emerald-700 text-sm">{route.averageDeparture}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB F: VEHICLES */}
      {activeTab === "vehicles" && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-3 px-5 border-b border-slate-100">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Registered Vehicles & Fleet History ({vehicleHistory.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {vehicleHistory.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No vehicles registered by this employee.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs" style={{ minWidth: "700px" }}>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                      <th className="py-3 px-4 font-bold">Vehicle Model</th>
                      <th className="py-3 px-3 font-bold">Registration Plate</th>
                      <th className="py-3 px-3 font-bold">Type & Capacity</th>
                      <th className="py-3 px-3 font-bold">Status</th>
                      <th className="py-3 px-3 font-bold">Added Date</th>
                      <th className="py-3 px-3 font-bold">Last Used</th>
                      <th className="py-3 px-4 font-bold text-right">Rides Completed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vehicleHistory.map((v) => (
                      <tr key={v._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">{v.vehicleModel}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tracking-wide">
                            {v.registrationNumber}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {v.vehicleType} • {v.seatingCapacity} Seats
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {v.verificationStatus === "approved" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              {v.verificationStatus}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-500">{v.addedDate}</td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">{v.lastUsed || "Never Used"}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-bold text-emerald-800">
                          {v.ridesCount} {v.ridesCount === 1 ? "Ride" : "Rides"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* TAB G: ACTIVITY AUDIT TIMELINE */}
      {activeTab === "activity" && (
        <Card className="border-slate-200 bg-white shadow-2xs rounded-2xl overflow-hidden">
          <CardHeader className="py-4 px-5 border-b border-slate-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" /> Chronological Activity Audit Timeline
              </CardTitle>
              <div className="text-xs text-slate-500">
                Newest business events first • Structured audit
              </div>
            </div>

            {/* Filter by activity type */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <select
                value={activityTypeFilter}
                onChange={(e) => setActivityTypeFilter(e.target.value)}
                className="h-8 text-xs border border-slate-200 rounded-lg px-2.5 bg-white text-slate-700"
              >
                <option value="all">All Activity Types</option>
                <option value="RIDE_CREATED">Ride Created</option>
                <option value="RIDE_JOINED">Ride Joined (Passenger)</option>
                <option value="RIDE_STARTED">Ride Started</option>
                <option value="RIDE_COMPLETED">Ride Completed</option>
                <option value="RIDE_CANCELLED">Ride Cancelled</option>
                <option value="STOP_ADDED">Stop Added</option>
                <option value="VEHICLE_ADDED">Vehicle Added</option>
                <option value="VEHICLE_UPDATED">Vehicle Updated</option>
                <option value="PROFILE_UPDATED">Profile Updated</option>
              </select>
            </div>
          </CardHeader>

          <CardContent className="p-5">
            {activities.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No activity records found matching filters.
              </div>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="relative group">
                    {/* Circle Dot indicator */}
                    <div
                      className={`absolute -left-[19px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs ${
                        act.badgeColor === "emerald"
                          ? "bg-emerald-500"
                          : act.badgeColor === "rose"
                          ? "bg-rose-500"
                          : act.badgeColor === "blue"
                          ? "bg-blue-500"
                          : act.badgeColor === "purple"
                          ? "bg-purple-500"
                          : "bg-amber-500"
                      }`}
                    />

                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-3.5 transition-all hover:bg-slate-50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              act.badgeColor === "emerald"
                                ? "bg-emerald-100 text-emerald-800"
                                : act.badgeColor === "rose"
                                ? "bg-rose-100 text-rose-800"
                                : act.badgeColor === "blue"
                                ? "bg-blue-100 text-blue-800"
                                : act.badgeColor === "purple"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {act.activityType.replace(/_/g, " ")}
                          </span>
                          {act.metadata?.rideCode && (
                            <span className="text-xs font-bold text-slate-900">
                              {act.metadata.rideCode}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {act.formattedDate} • {act.formattedTime}
                        </div>
                      </div>

                      <p className="text-xs text-slate-800 font-medium">{act.description}</p>

                      {act.metadata && Object.keys(act.metadata).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200/60 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          {act.metadata.origin && (
                            <span>
                              <strong className="text-slate-700">From:</strong> {act.metadata.origin}
                            </span>
                          )}
                          {act.metadata.destination && (
                            <span>
                              <strong className="text-slate-700">To:</strong> {act.metadata.destination}
                            </span>
                          )}
                          {act.metadata.stopName && (
                            <span>
                              <strong className="text-slate-700">Stop:</strong> {act.metadata.stopName}
                            </span>
                          )}
                          {act.metadata.vehicleModel && (
                            <span>
                              <strong className="text-slate-700">Vehicle:</strong> {act.metadata.vehicleModel}
                            </span>
                          )}
                          {act.metadata.reason && (
                            <span>
                              <strong className="text-rose-700">Reason:</strong> {act.metadata.reason}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. RIDE DETAILS MODAL */}
      <Dialog open={isRideModalOpen} onOpenChange={setIsRideModalOpen}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-2xl max-h-[90vh] flex flex-col">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Ride Details: {selectedRide?.rideCode}</span>
                  {selectedRide && <StatusBadge status={selectedRide.status} />}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Complete CommuteX operational and route records for this historical ride
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedRide && (
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Core Information Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Employee Role</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedRide.role}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Departure Date</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedRide.date}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Departure Time</span>
                  <span className="font-bold text-emerald-700 text-xs">{selectedRide.departureTime}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Distance</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedRide.distanceKm} km</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Est. Duration</span>
                  <span className="font-bold text-slate-900 text-xs">{selectedRide.durationMinutes} mins</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">Vehicle</span>
                  <span className="font-bold text-slate-900 text-xs">
                    {selectedRide.vehicleModel} {selectedRide.vehicleRegistration && `(${selectedRide.vehicleRegistration})`}
                  </span>
                </div>
              </div>

              {/* Route Itinerary */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Route Corridor
                </span>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-semibold text-slate-900">Origin:</span>
                  <span className="text-slate-700">{selectedRide.from}</span>
                </div>

                {selectedRide.stops.length > 0 && (
                  <div className="pl-4 border-l-2 border-slate-200 space-y-1.5 my-1.5 text-[11px] text-slate-600">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Intermediate Stops:</span>
                    {selectedRide.stops.map((st, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span>{st}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  <span className="font-semibold text-slate-900">Destination:</span>
                  <span className="text-slate-700">{selectedRide.to}</span>
                </div>
              </div>

              {/* Timestamps & Audit Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block">Created:</span>
                  <span className="font-medium text-slate-700">
                    {selectedRide.createdAt ? new Date(selectedRide.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Started:</span>
                  <span className="font-medium text-slate-700">
                    {selectedRide.startedAt ? new Date(selectedRide.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Completed:</span>
                  <span className="font-medium text-slate-700">
                    {selectedRide.completedAt ? new Date(selectedRide.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Cancelled:</span>
                  <span className="font-medium text-slate-700">
                    {selectedRide.cancellation ? "Yes" : "No"}
                  </span>
                </div>
              </div>

              {/* Cancellation Details if applicable */}
              {selectedRide.cancellation && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-rose-600" /> Cancellation Record
                  </div>
                  <div className="text-[11px]">
                    <strong>Cancelled By:</strong> {selectedRide.cancellation.cancelledByRole || "Driver"}
                  </div>
                  {selectedRide.cancellation.reason && (
                    <div className="text-[11px]">
                      <strong>Reason:</strong> {selectedRide.cancellation.reason}
                    </div>
                  )}
                </div>
              )}

              {/* Toggle Map Route */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMapInModal(!showMapInModal)}
                  className="w-full gap-1.5 text-xs font-semibold"
                >
                  <MapIcon className="h-3.5 w-3.5 text-emerald-600" />
                  {showMapInModal ? "Hide Route Map" : "View Route on Map"}
                </Button>

                {showMapInModal && (
                  <div className="mt-3 rounded-xl overflow-hidden border border-slate-200">
                    <MapView
                      startLocation={{
                        name: selectedRide.from,
                        address: selectedRide.startLocation?.address || selectedRide.from,
                        latitude: selectedRide.startLocation?.latitude || 12.9249,
                        longitude: selectedRide.startLocation?.longitude || 80.1332,
                      }}
                      destination={{
                        name: selectedRide.to,
                        address: selectedRide.endLocation?.address || selectedRide.to,
                        latitude: selectedRide.endLocation?.latitude || 12.8988,
                        longitude: selectedRide.endLocation?.longitude || 80.2284,
                      }}
                      stops={selectedRide.stopsList.map((s) => ({
                        name: s.name,
                        address: s.address || s.name,
                        latitude: s.latitude || 12.95,
                        longitude: s.longitude || 80.18,
                        price: s.price,
                      }))}
                      distanceText={`${selectedRide.distanceKm} km`}
                      durationText={`${selectedRide.durationMinutes} mins`}
                      height="240px"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        Completed
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        Cancelled
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
        In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
      Scheduled
    </span>
  );
}
