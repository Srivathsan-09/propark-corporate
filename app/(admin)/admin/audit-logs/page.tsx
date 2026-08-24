"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  FileCheck,
  ArrowLeft,
  Search,
  Filter,
  Shield,
  Clock,
  User,
  Building2,
  AlertTriangle,
  CheckCircle,
  Eye,
  Loader2,
  X,
  Globe,
  Laptop,
  Calendar,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

interface IAuditLogItem {
  _id: string;
  adminName: string;
  adminEmail: string;
  adminRole: string;
  action: string;
  targetEntity: string;
  targetId: string;
  targetName?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

const ACTION_FORMATS: Record<string, { label: string; color: string }> = {
  CAMPUS_CREATED: { label: "Campus Created", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CAMPUS_UPDATED: { label: "Campus Updated", color: "bg-blue-50 text-blue-700 border-blue-200" },
  CAMPUS_DELETED: { label: "Campus Deleted", color: "bg-rose-50 text-rose-700 border-rose-200" },
  CAMPUS_ADMIN_ASSIGNED: { label: "Admin Assigned", color: "bg-purple-50 text-purple-700 border-purple-200" },
  CAMPUS_ADMIN_REVOKED: { label: "Admin Revoked", color: "bg-rose-50 text-rose-700 border-rose-200" },
  EMPLOYEE_APPROVED: { label: "Employee Approved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  EMPLOYEE_REJECTED: { label: "Employee Rejected", color: "bg-rose-50 text-rose-700 border-rose-200" },
  INCIDENT_RESOLVED: { label: "Incident Resolved", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  INCIDENT_STATUS_UPDATED: { label: "Incident Triaged", color: "bg-amber-50 text-amber-700 border-amber-200" },
};

export default function AdminAuditLogsPage() {
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "admin";

  const [logs, setLogs] = useState<IAuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");

  const [selectedLog, setSelectedLog] = useState<IAuditLogItem | null>(null);

  const fetchLogs = async () => {
    try {
      const res = await fetch("/api/admin/audit-logs");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const totalLogs = logs.length;
  const today = new Date().toISOString().split("T")[0];
  const todayCount = logs.filter((l) => l.createdAt.startsWith(today)).length;
  const securityCount = logs.filter((l) => l.action.includes("ADMIN") || l.action.includes("DELETED")).length;

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      log.adminName.toLowerCase().includes(term) ||
      log.adminEmail.toLowerCase().includes(term) ||
      log.action.toLowerCase().includes(term) ||
      log.targetId.toLowerCase().includes(term) ||
      (log.targetName && log.targetName.toLowerCase().includes(term)) ||
      log.details.toLowerCase().includes(term);

    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    const matchesEntity = entityFilter === "all" || log.targetEntity === entityFilter;

    return matchesSearch && matchesAction && matchesEntity;
  });

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading Enterprise Audit Logs..." />
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
              <FileCheck className="h-5 w-5 text-purple-600" />
              Activity Logs
            </h1>
            <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-2 py-0.5">
              Super Admin
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            History of administrative actions, employee approvals, and campus updates.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Actions</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalLogs}</div>
          </div>
          <div className="p-2 bg-slate-100 rounded-lg text-slate-700">
            <Layers className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-purple-600 uppercase tracking-wider block">Today&apos;s Actions</span>
            <div className="text-xl font-bold text-purple-900 mt-0.5">{todayCount}</div>
          </div>
          <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
            <Calendar className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-rose-600 uppercase tracking-wider block">Important Actions</span>
            <div className="text-xl font-bold text-rose-900 mt-0.5">{securityCount}</div>
          </div>
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
            <Shield className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
          >
            <option value="all">All Actions ({logs.length})</option>
            <option value="CAMPUS_DELETED">Campus Deleted</option>
            <option value="CAMPUS_ADMIN_ASSIGNED">Admin Assigned</option>
            <option value="CAMPUS_ADMIN_REVOKED">Admin Revoked</option>
            <option value="EMPLOYEE_APPROVED">Employee Approved</option>
            <option value="EMPLOYEE_REJECTED">Employee Rejected</option>
            <option value="INCIDENT_RESOLVED">Incident Resolved</option>
          </select>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="h-8 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-purple-600 shadow-2xs"
          >
            <option value="all">All Types</option>
            <option value="Campus">Campus</option>
            <option value="User">Employee / User</option>
            <option value="Report">Report</option>
          </select>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search admin, action, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-xs rounded-lg"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="border-slate-200 bg-white shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="py-3 px-6 bg-slate-50/80 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-purple-600" />
            Activity History ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-3 pl-6 pr-4 font-bold w-36">Date & Time</th>
                  <th className="py-3 px-4 font-bold">Admin</th>
                  <th className="py-3 px-4 font-bold">Action</th>
                  <th className="py-3 px-4 font-bold">Target</th>
                  <th className="py-3 px-4 font-bold">Description</th>
                  <th className="py-3 pl-4 pr-6 font-bold text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-xs">
                      No audit log entries found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const actionInfo = ACTION_FORMATS[log.action] || {
                      label: log.action.replace(/_/g, " "),
                      color: "bg-slate-100 text-slate-700 border-slate-200",
                    };

                    return (
                      <tr key={log._id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 pl-6 pr-4 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="font-semibold text-slate-900 text-xs">{log.adminName}</div>
                          <div className="text-[11px] text-slate-500">{log.adminEmail}</div>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <Badge className={`${actionInfo.color} text-[10px] font-semibold py-0.5 px-2`}>
                            {actionInfo.label}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-bold text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 tracking-wide inline-block">
                            {log.targetId}
                          </span>
                          {log.targetName && (
                            <div className="text-[11px] text-slate-500 truncate max-w-[130px] mt-0.5">
                              {log.targetName}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 max-w-[240px]">
                          <p className="text-slate-700 text-xs truncate" title={log.details}>
                            {log.details}
                          </p>
                        </td>
                        <td className="py-3.5 pl-4 pr-6 text-right whitespace-nowrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLog(log)}
                            className="h-7 text-xs px-2.5 border-purple-200 text-purple-700 hover:bg-purple-50 gap-1 rounded-lg font-semibold shadow-2xs"
                          >
                            <Eye className="h-3 w-3" /> Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* INSPECT LOG MODAL */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in-50">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200 space-y-3.5 animate-in zoom-in-95 duration-200 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 border border-purple-100">
                  <FileCheck className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Audit Record Details</h2>
                  <span className="text-[11px] text-slate-500">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Admin Operator</span>
                <div className="font-bold text-slate-900">{selectedLog.adminName}</div>
                <div className="text-slate-600">{selectedLog.adminEmail} ({selectedLog.adminRole})</div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Operation & Target</span>
                <div className="font-semibold text-purple-700">{selectedLog.action}</div>
                <div className="text-slate-700">Entity: {selectedLog.targetEntity} | Target ID: <strong>{selectedLog.targetId}</strong></div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Details & Payload</span>
                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{selectedLog.details}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-slate-400" /> IP: <strong>{selectedLog.ipAddress || "127.0.0.1"}</strong>
                </div>
                <div className="flex items-center gap-1 truncate">
                  <Laptop className="h-3 w-3 text-slate-400 shrink-0" /> <span className="truncate">{selectedLog.userAgent || "Browser"}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedLog(null)}
                className="h-8 px-4 text-xs font-semibold rounded-lg"
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
