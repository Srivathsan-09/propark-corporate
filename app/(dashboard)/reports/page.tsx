"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Plus,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  Phone,
  HelpCircle,
  Eye,
  Loader2,
  X,
  Send,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CarLoader } from "@/components/common/CarLoader";

interface IMyReport {
  _id: string;
  reportId: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  title: string;
  description: string;
  status: "pending" | "in_investigation" | "resolved" | "dismissed";
  involvedUserName?: string;
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

export default function EmployeeReportsPage() {
  const [reports, setReports] = useState<IMyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Filing Report
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState("rash_driving");
  const [newPriority, setNewPriority] = useState("medium");
  const [newInvolvedUser, setNewInvolvedUser] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal
  const [viewReport, setViewReport] = useState<IMyReport | null>(null);

  // Alerts
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchMyReports = async () => {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error("Failed to load reports:", err);
      setErrorMessage("Failed to load your incident reports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReports();
  }, []);

  const handleCreateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!newTitle.trim() || !newDescription.trim()) {
      setErrorMessage("Please provide a title and detailed description.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          category: newCategory,
          priority: newPriority,
          involvedUserName: newInvolvedUser.trim(),
          description: newDescription.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccessMessage(data.message || "Incident report submitted successfully.");
        setIsCreateModalOpen(false);
        setNewTitle("");
        setNewDescription("");
        setNewInvolvedUser("");
        setNewCategory("rash_driving");
        setNewPriority("medium");
        await fetchMyReports();
      } else {
        setErrorMessage(data.error || "Failed to submit report.");
      }
    } catch (err) {
      console.error("Create report error:", err);
      setErrorMessage("Network error while submitting report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Metrics
  const totalCount = reports.length;
  const inReviewCount = reports.filter((r) => r.status === "pending" || r.status === "in_investigation").length;
  const resolvedCount = reports.filter((r) => r.status === "resolved").length;

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading Safety & Incident Center..." />
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
              href="/dashboard"
              className="text-xs text-slate-500 hover:text-purple-600 flex items-center gap-1 font-semibold transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-600" />
              Safety & Incident Reporting Center
            </h1>
            <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5">
              Confidential Triage
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Report ride disputes, safety infractions, route deviations, and track administrative investigations.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          size="sm"
          className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg shadow-xs gap-1.5 shrink-0"
        >
          <Plus className="h-4 w-4" /> File Safety Report
        </Button>
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

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">My Filed Reports</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <FileText className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Active Triage</span>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{inReviewCount}</div>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">Resolved Cases</span>
            <div className="text-xl font-bold text-emerald-900 mt-0.5">{resolvedCount}</div>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Main Reports Table */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-6 bg-slate-50/80 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="h-4 w-4 text-purple-600" />
            My Incident History ({reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-6 pr-4 font-bold w-28">Case ID</th>
                  <th className="py-3 px-4 font-bold">Category & Subject</th>
                  <th className="py-3 px-4 font-bold">Priority</th>
                  <th className="py-3 px-4 font-bold">Date Filed</th>
                  <th className="py-3 px-4 font-bold">Status</th>
                  <th className="py-3 pl-4 pr-6 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                      <ShieldCheck className="h-8 w-8 mx-auto text-emerald-500/60 mb-2" />
                      No incident reports filed. Safe commuting!
                    </td>
                  </tr>
                ) : (
                  reports.map((report) => (
                    <tr key={report._id || report.reportId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 pl-6 pr-4 whitespace-nowrap">
                        <span className="font-bold text-xs text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 tracking-wide inline-block">
                          {report.reportId}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-[260px]">
                        <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wide">
                          {CATEGORY_LABELS[report.category] || report.category}
                        </div>
                        <div className="font-semibold text-slate-900 text-xs truncate" title={report.title}>
                          {report.title}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                      <td className="py-3.5 px-4 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(report.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
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
                      <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setViewReport(report)}
                          className="h-7 text-xs px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 gap-1 rounded-lg font-semibold shadow-2xs"
                        >
                          <Eye className="h-3 w-3" /> View Status
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

      {/* Emergency & Campus Safety Guidelines Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
          <div className="p-2 bg-rose-50 text-rose-600 rounded-lg shrink-0">
            <Phone className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">Campus Emergency Hotline</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              For immediate physical security, medical emergency, or vehicular accidents, contact your physical campus security desk immediately.
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-slate-900">CommuteX Safety Standard</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              All rides are monitored with verifiable corporate emails. Repeated safety violations result in instant platform suspension.
            </p>
          </div>
        </div>
      </div>

      {/* MODAL: FILE NEW INCIDENT REPORT */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">File Safety / Incident Report</h2>
                  <p className="text-[11px] text-slate-500">Your report will be reviewed confidentially by the campus admin.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateReport} className="space-y-3 text-xs">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Incident Summary / Subject</Label>
                <Input
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Driver exceeding campus speed limits"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Incident Category</Label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="rash_driving">Rash Driving</option>
                    <option value="harassment">Harassment</option>
                    <option value="route_deviation">Route Deviation</option>
                    <option value="vehicle_condition">Vehicle Condition</option>
                    <option value="payment_dispute">Payment Dispute</option>
                    <option value="safety_violation">Safety Violation</option>
                    <option value="other">General Incident</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Priority Level</Label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value)}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 font-medium"
                  >
                    <option value="low">Low - General Feedback</option>
                    <option value="medium">Medium - Important</option>
                    <option value="high">High - Urgent Concern</option>
                    <option value="urgent">Urgent - Safety Risk</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Involved Commuter Name / Vehicle (Optional)</Label>
                <Input
                  value={newInvolvedUser}
                  onChange={(e) => setNewInvolvedUser(e.target.value)}
                  placeholder="e.g. Ramesh K. or KA-01-AB-1234"
                  className="h-9 text-xs rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Detailed Description</Label>
                <textarea
                  required
                  rows={3}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe what occurred, time, route, and any safety concerns..."
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="h-9 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="h-9 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold gap-1.5 rounded-lg shadow-xs"
                >
                  {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Submit Report
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW REPORT STATUS & ADMIN FINDINGS */}
      {viewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Incident Details</h2>
                  <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    {viewReport.reportId}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewReport(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <span className="font-semibold text-slate-600">Current Status:</span>
                <div>
                  {viewReport.status === "pending" && (
                    <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 text-[10px] font-semibold">
                      Pending Review
                    </Badge>
                  )}
                  {viewReport.status === "in_investigation" && (
                    <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold">
                      In Investigation
                    </Badge>
                  )}
                  {viewReport.status === "resolved" && (
                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      Resolved
                    </Badge>
                  )}
                  {viewReport.status === "dismissed" && (
                    <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px]">
                      Dismissed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-900">{viewReport.title}</span>
                <p className="text-slate-600 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 text-[11px] leading-relaxed">
                  {viewReport.description}
                </p>
              </div>

              {viewReport.resolutionNotes ? (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Admin Resolution Findings
                  </div>
                  <p className="text-emerald-950 text-xs leading-relaxed">
                    {viewReport.resolutionNotes}
                  </p>
                  {viewReport.resolvedBy && (
                    <div className="text-[10px] text-emerald-700 pt-1 border-t border-emerald-200">
                      Resolved by: <strong>{viewReport.resolvedBy}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-amber-600" />
                  Your report is in the queue. The campus administration will review and resolve it.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewReport(null)}
                className="h-8 px-4 text-xs font-semibold rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

