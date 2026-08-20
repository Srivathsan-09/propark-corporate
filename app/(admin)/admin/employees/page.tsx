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
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin Overview
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-purple-600" />
              Corporate Employee & Admin Directory
            </h1>
            {isSuperAdmin ? (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs font-semibold">
                Super Admin Access
              </Badge>
            ) : (
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-semibold">
                Campus Admin ({session?.user?.campusId})
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSuperAdmin
              ? "Super Admin console: Manage all users, allocate Campus Admins, and verify corporate employees across all campuses."
              : "Campus Admin console: Manage and verify corporate commuters inside your assigned physical campus."}
          </p>
        </div>

        {isSuperAdmin && (
          <Link href="/admin/campuses">
            <Button variant="outline" size="sm" className="h-9 text-xs font-semibold rounded-lg gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50">
              <Building2 className="h-4 w-4" /> Manage Campuses & Admins
            </Button>
          </Link>
        )}
      </div>

      {/* Feedback banner */}
      {feedbackMessage && (
        <div
          className={`flex items-center gap-2.5 rounded-lg p-3 text-xs border animate-in fade-in-50 ${
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
          <span className="font-semibold">{feedbackMessage.text}</span>
        </div>
      )}

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-slate-400">Total Users</span>
            <div className="text-xl font-bold text-slate-900">{employees.length}</div>
          </div>
          <Users className="h-5 w-5 text-slate-400" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-purple-700">Super Admins</span>
            <div className="text-xl font-bold text-purple-900">{superAdminCount}</div>
          </div>
          <Crown className="h-5 w-5 text-purple-600" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-blue-700">Campus Admins</span>
            <div className="text-xl font-bold text-blue-900">{campusAdminCount}</div>
          </div>
          <ShieldCheck className="h-5 w-5 text-blue-600" />
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase text-emerald-700">Commuters</span>
            <div className="text-xl font-bold text-emerald-900">{employeeOnlyCount}</div>
          </div>
          <Building className="h-5 w-5 text-emerald-600" />
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-xs"
          >
            <option value="all">🛡️ All Roles</option>
            <option value="admin">👑 Super Admins ({superAdminCount})</option>
            <option value="campus_admin">🏢 Campus Admins ({campusAdminCount})</option>
            <option value="employee">👤 Employees ({employeeOnlyCount})</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-xs"
          >
            <option value="all">All Verification Status</option>
            <option value="pending">⏳ Pending Review</option>
            <option value="approved">✓ Approved</option>
            <option value="rejected">✕ Rejected</option>
          </select>

          {/* Campus Filter (For Super Admin) */}
          {isSuperAdmin && campuses.length > 0 && (
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="h-8.5 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-xs"
            >
              <option value="all">📍 All Campuses</option>
              {campuses.map((c) => (
                <option key={c.campusId} value={c.campusId}>
                  {c.campusId} - {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, ID, email, company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8.5 text-xs"
          />
        </div>
      </div>

      {/* Employees Table */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <CarLoader size="lg" message="Loading employee directory..." />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">
              <Users className="mx-auto h-10 w-10 text-slate-300 mb-2" />
              No records found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-semibold">User / Profile</th>
                    <th className="py-3 px-4 font-semibold">Employee ID</th>
                    <th className="py-3 px-4 font-semibold">Role & Access Tier</th>
                    <th className="py-3 px-4 font-semibold">Campus & Company</th>
                    <th className="py-3 px-4 font-semibold">Vehicles</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-purple-800 font-bold text-xs shrink-0">
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              {emp.name}
                              {emp.role === "admin" && (
                                <span title="Super Admin">
                                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {emp.employeeId}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {emp.role === "admin" ? (
                          <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                            👑 Super Admin
                          </Badge>
                        ) : emp.role === "campus_admin" ? (
                          <div className="space-y-0.5">
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px] font-bold">
                              🏢 Campus Admin
                            </Badge>
                            {emp.campusId && (
                              <div className="font-mono text-[10px] text-blue-600 font-semibold">
                                {emp.campusId}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-slate-600 text-[10px] font-medium">
                            👤 Employee
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-slate-900">{emp.companyName || "—"}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <span className="font-mono font-bold text-purple-700">{emp.campusId || "—"}</span>
                          {emp.campusName && <span>({emp.campusName})</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-slate-700 text-xs">
                          {emp.vehicleCount} {emp.vehicleCount === 1 ? "vehicle" : "vehicles"}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        {emp.verificationStatus === "approved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                            ✓ Approved
                          </Badge>
                        ) : emp.verificationStatus === "rejected" ? (
                          <Badge variant="destructive" className="text-[10px]">
                            ✕ Rejected
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                            ⏳ Pending
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Super Admin Role Control Modal Trigger */}
                          {isSuperAdmin && emp.role !== "admin" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRoleModal(emp)}
                              className="h-7 px-2 text-xs text-purple-700 border-purple-200 hover:bg-purple-50 gap-1"
                              title="Change Role & Access Tier"
                            >
                              <Edit2 className="h-3 w-3" />
                              Role
                            </Button>
                          )}

                          {/* Verification Buttons */}
                          {emp.role !== "admin" && (
                            <>
                              {emp.verificationStatus !== "approved" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleVerify(emp._id, "approve")}
                                  disabled={actionLoadingId === emp._id}
                                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-semibold"
                                >
                                  {actionLoadingId === emp._id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                  Approve
                                </Button>
                              )}
                              {emp.verificationStatus !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleVerify(emp._id, "reject")}
                                  disabled={actionLoadingId === emp._id}
                                  className="h-7 px-2 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs gap-1"
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Reject
                                </Button>
                              )}
                            </>
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

      {/* SUPER ADMIN: ROLE & PRIVILEGES MODAL */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-purple-50/50">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-purple-600" /> Manage Role & Privileges
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update access tier for <strong>{roleModalUser.name}</strong> ({roleModalUser.email})
                </p>
              </div>
              <button
                onClick={() => setRoleModalUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-5 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-slate-700">Select Access Tier</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetRole("campus_admin")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      targetRole === "campus_admin"
                        ? "border-blue-500 bg-blue-50/80 text-blue-900 font-bold ring-2 ring-blue-200"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <ShieldCheck className="h-4 w-4 text-blue-600 mb-1" />
                    <div>Campus Admin</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Manages a designated campus
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetRole("employee")}
                    className={`p-3 rounded-xl border text-left text-xs transition-all ${
                      targetRole === "employee"
                        ? "border-purple-500 bg-purple-50/80 text-purple-900 font-bold ring-2 ring-purple-200"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Users className="h-4 w-4 text-purple-600 mb-1" />
                    <div>Regular Employee</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      Standard commuter profile
                    </div>
                  </button>
                </div>
              </div>

              {targetRole === "campus_admin" && (
                <div className="space-y-1.5 bg-blue-50/60 p-3 rounded-xl border border-blue-100">
                  <Label htmlFor="campusSelect" className="text-xs font-semibold text-blue-900">
                    Assign Physical Campus
                  </Label>
                  <select
                    id="campusSelect"
                    value={targetCampusId}
                    onChange={(e) => setTargetCampusId(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-blue-200 bg-white text-slate-800 font-medium focus:outline-blue-600"
                    required
                  >
                    {campuses.map((c) => (
                      <option key={c.campusId} value={c.campusId}>
                        {c.campusId} — {c.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-500 block">
                    This user will be granted administrator authority for this campus.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRoleModalUser(null)}
                  className="h-8.5 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRole}
                  className="h-8.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5"
                >
                  {isSubmittingRole ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Save Access Tier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
