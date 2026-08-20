"use client";

import React, { useEffect, useState } from "react";
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
  ShieldCheck,
  Shield,
  ShieldAlert,
  Edit2,
  Crown,
  ChevronRight,
  Filter,
  Car,
  Clock,
  UserCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  // Role Management Modal State (Super Admin only)
  const [roleModalUser, setRoleModalUser] = useState<IEmployee | null>(null);
  const [targetRole, setTargetRole] = useState<"employee" | "campus_admin">("campus_admin");
  const [targetCampusId, setTargetCampusId] = useState<string>("");
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Alerts
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      setFeedbackMessage({ type: "error", text: "Failed to load directory." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleVerify = async (employeeId: string, action: "approve" | "reject") => {
    try {
      setActionLoadingId(employeeId);
      setFeedbackMessage(null);
      const res = await fetch(`/api/admin/employees/${employeeId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
        setFeedbackMessage({ type: "success", text: data.message });
      } else {
        setFeedbackMessage({ type: "error", text: data.error || "Failed to update verification." });
      }
    } catch (e) {
      console.error("Failed to verify employee:", e);
      setFeedbackMessage({ type: "error", text: "Network error during verification." });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalUser) return;

    setIsSubmittingRole(true);
    setFeedbackMessage(null);

    try {
      const res = await fetch(`/api/admin/employees/${roleModalUser._id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: targetRole,
          campusId: targetRole === "campus_admin" ? targetCampusId : undefined,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setFeedbackMessage({ type: "success", text: data.message });
        setRoleModalUser(null);
        await fetchEmployees();
      } else {
        setFeedbackMessage({ type: "error", text: data.error || "Failed to update user role." });
      }
    } catch (err) {
      console.error("Role update error:", err);
      setFeedbackMessage({ type: "error", text: "Network error during role update." });
    } finally {
      setIsSubmittingRole(false);
    }
  };

  const openRoleModal = (emp: IEmployee) => {
    setRoleModalUser(emp);
    setTargetRole(emp.role === "campus_admin" ? "campus_admin" : "campus_admin");
    setTargetCampusId(emp.campusId || (campuses[0]?.campusId || ""));
  };

  // Filter Logic
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.companyName && emp.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.campusId && emp.campusId.toLowerCase().includes(searchTerm.toLowerCase()));

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

  const superAdminCount = employees.filter((e) => e.role === "admin").length;
  const campusAdminCount = employees.filter((e) => e.role === "campus_admin").length;
  const employeeOnlyCount = employees.filter((e) => e.role === "employee").length;
  const pendingCount = employees.filter((e) => e.verificationStatus === "pending").length;

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading corporate employee directory..." />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 font-semibold transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Users className="h-6 w-6 text-purple-600" />
              Corporate Employee Directory
            </h1>
            {isSuperAdmin ? (
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-0.5">
                Super Admin Access
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-0.5">
                Campus Admin ({session?.user?.campusId})
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? "Super Admin console: Manage all users, allocate Campus Admins, and verify corporate employees."
              : "Campus Admin console: Manage and verify corporate commuters inside your assigned physical campus."}
          </p>
        </div>

        {isSuperAdmin && (
          <Link href="/admin/campuses">
            <Button variant="outline" size="default" className="h-10 px-5 text-sm font-semibold rounded-xl gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 shadow-xs">
              <Building2 className="h-4 w-4" /> Manage Campuses
            </Button>
          </Link>
        )}
      </div>

      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm border animate-in fade-in-50 ${
            feedbackMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {feedbackMessage.type === "success" ? (
            <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <X className="h-4 w-4 shrink-0 text-rose-600" />
          )}
          <span className="font-medium">{feedbackMessage.text}</span>
        </div>
      )}

      {/* Metrics Widgets - Compact */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Commuters</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{employees.length}</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Pending Review</span>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{pendingCount}</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">Campus Admins</span>
            <div className="text-xl font-bold text-blue-900 mt-0.5">{campusAdminCount}</div>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Crown className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Physical Campuses</span>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{campuses.length}</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Building className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600"
          >
            <option value="all">All Roles</option>
            <option value="admin">Super Admins ({superAdminCount})</option>
            <option value="campus_admin">Campus Admins ({campusAdminCount})</option>
            <option value="employee">Employees ({employeeOnlyCount})</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          {/* Campus Filter (For Super Admin) */}
          {isSuperAdmin && campuses.length > 0 && (
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600"
            >
              <option value="all">All Campuses</option>
              {campuses.map((c) => (
                <option key={c.campusId} value={c.campusId}>
                  {c.campusId} - {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search by name, ID, email, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center">
            <CarLoader size="lg" message="Loading employee directory..." />
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <Users className="mx-auto h-8 w-8 text-slate-300 mb-1.5" />
            No records found matching your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: "680px" }}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 px-3 font-semibold w-[220px]">Employee</th>
                  <th className="py-2 px-3 font-semibold w-[100px]">ID</th>
                  <th className="py-2 px-3 font-semibold w-[110px]">Role</th>
                  <th className="py-2 px-3 font-semibold w-[150px]">Company & Campus</th>
                  <th className="py-2 px-3 font-semibold w-[80px]">Fleet</th>
                  <th className="py-2 px-3 font-semibold w-[90px]">Status</th>
                  <th className="py-2 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee Info - Name + Email, constrained */}
                    <td className="py-2 px-3 max-w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] shrink-0">
                          {getInitials(emp.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 flex items-center gap-1 truncate">
                            <span className="truncate">{emp.name}</span>
                            {emp.role === "admin" && (
                              <Crown className="h-3 w-3 text-purple-600 shrink-0" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">{emp.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="py-2 px-3">
                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                        {emp.employeeId}
                      </span>
                    </td>

                    {/* Role & Access Tier */}
                    <td className="py-2 px-3">
                      {emp.role === "admin" ? (
                        <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] font-semibold py-0 px-1.5 gap-1">
                          <Crown className="h-2.5 w-2.5" /> Super Admin
                        </Badge>
                      ) : emp.role === "campus_admin" ? (
                        <div className="space-y-0.5">
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-semibold py-0 px-1.5 gap-1">
                            <Building2 className="h-2.5 w-2.5" /> Campus Admin
                          </Badge>
                          {emp.campusId && (
                            <div className="font-mono text-[9px] text-blue-600 font-semibold">
                              {emp.campusId}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-slate-600 text-[9px] font-medium py-0 px-1.5 gap-1">
                          <Users className="h-2.5 w-2.5" /> Employee
                        </Badge>
                      )}
                    </td>

                    {/* Company & Physical Campus */}
                    <td className="py-2 px-3 max-w-[150px]">
                      <div className="font-semibold text-slate-900 text-[11px] truncate">{emp.companyName || "—"}</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        <span className="font-mono font-bold text-purple-700">{emp.campusId || "—"}</span>
                        {emp.campusName && <span className="text-slate-400 ml-0.5 truncate"> {emp.campusName}</span>}
                      </div>
                    </td>

                    {/* Vehicles */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                        <Car className="h-3 w-3 text-slate-400" />
                        {emp.vehicleCount} {emp.vehicleCount === 1 ? "vehicle" : "vehicles"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3 whitespace-nowrap">
                      {emp.verificationStatus === "approved" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Check className="h-3 w-3" /> Approved
                        </span>
                      ) : emp.verificationStatus === "rejected" ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <X className="h-3 w-3" /> Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="h-3 w-3" /> Pending
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {/* Super Admin Role Management */}
                        {isSuperAdmin && emp.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => openRoleModal(emp)}
                            className="h-7 px-2 text-[11px] font-semibold border border-purple-200 text-purple-700 hover:bg-purple-50 rounded flex items-center gap-1 transition-colors"
                          >
                            <Edit2 className="h-3 w-3" /> Role
                          </button>
                        )}

                        {/* Approve */}
                        {emp.verificationStatus !== "approved" && (
                          <button
                            type="button"
                            onClick={() => handleVerify(emp._id, "approve")}
                            disabled={actionLoadingId === emp._id}
                            className="h-7 px-2 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded flex items-center gap-1 transition-colors disabled:opacity-60"
                          >
                            {actionLoadingId === emp._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                            Approve
                          </button>
                        )}

                        {/* Reject */}
                        {emp.verificationStatus !== "rejected" && emp.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => handleVerify(emp._id, "reject")}
                            disabled={actionLoadingId === emp._id}
                            className="h-7 px-2 text-[11px] font-semibold border border-rose-200 text-rose-700 hover:bg-rose-50 rounded flex items-center gap-1 transition-colors disabled:opacity-60"
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SUPER ADMIN ROLE & PRIVILEGES MODAL */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Manage Role & Access Tier</h2>
                  <p className="text-xs text-slate-500">{roleModalUser.name} ({roleModalUser.email})</p>
                </div>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Select Access Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTargetRole("campus_admin")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      targetRole === "campus_admin"
                        ? "border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      Campus Admin
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Manages a specific physical campus and verifies its commuters.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetRole("employee")}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      targetRole === "employee"
                        ? "border-purple-600 bg-purple-50 text-purple-900 ring-2 ring-purple-600"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Users className="h-4 w-4 text-slate-600" />
                      Regular Employee
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Standard commuter privileges with no administrator rights.
                    </p>
                  </button>
                </div>
              </div>

              {targetRole === "campus_admin" && (
                <div className="space-y-2 animate-in fade-in-50">
                  <Label className="text-xs font-semibold text-slate-700">Assign Physical Campus</Label>
                  <select
                    value={targetCampusId}
                    onChange={(e) => setTargetCampusId(e.target.value)}
                    required
                    className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-800 font-medium focus:outline-purple-600"
                  >
                    {campuses.map((c) => (
                      <option key={c.campusId} value={c.campusId}>
                        {c.campusId} — {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400">
                    This user will become the designated administrator for this physical campus.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setRoleModalUser(null)}
                  className="h-10 px-5 text-sm font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRole}
                  size="default"
                  className="h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold gap-2 rounded-xl shadow-sm"
                >
                  {isSubmittingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Update Role
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
