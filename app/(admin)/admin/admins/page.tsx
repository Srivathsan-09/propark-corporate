"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Search,
  Building2,
  Mail,
  UserCheck,
  UserX,
  Edit2,
  Plus,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Send,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CarLoader } from "@/components/common/CarLoader";

interface CampusAdminItem {
  campusId: string;
  name: string;
  city: string;
  state: string;
  adminEmail?: string;
  companiesCount: number;
}

export default function CampusAdminsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";

  const [campuses, setCampuses] = useState<CampusAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // OTP Assignment Modal State
  const [assignAdminCampus, setAssignAdminCampus] = useState<CampusAdminItem | null>(null);
  const [assignAdminEmail, setAssignAdminEmail] = useState("");
  const [assignOtpStep, setAssignOtpStep] = useState<"email" | "otp">("email");
  const [assignOtpCode, setAssignOtpCode] = useState("");
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Revoke Modal State
  const [revokeTarget, setRevokeTarget] = useState<CampusAdminItem | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Feedback Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCampuses = async () => {
    try {
      const res = await fetch("/api/admin/campuses");
      if (res.ok) {
        const data = await res.json();
        const items = (data.campuses || []).map((c: any) => ({
          campusId: c.campusId,
          name: c.name,
          city: c.city,
          state: c.state,
          adminEmail: c.adminEmail,
          companiesCount: (c.companies || []).length,
        }));
        setCampuses(items);
      }
    } catch (err) {
      console.error("Failed to load campus admins:", err);
      setErrorMessage("Failed to load campus administrators.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAdminCampus || !assignAdminEmail.trim()) return;

    setIsSendingOtp(true);
    setModalError(null);
    setOtpDevCode(null);

    try {
      const res = await fetch(`/api/admin/campuses/${assignAdminCampus.campusId}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: assignAdminEmail.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setAssignOtpStep("otp");
        if (data.devOtp) setOtpDevCode(data.devOtp);
      } else {
        setModalError(data.error || "Failed to send verification code.");
      }
    } catch (err) {
      setModalError("Network error while dispatching OTP.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAdminCampus || !assignOtpCode.trim()) return;

    setIsVerifyingOtp(true);
    setModalError(null);

    try {
      const res = await fetch(`/api/admin/campuses/${assignAdminCampus.campusId}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: assignAdminEmail.trim().toLowerCase(),
          otp: assignOtpCode.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Successfully allocated "${assignAdminEmail}" as Campus Admin for ${assignAdminCampus.name}!`);
        setAssignAdminCampus(null);
        setAssignOtpStep("email");
        setAssignAdminEmail("");
        setAssignOtpCode("");
        setOtpDevCode(null);
        await fetchCampuses();
      } else {
        setModalError(data.error || "Invalid or expired OTP code.");
      }
    } catch (err) {
      setModalError("Network error while verifying OTP.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleRevokeAdmin = async () => {
    if (!revokeTarget) return;

    setIsRevoking(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${revokeTarget.campusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assign_admin", adminEmail: "" }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Revoked Campus Administrator privileges for ${revokeTarget.name}.`);
        setRevokeTarget(null);
        await fetchCampuses();
      } else {
        setErrorMessage(data.error || "Failed to revoke admin privileges.");
      }
    } catch (err) {
      setErrorMessage("Network error while revoking administrator.");
    } finally {
      setIsRevoking(false);
    }
  };

  const totalCampuses = campuses.length;
  const assignedCount = campuses.filter((c) => Boolean(c.adminEmail)).length;
  const unassignedCount = totalCampuses - assignedCount;

  const filtered = campuses.filter((c) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      c.campusId.toLowerCase().includes(term) ||
      c.name.toLowerCase().includes(term) ||
      c.city.toLowerCase().includes(term) ||
      (c.adminEmail && c.adminEmail.toLowerCase().includes(term));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "assigned" && Boolean(c.adminEmail)) ||
      (statusFilter === "unassigned" && !c.adminEmail);

    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading Campus Administrators Directory..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 font-semibold transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <div className="flex items-center gap-2.5 mt-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Campus Administrators
            </h1>
            <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5">
              Super Admin
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign and manage administrators for each physical campus location.
          </p>
        </div>

        <Link href="/admin/campuses">
          <Button variant="outline" size="sm" className="h-8 text-xs px-3 border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 rounded-lg font-semibold">
            <Building2 className="h-3.5 w-3.5 text-slate-500" /> Manage Campuses
          </Button>
        </Link>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-50 px-3.5 py-2 text-xs text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Physical Campuses</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCampuses}</div>
          </div>
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <Building2 className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Active Campus Admins</span>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{assignedCount}</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Unassigned Campuses</span>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{unassignedCount}</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <AlertCircle className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-auto inline-flex items-center justify-start gap-1.5 px-2.5 text-xs font-semibold rounded-lg border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 transition-all cursor-pointer">
              <SelectValue placeholder="All Campuses" />
            </SelectTrigger>
            <SelectContent className="min-w-[190px] rounded-xl border-slate-200 shadow-lg bg-white p-1">
              <SelectItem value="all" className="text-xs font-medium cursor-pointer">All Campuses ({campuses.length})</SelectItem>
              <SelectItem value="assigned" className="text-xs font-medium cursor-pointer">Assigned Admins ({assignedCount})</SelectItem>
              <SelectItem value="unassigned" className="text-xs font-medium cursor-pointer">Pending Allocation ({unassignedCount})</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search campus code, name, admin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Campus Admins Table */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-6 bg-slate-50/80 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-purple-600" />
            Campus Administrators Directory ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 pl-6 pr-4 font-bold w-36">Campus Code</th>
                  <th className="py-3.5 px-4 font-bold">Campus Name</th>
                  <th className="py-3.5 px-4 font-bold">Location</th>
                  <th className="py-3.5 px-4 font-bold">Designated Campus Admin</th>
                  <th className="py-3.5 px-4 font-bold">Governance Status</th>
                  <th className="py-3.5 pl-4 pr-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      No physical campuses found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((campus) => (
                    <tr key={campus.campusId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200 tracking-wide inline-block">
                          {campus.campusId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 text-xs whitespace-nowrap">
                        {campus.name}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                        {campus.city}, {campus.state}
                      </td>
                      <td className="py-3.5 px-4">
                        {campus.adminEmail ? (
                          <div className="flex items-center gap-1.5 text-slate-900 font-medium text-xs">
                            <Mail className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            <span className="truncate max-w-[200px]">{campus.adminEmail}</span>
                          </div>
                        ) : (
                          <span className="italic text-slate-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {campus.adminEmail ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0.5 px-2">
                            Active Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200 text-[10px] py-0.5 px-2 font-medium">
                            Pending Assignment
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setAssignAdminCampus(campus);
                              setAssignAdminEmail(campus.adminEmail || "");
                              setAssignOtpStep("email");
                              setAssignOtpCode("");
                              setModalError(null);
                              setOtpDevCode(null);
                            }}
                            className="h-7 text-xs px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 gap-1 rounded-lg font-semibold shadow-2xs"
                          >
                            <Edit2 className="h-3 w-3" />
                            {campus.adminEmail ? "Reassign" : "Assign Admin"}
                          </Button>
                          {campus.adminEmail && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setRevokeTarget(campus)}
                              className="h-7 text-xs px-2.5 border-rose-200 text-rose-700 hover:bg-rose-50 gap-1 rounded-lg font-semibold"
                            >
                              <UserX className="h-3 w-3" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* OTP ASSIGNMENT MODAL */}
      {assignAdminCampus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {assignOtpStep === "email" ? "Assign Campus Administrator" : "Security OTP Verification"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {assignAdminCampus.name} ({assignAdminCampus.campusId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAssignAdminCampus(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800 border border-rose-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{modalError}</span>
              </div>
            )}

            {otpDevCode && (
              <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Verification Passcode</span>
                  <strong className="font-mono text-sm tracking-widest">{otpDevCode}</strong>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setAssignOtpCode(otpDevCode)}
                  className="h-7 text-xs bg-amber-100 border-amber-300 text-amber-900"
                >
                  Auto-fill Code
                </Button>
              </div>
            )}

            {assignOtpStep === "email" ? (
              <form onSubmit={handleSendOtp} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Administrator Corporate Email</Label>
                  <Input
                    required
                    type="email"
                    value={assignAdminEmail}
                    onChange={(e) => setAssignAdminEmail(e.target.value)}
                    placeholder="e.g. administrator@company.com"
                    className="h-9 text-xs rounded-lg"
                  />
                  <p className="text-[11px] text-slate-400">
                    A 6-digit one-time authorization code will be dispatched to this email address.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignAdminCampus(null)}
                    className="h-8 px-4 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSendingOtp || !assignAdminEmail.trim()}
                    size="sm"
                    className="h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                  >
                    {isSendingOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                    Send Verification Code
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3 text-xs">
                <div className="space-y-1 text-center py-2">
                  <span className="text-xs text-slate-600 block">Verification code sent to:</span>
                  <strong className="text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                    {assignAdminEmail}
                  </strong>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 block text-center">6-Digit Security OTP</Label>
                  <Input
                    required
                    maxLength={6}
                    value={assignOtpCode}
                    onChange={(e) => setAssignOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="h-10 text-center font-mono text-lg tracking-widest rounded-lg font-bold border-2 focus:border-purple-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setAssignOtpStep("email")}
                    className="text-xs text-slate-500 hover:text-purple-600"
                  >
                    ← Change Email
                  </button>
                  <button
                    type="button"
                    disabled={isSendingOtp}
                    onClick={handleSendOtp}
                    className="text-xs text-purple-600 font-semibold hover:underline"
                  >
                    Resend Code
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignAdminCampus(null)}
                    className="h-8 px-4 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifyingOtp || assignOtpCode.length < 6}
                    size="sm"
                    className="h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                  >
                    {isVerifyingOtp ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    Verify & Assign Admin
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* REVOKE CONFIRMATION MODAL */}
      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3 animate-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <ShieldAlert className="h-4 w-4" />
              Revoke Campus Administrator?
            </div>
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to revoke campus admin privileges for <strong>&quot;{revokeTarget.name}&quot;</strong> ({revokeTarget.campusId})?
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRevokeTarget(null)}
                className="h-8 px-3 rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isRevoking}
                onClick={handleRevokeAdmin}
                size="sm"
                className="h-8 px-3 bg-rose-600 hover:bg-rose-700 text-white rounded-lg gap-1 font-semibold"
              >
                {isRevoking ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                Revoke Privileges
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
