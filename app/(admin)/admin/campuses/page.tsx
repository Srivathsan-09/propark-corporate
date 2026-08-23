"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Building2,
  Plus,
  MapPin,
  Users,
  Search,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Briefcase,
  X,
  ShieldCheck,
  Clock,
  Check,
  ChevronRight,
  Mail,
  Edit2,
  Crown,
  UserX,
  Building,
  AlertTriangle,
  KeyRound,
  Send,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarLoader } from "@/components/common/CarLoader";

interface IPendingCompany {
  name: string;
  requestedBy: string;
  requestedAt: string;
}

interface ICampus {
  _id: string;
  campusId: string;
  name: string;
  address: string;
  city: string;
  state: string;
  adminEmail?: string;
  companies: string[];
  pendingCompanies?: IPendingCompany[];
  status: "active" | "inactive";
  employeeCount?: number;
  companiesCount?: number;
  pendingCount?: number;
}

export default function AdminCampusesPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const [campuses, setCampuses] = useState<ICampus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"campuses" | "admins">("campuses");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");

  // Modal State for Adding Campus (Super Admin only)
  const [isAddCampusOpen, setIsAddCampusOpen] = useState(false);
  const [newCampus, setNewCampus] = useState({
    campusId: "",
    name: "",
    address: "",
    city: "",
    state: "",
    adminEmail: "",
    companiesInput: "",
  });
  const [isSubmittingCampus, setIsSubmittingCampus] = useState(false);

  // Modal State for Assigning Campus Admin (Super Admin only - 2FA OTP)
  const [assignAdminCampus, setAssignAdminCampus] = useState<ICampus | null>(null);
  const [assignAdminEmail, setAssignAdminEmail] = useState("");
  const [assignOtpStep, setAssignOtpStep] = useState<"email" | "otp">("email");
  const [assignOtpCode, setAssignOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Inline Company Add / Request State per campus
  const [companyInputs, setCompanyInputs] = useState<Record<string, string>>({});
  const [companyActionLoadingId, setCompanyActionLoadingId] = useState<string | null>(null);

  // Confirmation Modal State (Custom dialog box)
  const [confirmModal, setConfirmModal] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    variant?: "destructive" | "primary";
    onConfirm: () => Promise<void> | void;
    isLoading?: boolean;
  } | null>(null);

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchCampuses = async () => {
    try {
      const res = await fetch("/api/admin/campuses");
      if (res.ok) {
        const data = await res.json();
        setCampuses(data.campuses || []);
      }
    } catch (err) {
      console.error("Failed to load campuses:", err);
      setErrorMessage("Failed to load campus directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCampuses();
  }, []);

  const handleCreateCampus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newCampus.campusId || !newCampus.name || !newCampus.city || !newCampus.state) {
      setErrorMessage("Please fill in Campus ID, Name, City, and State.");
      return;
    }

    setIsSubmittingCampus(true);

    try {
      const companiesArray = newCampus.companiesInput
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const res = await fetch("/api/admin/campuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campusId: newCampus.campusId.trim().toUpperCase(),
          name: newCampus.name.trim(),
          address: newCampus.address.trim(),
          city: newCampus.city.trim(),
          state: newCampus.state.trim(),
          adminEmail: newCampus.adminEmail.trim().toLowerCase(),
          companies: companiesArray,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create campus.");
        setIsSubmittingCampus(false);
        return;
      }

      setSuccessMessage(data.message || "Campus created successfully!");
      setIsAddCampusOpen(false);
      await fetchCampuses();
    } catch (err) {
      console.error("Error creating campus:", err);
      setErrorMessage("Failed to create campus. Check network connection.");
    } finally {
      setIsSubmittingCampus(false);
    }
  };

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

      if (res.ok) {
        setAssignOtpStep("otp");
        setResendCooldown(30);
        if (data.devOtp) {
          setOtpDevCode(data.devOtp);
        }
      } else {
        setModalError(data.error || "Failed to send verification code.");
      }
    } catch (err) {
      console.error("Send OTP error:", err);
      setModalError("Network error while dispatching verification code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignAdminCampus || !assignAdminEmail.trim() || !assignOtpCode.trim()) return;

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

      if (res.ok) {
        setCampuses((prev) =>
          prev.map((c) =>
            c.campusId === assignAdminCampus.campusId
              ? { ...c, adminEmail: assignAdminEmail.trim().toLowerCase() }
              : c
          )
        );
        setSuccessMessage(data.message || `Verified & Assigned "${assignAdminEmail}" as Campus Admin!`);
        setAssignAdminCampus(null);
        setAssignOtpStep("email");
        setAssignOtpCode("");
      } else {
        setModalError(data.error || "Invalid verification code.");
      }
    } catch (err) {
      console.error("Verify OTP error:", err);
      setModalError("Network error during OTP verification.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleAddOrRequestCompany = async (campusId: string) => {
    const inputName = (companyInputs[campusId] || "").trim();
    if (!inputName) return;

    setCompanyActionLoadingId(`${campusId}-add`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${campusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_company",
          companyName: inputName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCampuses((prev) =>
          prev.map((c) =>
            c.campusId === campusId
              ? {
                  ...c,
                  companies: data.campus.companies,
                  pendingCompanies: data.campus.pendingCompanies,
                }
              : c
          )
        );
        setCompanyInputs((prev) => ({ ...prev, [campusId]: "" }));
        setSuccessMessage(data.message);
      } else {
        setErrorMessage(data.error || "Failed to add company.");
      }
    } catch (err) {
      console.error("Error adding company:", err);
      setErrorMessage("Failed to add company.");
    } finally {
      setCompanyActionLoadingId(null);
    }
  };

  const handleApproveCompany = async (campusId: string, companyName: string) => {
    setCompanyActionLoadingId(`${campusId}-approve-${companyName}`);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/admin/campuses/${campusId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve_company",
          companyName,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setCampuses((prev) =>
          prev.map((c) =>
            c.campusId === campusId
              ? {
                  ...c,
                  companies: data.campus.companies,
                  pendingCompanies: data.campus.pendingCompanies,
                }
              : c
          )
        );
        setSuccessMessage(`Approved "${companyName}" for ${campusId}!`);
      } else {
        setErrorMessage(data.error || "Failed to approve company.");
      }
    } catch (err) {
      console.error("Error approving company:", err);
      setErrorMessage("Failed to approve company.");
    } finally {
      setCompanyActionLoadingId(null);
    }
  };

  const handleRejectCompany = (campusId: string, companyName: string) => {
    setConfirmModal({
      title: "Reject Company Request?",
      message: `Are you sure you want to reject the addition request for "${companyName}" in campus ${campusId}?`,
      confirmText: "Reject Request",
      variant: "destructive",
      onConfirm: async () => {
        setCompanyActionLoadingId(`${campusId}-reject-${companyName}`);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
          const res = await fetch(`/api/admin/campuses/${campusId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "reject_company",
              companyName,
            }),
          });

          const data = await res.json();

          if (res.ok) {
            setCampuses((prev) =>
              prev.map((c) =>
                c.campusId === campusId
                  ? {
                      ...c,
                      pendingCompanies: data.campus.pendingCompanies,
                    }
                  : c
              )
            );
            setSuccessMessage(`Rejected request for "${companyName}".`);
          } else {
            setErrorMessage(data.error || "Failed to reject company.");
          }
        } catch (err) {
          console.error("Error rejecting company:", err);
          setErrorMessage("Failed to reject company.");
        } finally {
          setCompanyActionLoadingId(null);
        }
      },
    });
  };

  const handleRemoveCompany = (campusId: string, companyName: string) => {
    setConfirmModal({
      title: "Remove Company?",
      message: `Are you sure you want to remove "${companyName}" from campus ${campusId}? Commuters registered under this company will need to update their profiles.`,
      confirmText: "Remove Company",
      variant: "destructive",
      onConfirm: async () => {
        setCompanyActionLoadingId(`${campusId}-remove-${companyName}`);
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
          const res = await fetch(`/api/admin/campuses/${campusId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "remove_company",
              companyName,
            }),
          });

          const data = await res.json();

          if (res.ok) {
            setCampuses((prev) =>
              prev.map((c) => (c.campusId === campusId ? { ...c, companies: data.campus.companies } : c))
            );
            setSuccessMessage(`Removed "${companyName}" from ${campusId}.`);
          } else {
            setErrorMessage(data.error || "Failed to remove company.");
          }
        } catch (err) {
          console.error("Error removing company:", err);
          setErrorMessage("Failed to remove company.");
        } finally {
          setCompanyActionLoadingId(null);
        }
      },
    });
  };

  const handleDeleteCampus = (campusId: string, campusName: string) => {
    setConfirmModal({
      title: "Delete Campus?",
      message: `Are you sure you want to delete "${campusName}" (${campusId})? All operating company associations and campus commuters will be unlinked. This cannot be undone.`,
      confirmText: "Delete Campus",
      variant: "destructive",
      onConfirm: async () => {
        setErrorMessage(null);
        setSuccessMessage(null);

        try {
          const res = await fetch(`/api/admin/campuses/${encodeURIComponent(campusId)}`, {
            method: "DELETE",
          });

          const data = await res.json();
          console.log(`DELETE campus [${res.status}]:`, data);

          if (res.ok && data.success) {
            setCampuses((prev) => prev.filter((c) => c.campusId !== campusId && c._id !== campusId));
            setSuccessMessage(data.message || `Campus "${campusName}" deleted successfully.`);
            await fetchCampuses();
          } else {
            setErrorMessage(`Error ${res.status}: ${data.error || "Failed to delete campus."}`);
          }
        } catch (err) {
          console.error("Error deleting campus:", err);
          setErrorMessage("Network error — failed to delete campus.");
        }
      },
    });
  };

  // Metrics
  const totalCampuses = campuses.length;
  const totalCompaniesCount = campuses.reduce((acc, c) => acc + (c.companies?.length || 0), 0);
  const totalEmployeesCount = campuses.reduce((acc, c) => acc + (c.employeeCount || 0), 0);
  const assignedAdminsCount = campuses.filter((c) => Boolean(c.adminEmail)).length;
  const uniqueCities = Array.from(new Set(campuses.map((c) => c.city).filter(Boolean)));

  const allPendingRequests = campuses.flatMap((c) =>
    (c.pendingCompanies || []).map((p) => ({
      ...p,
      campusId: c.campusId,
      campusName: c.name,
    }))
  );

  const filteredCampuses = campuses.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.campusId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.adminEmail && c.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      c.companies.some((comp) => comp.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = selectedCity === "all" || c.city === selectedCity;

    return matchesSearch && matchesCity;
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading Campus & Company governance hub..." />
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
              <Building2 className="h-6 w-6 text-purple-600" />
              Campus & Admin Hub
            </h1>
            {isSuperAdmin ? (
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2.5 py-0.5">
                Super Admin Console
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-0.5">
                Campus Admin ({session?.user?.campusId})
              </Badge>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {isSuperAdmin
              ? "Governance across all physical campuses, campus administrators, and company addition approvals."
              : "Manage operating companies and commuters for your assigned physical campus."}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isSuperAdmin && (
            <Button
              onClick={() => {
                const maxNum = campuses.reduce((acc, c) => {
                  const match = c.campusId.match(/^CAMP(\d+)$/i);
                  return match ? Math.max(acc, parseInt(match[1], 10)) : acc;
                }, 0);
                const nextId = `CAMP${String(maxNum + 1).padStart(3, "0")}`;
                setNewCampus({
                  campusId: nextId,
                  name: "",
                  address: "",
                  city: "",
                  state: "",
                  adminEmail: "",
                  companiesInput: "",
                });
                setIsAddCampusOpen(true);
              }}
              size="default"
              className="h-10 px-5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all gap-2"
            >
              <Plus className="h-4 w-4" /> Add Campus
            </Button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {successMessage && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 border border-emerald-200 animate-in fade-in-50">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800 border border-rose-200 animate-in fade-in-50">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SUPER ADMIN: PENDING COMPANY APPROVALS BANNER */}
      {isSuperAdmin && allPendingRequests.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/60 shadow-xs overflow-hidden rounded-2xl">
          <CardHeader className="py-3 px-4 bg-amber-100/60 border-b border-amber-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-700" />
                <span className="font-bold text-sm text-amber-900">
                  Pending Company Addition Requests ({allPendingRequests.length})
                </span>
              </div>
              <Badge className="bg-amber-600 text-white text-xs py-0.5 px-2 font-semibold">Action Required</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {allPendingRequests.map((req) => (
                <div
                  key={`${req.campusId}-${req.name}`}
                  className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{req.name}</span>
                      <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold tracking-wide">
                        {req.campusId}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Campus: <strong>{req.campusName}</strong> • Requested By: {req.requestedBy}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => handleApproveCompany(req.campusId, req.name)}
                      disabled={companyActionLoadingId === `${req.campusId}-approve-${req.name}`}
                      className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 font-semibold rounded-lg shadow-xs"
                    >
                      {companyActionLoadingId === `${req.campusId}-approve-${req.name}` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="h-3 w-3" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectCompany(req.campusId, req.name)}
                      disabled={companyActionLoadingId === `${req.campusId}-reject-${req.name}`}
                      className="h-8 px-3 text-xs border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg font-semibold"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Metrics Cards - Compact & Low-Profile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Physical Campuses</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCampuses}</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Building2 className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">Campus Admins</span>
            <div className="text-xl font-bold text-blue-900 mt-0.5">{assignedAdminsCount} / {totalCampuses}</div>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Operating Companies</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCompaniesCount}</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Briefcase className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Total Commuters</span>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{totalEmployeesCount}</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Users className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      {isSuperAdmin && (
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
          <button
            onClick={() => setActiveTab("campuses")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "campuses"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Campuses & Companies ({campuses.length})
          </button>
          <button
            onClick={() => setActiveTab("admins")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "admins"
                ? "bg-purple-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Campus Admins Directory ({assignedAdminsCount})
          </button>
        </div>
      )}

      {/* VIEW 1: CAMPUSES & COMPANIES */}
      {activeTab === "campuses" && (
        <div className="space-y-3">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="h-9 px-3 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
              >
                <option value="all">All Cities ({campuses.length})</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search campus, city, company, admin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs rounded-lg"
              />
            </div>
          </div>

          {/* Campus Cards List - Compact, High-Density & Overflow-Proof */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredCampuses.map((campus) => (
              <div
                key={campus._id || campus.campusId}
                className="bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="p-3.5 space-y-2.5">
                  {/* Top Line: Code, Name, Status, Delete */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 shrink-0 tracking-wide">
                        {campus.campusId}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 truncate">{campus.name}</h3>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold py-0 px-1.5">
                        Active
                      </Badge>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCampus(campus.campusId, campus.name)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title={`Delete ${campus.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Location snippet */}
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                    <span className="truncate">{campus.address}</span>
                    <span className="text-slate-300">•</span>
                    <strong className="text-slate-700 shrink-0">{campus.city}, {campus.state}</strong>
                  </div>

                  {/* Admin Row - Clean, Compact, No Clipping */}
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                      <span className="font-semibold text-slate-600 shrink-0">Admin:</span>
                      {campus.adminEmail ? (
                        <span className="font-semibold text-purple-900 truncate">
                          {campus.adminEmail}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">No admin assigned</span>
                      )}
                    </div>

                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignAdminCampus(campus);
                          setAssignAdminEmail(campus.adminEmail || "");
                          setAssignOtpStep("email");
                          setAssignOtpCode("");
                          setModalError(null);
                          setOtpDevCode(null);
                        }}
                        className="h-6 px-2 text-[11px] font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded shrink-0 flex items-center gap-1 transition-colors"
                      >
                        <Edit2 className="h-3 w-3" />
                        {campus.adminEmail ? "Reassign" : "Assign"}
                      </button>
                    )}
                  </div>

                  {/* Operating Companies & Commuters Summary */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                    <span className="flex items-center gap-1 font-semibold text-slate-700">
                      <Briefcase className="h-3 w-3 text-purple-600" />
                      {campus.companies.length} Operating Companies
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <Users className="h-3 w-3 text-emerald-600" />
                      {campus.employeeCount || 0} Commuters
                    </span>
                  </div>

                  {/* Company Tag Cloud */}
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {campus.companies.map((comp) => (
                      <span
                        key={comp}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200"
                      >
                        {comp}
                        {(isSuperAdmin || (isCampusAdmin && session?.user?.campusId === campus.campusId)) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCompany(campus.campusId, comp)}
                            className="text-slate-400 hover:text-rose-600 ml-0.5"
                            title={`Remove ${comp}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  {/* Pending Requests Banner */}
                  {campus.pendingCompanies && campus.pendingCompanies.length > 0 && (
                    <div className="p-2 bg-amber-50 rounded-lg border border-amber-200 space-y-1 text-xs">
                      <div className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Awaiting Approval
                      </div>
                      {campus.pendingCompanies.map((pending) => (
                        <div
                          key={pending.name}
                          className="flex items-center justify-between gap-1 text-[11px] bg-white px-2 py-1 rounded border border-amber-200"
                        >
                          <span className="font-semibold text-slate-800">{pending.name}</span>
                          {isSuperAdmin ? (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleApproveCompany(campus.campusId, pending.name)}
                                className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectCompany(campus.campusId, pending.name)}
                                className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-amber-700 font-medium">Pending...</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Compact Add Company Footer */}
                <div className="px-3 py-2 bg-slate-50/80 border-t border-slate-100 flex items-center gap-2">
                  <Input
                    placeholder="Add operating company name..."
                    value={companyInputs[campus.campusId] || ""}
                    onChange={(e) =>
                      setCompanyInputs((prev) => ({ ...prev, [campus.campusId]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddOrRequestCompany(campus.campusId);
                      }
                    }}
                    className="h-8 text-xs bg-white rounded-md px-2.5 border-slate-200"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleAddOrRequestCompany(campus.campusId)}
                    disabled={
                      !(companyInputs[campus.campusId] || "").trim() ||
                      companyActionLoadingId === `${campus.campusId}-add`
                    }
                    className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-700 text-white shrink-0 font-semibold gap-1 rounded-md shadow-2xs"
                  >
                    {companyActionLoadingId === `${campus.campusId}-add` ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    Add
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: CAMPUS ADMINS DIRECTORY */}
      {activeTab === "admins" && isSuperAdmin && (
        <Card className="border-slate-200 bg-white shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="py-4 px-5 bg-slate-50/80 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-purple-600" />
                  Campus Administrators Governance Directory
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Designate and manage authorized administrators for each individual physical campus.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4 font-bold w-36">Campus Code</th>
                    <th className="py-3 px-4 font-bold">Campus Name</th>
                    <th className="py-3 px-4 font-bold">Location</th>
                    <th className="py-3 px-4 font-bold">Allocated Campus Admin</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {campuses.map((campus) => (
                    <tr key={campus.campusId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 tracking-wide inline-block">
                          {campus.campusId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 text-xs">
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
                          <span className="italic text-slate-400 text-xs">Not Assigned</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {campus.adminEmail ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold py-0.5 px-2">
                            Active Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-amber-700 border-amber-200 text-[11px] py-0.5 px-2 font-medium">
                            Pending Assignment
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4.5 text-right">
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
                            className="h-8 text-xs px-3 border-purple-200 text-purple-700 hover:bg-purple-50 gap-1.5 rounded-lg font-semibold shadow-2xs"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            {campus.adminEmail ? "Reassign" : "Assign"}
                          </Button>
                          {campus.adminEmail && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setConfirmModal({
                                  title: "Revoke Campus Administrator?",
                                  message: `Are you sure you want to revoke campus admin privileges for "${campus.name}" (${campus.campusId})?`,
                                  confirmText: "Revoke Privileges",
                                  variant: "destructive",
                                  onConfirm: async () => {
                                    try {
                                      await fetch(`/api/admin/campuses/${campus.campusId}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ action: "assign_admin", adminEmail: "" }),
                                      });
                                      await fetchCampuses();
                                      setSuccessMessage(`Revoked campus admin privileges for ${campus.name}.`);
                                    } catch (e) {
                                      console.error("Revoke error:", e);
                                      setErrorMessage("Failed to revoke administrator.");
                                    }
                                  },
                                });
                              }}
                              className="h-8 text-xs px-3 border-rose-200 text-rose-700 hover:bg-rose-50 gap-1.5 rounded-lg font-semibold"
                            >
                              <UserX className="h-3.5 w-3.5" />
                              Revoke
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: ADD NEW CAMPUS (Super Admin) */}
      {isAddCampusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Add New Campus</h2>
                  <p className="text-[11px] text-slate-500">Register a new physical campus and provision operating companies.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddCampusOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCampus} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Campus Code</Label>
                  <Input
                    required
                    value={newCampus.campusId}
                    onChange={(e) => setNewCampus({ ...newCampus, campusId: e.target.value.toUpperCase() })}
                    placeholder="e.g. CAMP004"
                    className="font-mono uppercase h-9 text-xs rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Campus Name</Label>
                  <Input
                    required
                    value={newCampus.name}
                    onChange={(e) => setNewCampus({ ...newCampus, name: e.target.value })}
                    placeholder="e.g. Silicon Oasis Tech Park"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Street Address</Label>
                <Input
                  value={newCampus.address}
                  onChange={(e) => setNewCampus({ ...newCampus, address: e.target.value })}
                  placeholder="e.g. Plot 12, Phase 3, Electronic City"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">City</Label>
                  <Input
                    required
                    value={newCampus.city}
                    onChange={(e) => setNewCampus({ ...newCampus, city: e.target.value })}
                    placeholder="e.g. Bangalore"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">State</Label>
                  <Input
                    required
                    value={newCampus.state}
                    onChange={(e) => setNewCampus({ ...newCampus, state: e.target.value })}
                    placeholder="e.g. Karnataka"
                    className="h-9 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Campus Admin Email (Optional)</Label>
                <Input
                  type="email"
                  value={newCampus.adminEmail}
                  onChange={(e) => setNewCampus({ ...newCampus, adminEmail: e.target.value })}
                  placeholder="e.g. campusadmin@company.com"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Operating Companies (Comma-separated)</Label>
                <Input
                  value={newCampus.companiesInput}
                  onChange={(e) => setNewCampus({ ...newCampus, companiesInput: e.target.value })}
                  placeholder="e.g. ABC Technologies, TCS, Infosys, Wipro"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddCampusOpen(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingCampus}
                  size="sm"
                  className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                >
                  {isSubmittingCampus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Create Campus
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN CAMPUS ADMIN (Super Admin - 2FA OTP) */}
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
                    {assignOtpStep === "email" ? "Assign Campus Administrator" : "Security Code Verification"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {assignOtpStep === "email" ? "Enter the administrator's corporate email address." : "Enter the authorization code sent to the email."}
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

            <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 text-xs text-purple-900 flex items-center justify-between">
              <span>Target Campus:</span>
              <strong className="text-purple-950 font-semibold">{assignAdminCampus.name} ({assignAdminCampus.campusId})</strong>
            </div>

            {modalError && (
              <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800 border border-rose-200 animate-in fade-in-50">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span className="font-medium">{modalError}</span>
              </div>
            )}

            {otpDevCode && (
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-2 animate-in fade-in-50">
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-700 block">Authorization Passcode</span>
                  <strong className="font-mono text-sm tracking-wider text-amber-950">{otpDevCode}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignOtpCode(otpDevCode)}
                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-md text-xs font-bold transition-colors shrink-0"
                >
                  Auto-fill Code
                </button>
              </div>
            )}

            {assignOtpStep === "email" ? (
              <form onSubmit={handleSendOtp} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Administrator Corporate Email</Label>
                  <Input
                    type="email"
                    required
                    value={assignAdminEmail}
                    onChange={(e) => setAssignAdminEmail(e.target.value)}
                    placeholder="e.g. admin.chennai@propark.corporate"
                    className="h-9 text-xs rounded-lg"
                  />
                  <p className="text-[11px] text-slate-500">
                    A 6-digit one-time authorization code will be dispatched to this email address.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignAdminCampus(null)}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSendingOtp || !assignAdminEmail.trim()}
                    size="sm"
                    className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                  >
                    {isSendingOtp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send Verification Code
                  </Button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3 text-xs">
                <div className="space-y-1 text-center">
                  <div className="text-[11px] text-slate-500">
                    Verification code sent to:
                  </div>
                  <div className="font-semibold text-xs text-purple-900 bg-purple-50 py-1 px-2.5 rounded-md inline-block border border-purple-200">
                    {assignAdminEmail}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700 text-center block">
                    6-Digit Security OTP
                  </Label>
                  <Input
                    type="text"
                    required
                    maxLength={6}
                    autoFocus
                    value={assignOtpCode}
                    onChange={(e) => setAssignOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="• • • • • •"
                    className="h-11 text-center font-mono text-xl tracking-[0.35em] font-bold rounded-lg border-purple-300 focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignOtpStep("email");
                      setAssignOtpCode("");
                      setModalError(null);
                    }}
                    className="text-slate-500 hover:text-purple-600 font-medium"
                  >
                    ← Change Email
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isSendingOtp}
                    onClick={() => handleSendOtp()}
                    className="text-purple-600 hover:text-purple-800 font-semibold disabled:opacity-50 flex items-center gap-1"
                  >
                    <RefreshCw className={`h-3 w-3 ${isSendingOtp ? "animate-spin" : ""}`} />
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAssignAdminCampus(null)}
                    className="h-9 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isVerifyingOtp || assignOtpCode.length < 6}
                    size="sm"
                    className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                  >
                    {isVerifyingOtp ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5" />
                    )}
                    Verify & Assign Admin
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG BOX (Professional High-End Design) */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50 duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-2xl shrink-0 ${
                  confirmModal.variant === "destructive"
                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                    : "bg-purple-50 text-purple-600 border border-purple-100"
                }`}
              >
                {confirmModal.variant === "destructive" ? (
                  <AlertTriangle className="h-7 w-7" />
                ) : (
                  <ShieldCheck className="h-7 w-7" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">{confirmModal.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{confirmModal.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={confirmModal.isLoading}
                onClick={() => setConfirmModal(null)}
                className="h-10 px-5 text-sm font-semibold rounded-xl border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-all shadow-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="default"
                disabled={confirmModal.isLoading}
                onClick={async () => {
                  if (confirmModal.onConfirm) {
                    setConfirmModal((prev) => (prev ? { ...prev, isLoading: true } : null));
                    try {
                      await confirmModal.onConfirm();
                    } finally {
                      setConfirmModal(null);
                    }
                  }
                }}
                className={`h-10 px-6 text-sm font-semibold rounded-xl text-white transition-all shadow-sm flex items-center gap-2 ${
                  confirmModal.variant === "destructive"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-purple-600 hover:bg-purple-700"
                }`}
              >
                {confirmModal.isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {confirmModal.confirmText || "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
