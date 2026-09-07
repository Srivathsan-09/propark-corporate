"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Users,
  Search,
  Check,
  X,
  Loader2,
  ArrowLeft,
  Building2,
  Building,
  Crown,
  Car,
  Clock,
  ShieldCheck,
  MapPin,
  ChevronRight,
  MoreHorizontal,
  AlertCircle,
  RefreshCw,
  FilterX,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CarLoader } from "@/components/common/CarLoader";
import { getInitials } from "@/lib/utils";

interface IEmployee {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  companyName?: string;
  campusId?: string;
  campusName?: string;
  role: "employee" | "admin" | "campus_admin";
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
  profileImage?: string;
  homeLocation?: string;
  vehicleCount: number;
  createdAt: string;
}

interface ICampus {
  campusId: string;
  name: string;
}

export default function AdminEmployeesPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [campuses, setCampuses] = useState<ICampus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Reject confirmation dialog
  const [rejectDialogEmployee, setRejectDialogEmployee] = useState<IEmployee | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Feedback banner
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchEmployees = async () => {
    try {
      const [empRes, campusRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/campuses"),
      ]);

      if (empRes.ok) {
        const data = await empRes.json();
        setEmployees(data.employees || []);
      }

      if (campusRes.ok) {
        const campusData = await campusRes.json();
        setCampuses(campusData.campuses || []);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
      setFeedbackMessage({ type: "error", text: "Failed to load directory data." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleVerify = async (
    employeeId: string,
    action: "approve" | "reject",
    reason?: string
  ) => {
    try {
      setActionLoadingId(employeeId);
      setFeedbackMessage(null);

      const res = await fetch(`/api/admin/employees/${employeeId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason: reason || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmployees((prev) =>
          prev.map((emp) =>
            emp._id === employeeId
              ? {
                  ...emp,
                  verificationStatus: action === "approve" ? "approved" : "rejected",
                  isApproved: action === "approve",
                }
              : emp
          )
        );
        setFeedbackMessage({
          type: "success",
          text:
            data.message ||
            (action === "approve"
              ? "Employee verified and approved successfully."
              : "Employee verification status set to rejected."),
        });
      } else {
        setFeedbackMessage({
          type: "error",
          text: data.error || "Failed to update verification.",
        });
      }
    } catch (e) {
      console.error("Failed to verify employee:", e);
      setFeedbackMessage({ type: "error", text: "Network error during verification." });
    } finally {
      setActionLoadingId(null);
      setRejectDialogEmployee(null);
      setRejectionReason("");
    }
  };

  // Filter Logic
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const searchLower = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !searchLower ||
        emp.name.toLowerCase().includes(searchLower) ||
        emp.email.toLowerCase().includes(searchLower) ||
        emp.employeeId.toLowerCase().includes(searchLower) ||
        (emp.department && emp.department.toLowerCase().includes(searchLower)) ||
        (emp.companyName && emp.companyName.toLowerCase().includes(searchLower)) ||
        (emp.campusId && emp.campusId.toLowerCase().includes(searchLower)) ||
        (emp.campusName && emp.campusName.toLowerCase().includes(searchLower));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "approved" && emp.verificationStatus === "approved") ||
        (statusFilter === "pending" && emp.verificationStatus === "pending") ||
        (statusFilter === "rejected" && emp.verificationStatus === "rejected");

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "admin" && emp.role === "admin") ||
        (roleFilter === "campus_admin" && emp.role === "campus_admin") ||
        (roleFilter === "employee" && emp.role === "employee");

      const matchesCampus =
        campusFilter === "all" || emp.campusId === campusFilter;

      return matchesSearch && matchesStatus && matchesRole && matchesCampus;
    });
  }, [employees, searchTerm, statusFilter, roleFilter, campusFilter]);

  const hasActiveFilters =
    searchTerm !== "" ||
    statusFilter !== "all" ||
    roleFilter !== "all" ||
    campusFilter !== "all";

  const resetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setRoleFilter("all");
    setCampusFilter("all");
  };

  const superAdminCount = employees.filter((e) => e.role === "admin").length;
  const campusAdminCount = employees.filter((e) => e.role === "campus_admin").length;
  const employeeOnlyCount = employees.filter((e) => e.role === "employee").length;
  const pendingCount = employees.filter((e) => e.verificationStatus === "pending").length;

  if (isLoading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <CarLoader size="page" message="Loading employee directory..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs text-slate-500 hover:text-purple-600 inline-flex items-center gap-1 font-semibold transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Users className="h-6 w-6 text-purple-600" />
              Employee Directory
            </h1>
            {isSuperAdmin ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
                <Crown className="h-3 w-3 text-purple-600" />
                Super Admin Portal
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                <Building2 className="h-3 w-3 text-blue-600" />
                Campus Admin ({session?.user?.campusId})
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {isSuperAdmin
              ? "Oversee corporate commuter profiles, vehicle registrations, and verification workflows across all campuses."
              : `Managing corporate employees and verification requests for ${session?.user?.campusId || "your designated campus"}.`}
          </p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/admin/campuses">
              <button className="h-9 px-3.5 text-xs font-semibold rounded-xl gap-2 border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 flex items-center transition-all shadow-2xs">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                Manage Campuses
              </button>
            </Link>
          </div>
        )}
      </div>

      {/* Feedback Banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center justify-between rounded-xl px-4 py-3 text-xs sm:text-sm border animate-in fade-in-50 transition-all ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50/90 text-emerald-800 border-emerald-200"
              : "bg-rose-50/90 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span className="font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Modern KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Total Commuters
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">{employees.length}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Registered accounts</span>
          </div>
          <div className="h-10 w-10 bg-purple-50 border border-purple-100/80 rounded-xl flex items-center justify-center text-purple-600">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">
              Pending Review
            </span>
            <div className="text-xl font-bold text-amber-800 mt-1">{pendingCount}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              {pendingCount > 0 ? "Requires admin action" : "Queue caught up"}
            </span>
          </div>
          <div className="h-10 w-10 bg-amber-50 border border-amber-100/80 rounded-xl flex items-center justify-center text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
              Campus Admins
            </span>
            <div className="text-xl font-bold text-blue-900 mt-1">{campusAdminCount}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Campus coordinators</span>
          </div>
          <div className="h-10 w-10 bg-blue-50 border border-blue-100/80 rounded-xl flex items-center justify-center text-blue-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
              Physical Campuses
            </span>
            <div className="text-xl font-bold text-emerald-900 mt-1">{campuses.length}</div>
            <span className="text-[10px] text-slate-500 mt-0.5 block">Active facilities</span>
          </div>
          <div className="h-10 w-10 bg-emerald-50 border border-emerald-100/80 rounded-xl flex items-center justify-center text-emerald-600">
            <Building className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[130px] inline-flex items-center justify-start gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent className="min-w-[170px] rounded-xl border-slate-200 shadow-lg bg-white p-1">
              <SelectItem value="all" className="text-xs font-medium cursor-pointer">
                All Roles ({employees.length})
              </SelectItem>
              <SelectItem value="employee" className="text-xs font-medium cursor-pointer">
                Employees ({employeeOnlyCount})
              </SelectItem>
              <SelectItem value="campus_admin" className="text-xs font-medium cursor-pointer">
                Campus Admins ({campusAdminCount})
              </SelectItem>
              <SelectItem value="admin" className="text-xs font-medium cursor-pointer">
                Super Admins ({superAdminCount})
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-auto min-w-[135px] inline-flex items-center justify-start gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="min-w-[160px] rounded-xl border-slate-200 shadow-lg bg-white p-1">
              <SelectItem value="all" className="text-xs font-medium cursor-pointer">
                All Statuses
              </SelectItem>
              <SelectItem value="approved" className="text-xs font-medium cursor-pointer">
                Approved
              </SelectItem>
              <SelectItem value="pending" className="text-xs font-medium cursor-pointer">
                Pending Review ({pendingCount})
              </SelectItem>
              <SelectItem value="rejected" className="text-xs font-medium cursor-pointer">
                Rejected
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Campus Filter (For Super Admin) */}
          {isSuperAdmin && campuses.length > 0 && (
            <Select value={campusFilter} onValueChange={setCampusFilter}>
              <SelectTrigger className="h-9 w-auto max-w-[220px] inline-flex items-center justify-start gap-1.5 px-3 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 shadow-2xs">
                <SelectValue placeholder="All Campuses" />
              </SelectTrigger>
              <SelectContent className="min-w-[220px] max-h-60 rounded-xl border-slate-200 shadow-lg bg-white p-1">
                <SelectItem value="all" className="text-xs font-medium cursor-pointer">
                  All Campuses
                </SelectItem>
                {campuses.map((c) => (
                  <SelectItem key={c.campusId} value={c.campusId} className="text-xs font-medium cursor-pointer">
                    {c.campusId} — {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <FilterX className="h-3.5 w-3.5" />
              Clear filters
            </button>
          )}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            placeholder="Search name, ID, email, company, campus..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-8 h-9 text-xs rounded-xl border-slate-200 focus:border-purple-500 focus:ring-purple-500/20 shadow-2xs"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Employee Results Table */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Subheader / Count Bar */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium">
            Showing <strong className="text-slate-800">{filteredEmployees.length}</strong> of{" "}
            <strong className="text-slate-800">{employees.length}</strong> total employees
          </span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-full text-[11px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              {pendingCount} pending verification
            </span>
          )}
        </div>

        {filteredEmployees.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">No employees match your criteria</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Try adjusting your search keywords, role filters, or campus selection.
            </p>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
              >
                <RefreshCw className="h-3 w-3" /> Reset all filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: "850px" }}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold tracking-wider text-slate-500 uppercase select-none">
                  <th className="py-3.5 pl-6 pr-4 font-semibold">Employee</th>
                  <th className="py-3.5 px-4 font-semibold">ID</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Organization & Campus</th>
                  <th className="py-3.5 px-4 font-semibold">Fleet</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 pl-4 pr-6 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => {
                  const isAdmin = emp.role === "admin" || emp.role === "campus_admin";
                  const isPending = emp.verificationStatus === "pending";
                  const isApproved = emp.verificationStatus === "approved";
                  const isRejected = emp.verificationStatus === "rejected";

                  return (
                    <tr
                      key={emp._id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* 1. Employee: Avatar + Name + Department/Email */}
                      <td className="py-3.5 pl-6 pr-4 max-w-[260px]">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-800 font-bold text-xs shrink-0 overflow-hidden border border-purple-200/60 shadow-2xs">
                            {emp.profileImage ? (
                              <img
                                src={emp.profileImage}
                                alt={emp.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              getInitials(emp.name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/admin/employees/${emp._id}`}
                              className="font-semibold text-slate-900 hover:text-purple-600 transition-colors truncate block text-xs sm:text-sm"
                              title={emp.name}
                            >
                              {emp.name}
                            </Link>
                            <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                              {emp.department && (
                                <>
                                  <span className="font-medium text-slate-600 truncate max-w-[110px]">
                                    {emp.department}
                                  </span>
                                  <span className="text-slate-300">•</span>
                                </>
                              )}
                              <span className="truncate text-slate-400" title={emp.email}>
                                {emp.email}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Employee ID: Clean Monospace */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/70">
                          {emp.employeeId}
                        </span>
                      </td>

                      {/* 3. Role: Sleek badge with clear visual differentiation */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {emp.role === "admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/80">
                            <Crown className="h-3 w-3 text-purple-600" />
                            Super Admin
                          </span>
                        ) : emp.role === "campus_admin" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                            <Building2 className="h-3 w-3 text-blue-600" />
                            Campus Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Employee
                          </span>
                        )}
                      </td>

                      {/* 4. Company & Campus: Clean text layout (no ugly clipped badges) */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        {emp.role === "admin" ? (
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">
                              Platform Headquarters
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              All Campuses & Corridors
                            </div>
                          </div>
                        ) : emp.role === "campus_admin" ? (
                          <div>
                            <div className="font-semibold text-slate-800 text-xs">
                              {emp.companyName || "Campus Management"}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                              <span className="truncate">
                                {emp.campusName || emp.campusId || "Assigned Campus"}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-800 text-xs truncate">
                              {emp.companyName || "Corporate Partner"}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {emp.campusName
                                  ? `${emp.campusName} (${emp.campusId || "Main"})`
                                  : emp.campusId || "Main Campus"}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* 5. Fleet / Vehicles: Clean icon + count */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {emp.vehicleCount > 0 ? (
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                            <Car className="h-3.5 w-3.5 text-purple-600" />
                            <span>
                              {emp.vehicleCount}{" "}
                              <span className="text-[11px] font-normal text-slate-500">
                                {emp.vehicleCount === 1 ? "vehicle" : "vehicles"}
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
                            <Car className="h-3.5 w-3.5 text-slate-300" />
                            <span>None</span>
                          </div>
                        )}
                      </td>

                      {/* 6. Status: Modern dot indicator without redundancy */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {isAdmin ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 bg-purple-50/60 px-2.5 py-0.5 rounded-full border border-purple-200/50">
                            <span className="h-1.5 w-1.5 rounded-full bg-purple-600" />
                            Active Admin
                          </span>
                        ) : isApproved ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50/60 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Approved
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/80">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 bg-rose-50/60 px-2.5 py-0.5 rounded-full border border-rose-200/60">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Rejected
                          </span>
                        )}
                      </td>

                      {/* 7. Actions: Balanced, contextual, elegant */}
                      <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* Pending Fast-Action: Approve or Reject */}
                          {!isAdmin && isPending && (
                            <div className="flex items-center gap-1.5 mr-1">
                              <button
                                type="button"
                                onClick={() => handleVerify(emp._id, "approve")}
                                disabled={actionLoadingId === emp._id}
                                className="h-7 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 transition-all shadow-2xs disabled:opacity-50"
                                title="Approve Employee"
                              >
                                {actionLoadingId === emp._id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectDialogEmployee(emp)}
                                disabled={actionLoadingId === emp._id}
                                className="h-7 px-2 text-xs font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1 transition-all disabled:opacity-50"
                                title="Reject Employee"
                              >
                                <X className="h-3 w-3" />
                                Reject
                              </button>
                            </div>
                          )}

                          {/* Primary Action: View Details */}
                          <Link
                            href={`/admin/employees/${emp._id}`}
                            className="h-7 px-2.5 text-xs font-semibold border border-slate-200 text-slate-700 hover:text-purple-700 hover:border-purple-300 hover:bg-purple-50/40 rounded-lg inline-flex items-center gap-1 transition-all shadow-2xs"
                            title="View Complete Commute History & Activity Audit"
                          >
                            <span>View Details</span>
                            <ChevronRight className="h-3 w-3 text-slate-400 group-hover:text-purple-600 transition-colors" />
                          </Link>

                          {/* Secondary contextual menu (for non-admin employees) */}
                          {!isAdmin && !isPending && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  className="h-7 w-7 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors shadow-2xs"
                                  title="More options"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem asChild>
                                  <Link
                                    href={`/admin/employees/${emp._id}`}
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="h-3.5 w-3.5 text-slate-500" />
                                    <span>View Audit History</span>
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {isApproved ? (
                                  <DropdownMenuItem
                                    onClick={() => setRejectDialogEmployee(emp)}
                                    className="text-rose-600 focus:text-rose-700 focus:bg-rose-50"
                                  >
                                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                    <span>Revoke / Reject</span>
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => handleVerify(emp._id, "approve")}
                                    className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Re-approve</span>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Rejecting Employee */}
      <Dialog
        open={rejectDialogEmployee !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectDialogEmployee(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <AlertCircle className="h-5 w-5" />
              Reject Employee Verification
            </DialogTitle>
            <DialogDescription className="pt-2 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reject verification for{" "}
              <strong className="text-slate-900">{rejectDialogEmployee?.name}</strong> (
              {rejectDialogEmployee?.employeeId})? This employee will not be eligible to post or book
              rides on CommuteX until their credentials are reviewed and re-approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-slate-700 block">
              Reason for rejection (Optional):
            </label>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Incomplete company credentials, invalid employee ID..."
              className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-rose-400 focus:ring-1 focus:ring-rose-400 outline-none resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => {
                setRejectDialogEmployee(null);
                setRejectionReason("");
              }}
              className="h-9 px-4 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionLoadingId !== null}
              onClick={() => {
                if (rejectDialogEmployee) {
                  handleVerify(
                    rejectDialogEmployee._id,
                    "reject",
                    rejectionReason.trim()
                  );
                }
              }}
              className="h-9 px-4 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {actionLoadingId !== null && <Loader2 className="h-3 w-3 animate-spin" />}
              Confirm Rejection
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
