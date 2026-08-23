"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  ShieldAlert,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  User,
  Building2,
  Eye,
  Loader2,
  X,
  Send,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Phone,
  Mail,
  Car,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarLoader } from "@/components/common/CarLoader";

interface IReportItem {
  _id: string;
  reportId: string;
  reporterName: string;
  reporterEmail: string;
  reporterPhone?: string;
  reporterCampusId?: string;
  reporterCompany?: string;
  involvedUserName?: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description: string;
  status: "pending" | "in_investigation" | "resolved" | "dismissed";
  resolutionNotes?: string;
  actionTaken?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  rash_driving: "Rash Driving",
  harassment: "Harassment",
  route_deviation: "Route Deviation",
  vehicle_condition: "Vehicle Condition",
  payment_dispute: "Payment Dispute",
  safety_violation: "Safety Violation",
  other: "General Incident",
};

export default function AdminReportsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const [reports, setReports] = useState<IReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  // Detail / Resolution Modal
  const [selectedReport, setSelectedReport] = useState<IReportItem | null>(null);
  const [editStatus, setEditStatus] = useState<string>("in_investigation");
  const [editPriority, setEditPriority] = useState<string>("medium");
  const [editActionTaken, setEditActionTaken] = useState<string>("none");
  const [resolutionNotes, setResolutionNotes] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const res = await fetch("/api/admin/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
      setErrorMessage("Failed to load incident reports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleOpenReport = (report: IReportItem) => {
    setSelectedReport(report);
    setEditStatus(report.status);
    setEditPriority(report.priority);
    setEditActionTaken(report.actionTaken || "none");
    setResolutionNotes(report.resolutionNotes || "");
    setErrorMessage(null);
  };

  const handleSaveResolution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReport) return;

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/admin/reports/${selectedReport.reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          actionTaken: editActionTaken,
          resolutionNotes: resolutionNotes.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(`Incident ${selectedReport.reportId} updated successfully.`);
        setSelectedReport(null);
        await fetchReports();
      } else {
        setErrorMessage(data.error || "Failed to update incident.");
      }
    } catch (err) {
      console.error("Resolution update error:", err);
      setErrorMessage("Network error while updating incident.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Metrics
  const totalReports = reports.length;
  const pendingReports = reports.filter((r) => r.status === "pending" || r.status === "in_investigation").length;
  const urgentReports = reports.filter((r) => (r.priority === "urgent" || r.priority === "high") && r.status !== "resolved").length;
  const resolvedReports = reports.filter((r) => r.status === "resolved").length;

  const filteredReports = reports.filter((r) => {
    const matchesSearch =
      r.reportId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reporterName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reporterEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.reporterCompany && r.reporterCompany.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || r.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || r.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesCategory && matchesPriority;
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading Safety & Incident Triage desk..." />
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
          <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              Incident & Safety Management Hub
            </h1>
            {isSuperAdmin ? (
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5">
                Super Admin Console
              </Badge>
            ) : (
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2 py-0.5">
                Campus Admin ({session?.user?.campusId})
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Triage commuter disputes, investigate safety escalations, and record administrative actions.
          </p>
        </div>
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

      {/* Top Metrics Cards - Compact & High-Density */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Incidents</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalReports}</div>
          </div>
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Active Triage</span>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{pendingReports}</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">High / Urgent</span>
            <div className="text-xl font-bold text-rose-900 mt-0.5">{urgentReports}</div>
          </div>
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Resolved Cases</span>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{resolvedReports}</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
          >
            <option value="all">All Statuses ({reports.length})</option>
            <option value="pending">Pending</option>
            <option value="in_investigation">In Investigation</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
          >
            <option value="all">All Categories</option>
            <option value="rash_driving">Rash Driving</option>
            <option value="harassment">Harassment</option>
            <option value="route_deviation">Route Deviation</option>
            <option value="vehicle_condition">Vehicle Condition</option>
            <option value="payment_dispute">Payment Dispute</option>
            <option value="safety_violation">Safety Violation</option>
            <option value="other">General Incident</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search report ID, title, commuter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Incident Triage Table */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-6 bg-slate-50/80 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            Safety Incident & Dispute Queue ({filteredReports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-6 pr-4 font-bold w-28">Incident ID</th>
                  <th className="py-3 px-4 font-bold">Campus / Company</th>
                  <th className="py-3 px-4 font-bold">Complainant</th>
                  <th className="py-3 px-4 font-bold">Category & Subject</th>
                  <th className="py-3 px-4 font-bold">Priority</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 pl-4 pr-6 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-xs">
                      No incidents found matching current filters.
                    </td>
                  </tr>
                ) : (
                  filteredReports.map((report) => (
                    <tr key={report._id || report.reportId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 pl-6 pr-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tracking-wide inline-block">
                          {report.reportId}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{report.reporterCampusId || "CAMP001"}</div>
                        <div className="text-[11px] text-slate-400">{report.reporterCompany || "Corporate"}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-xs">{report.reporterName}</div>
                        <div className="text-[11px] text-slate-500">{report.reporterEmail}</div>
                      </td>
                      <td className="py-3 px-4 max-w-[220px]">
                        <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">
                          {CATEGORY_LABELS[report.category] || report.category}
                        </div>
                        <div className="font-medium text-slate-800 text-xs truncate" title={report.title}>
                          {report.title}
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {report.priority === "urgent" && (
                          <Badge className="bg-rose-600 text-white text-[10px] font-bold py-0.5 px-2">
                            Urgent
                          </Badge>
                        )}
                        {report.priority === "high" && (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold py-0.5 px-2">
                            High
                          </Badge>
                        )}
                        {report.priority === "medium" && (
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold py-0.5 px-2">
                            Medium
                          </Badge>
                        )}
                        {report.priority === "low" && (
                          <Badge variant="outline" className="text-slate-600 border-slate-200 text-[10px] py-0.5 px-2">
                            Low
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {report.status === "pending" && (
                          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] font-semibold py-0.5 px-2">
                            Pending Review
                          </Badge>
                        )}
                        {report.status === "in_investigation" && (
                          <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold py-0.5 px-2">
                            Investigating
                          </Badge>
                        )}
                        {report.status === "resolved" && (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold py-0.5 px-2">
                            Resolved
                          </Badge>
                        )}
                        {report.status === "dismissed" && (
                          <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] py-0.5 px-2">
                            Dismissed
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 pl-4 pr-6 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenReport(report)}
                          className="h-7 text-xs px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 gap-1 rounded-lg font-semibold shadow-2xs"
                        >
                          <Eye className="h-3 w-3" />
                          Review & Triage
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* INVESTIGATE & RESOLUTION MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900">Incident Triage Desk</h2>
                    <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      {selectedReport.reportId}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Filed on {new Date(selectedReport.createdAt).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Reporter & Case Snapshot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Complainant Commuter</span>
                <strong className="text-slate-900 text-xs">{selectedReport.reporterName}</strong>
                <div className="text-[11px] text-slate-500">{selectedReport.reporterEmail}</div>
                {selectedReport.reporterPhone && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3 text-slate-400" /> {selectedReport.reporterPhone}
                  </div>
                )}
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Campus & Company</span>
                <strong className="text-slate-900 text-xs">{selectedReport.reporterCampusId || "CAMP001"}</strong>
                <div className="text-[11px] text-slate-500">{selectedReport.reporterCompany || "Corporate Commuter"}</div>
                {selectedReport.involvedUserName && (
                  <div className="text-[11px] text-purple-700 font-semibold mt-0.5">
                    Involved Party: {selectedReport.involvedUserName}
                  </div>
                )}
              </div>
            </div>

            {/* Incident Statement */}
            <div className="space-y-1.5 p-3 rounded-xl bg-white border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">{selectedReport.title}</span>
                <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-semibold">
                  {CATEGORY_LABELS[selectedReport.category] || selectedReport.category}
                </Badge>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 whitespace-pre-wrap">
                {selectedReport.description}
              </p>
            </div>

            {/* Triage & Resolution Form */}
            <form onSubmit={handleSaveResolution} className="space-y-3 text-xs pt-1 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Triage Status</Label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_investigation">In Investigation</option>
                    <option value="resolved">Resolved</option>
                    <option value="dismissed">Dismissed</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Priority Level</Label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Action Taken</Label>
                  <select
                    value={editActionTaken}
                    onChange={(e) => setEditActionTaken(e.target.value)}
                    className="w-full h-8 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="none">None / Inquiry</option>
                    <option value="warning_issued">Formal Warning Issued</option>
                    <option value="account_suspended">Account Suspended</option>
                    <option value="ride_cancelled">Ride Cancelled</option>
                    <option value="resolved_amicably">Resolved Amicably</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Administrative Findings & Resolution Remarks</Label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Record investigation findings, actions taken, or instructions provided to commuters..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedReport(null)}
                  className="h-8 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUpdating}
                  size="sm"
                  className="h-8 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                >
                  {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Save Findings & Update Status
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

