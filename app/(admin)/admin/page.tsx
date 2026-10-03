"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Car,
  Route,
  Leaf,
  ArrowUpRight,
  Shield,
  Check,
  X,
  Loader2,
  Clock,
  Building2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CarLoader } from "@/components/common/CarLoader";
import { getInitials } from "@/lib/utils";

interface IEmployee {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  department: string;
  role: "employee" | "admin" | "campus_admin";
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
  vehicleCount: number;
  createdAt: string;
}

interface IVehicle {
  _id: string;
  vehicleType: string;
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  availableSeats: number;
  status: "active" | "inactive";
  owner?: {
    name: string;
    employeeId: string;
    email: string;
    department: string;
  };
  createdAt: string;
}

export default function AdminDashboardPage() {
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [vehicles, setVehicles] = useState<IVehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadAdminData = async () => {
    try {
      const [empRes, vehRes] = await Promise.all([
        fetch("/api/admin/employees"),
        fetch("/api/admin/vehicles"),
      ]);

      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
      if (vehRes.ok) {
        const vehData = await vehRes.json();
        setVehicles(vehData.vehicles || []);
      }
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerify = async (employeeId: string, action: "approve" | "reject") => {
    try {
      setActionLoadingId(employeeId);
      const res = await fetch(`/api/admin/employees/${employeeId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

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
      }
    } catch (e) {
      console.error("Failed to verify employee:", e);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingCount = employees.filter((e) => e.verificationStatus === "pending").length;

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center bg-white rounded-xl border border-slate-200 shadow-xs">
        <CarLoader size="page" message="Loading admin telemetry & verification queue..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300">
      {/* Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] font-semibold px-2 py-0.5">
              <Shield className="h-2.5 w-2.5 mr-1" /> Admin Console
            </Badge>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            Admin Overview
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review employees, vehicles, and active campus rides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/campuses">
            <button className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <Building2 className="h-3.5 w-3.5 text-purple-600" /> Campuses
            </button>
          </Link>
          <Link href="/admin/employees">
            <button className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <Users className="h-3.5 w-3.5 text-blue-600" /> Employees
            </button>
          </Link>
          <Link href="/admin/vehicles">
            <button className="h-8 px-3 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors">
              <Car className="h-3.5 w-3.5 text-indigo-600" /> Vehicles
            </button>
          </Link>
          <Link href="/admin/rides">
            <button className="h-8 px-4 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition-colors shadow-sm">
              <Route className="h-3.5 w-3.5" /> Rides
            </button>
          </Link>
          <Link href="/admin/sustainability">
            <button className="h-8 px-3 text-xs font-semibold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 flex items-center gap-1.5 transition-colors">
              <Leaf className="h-3.5 w-3.5 text-emerald-600" /> Sustainability
            </button>
          </Link>
        </div>
      </div>

      {/* Compact Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Total Employees</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{employees.length}</div>
            <p className="text-[10px] text-slate-400 mt-0.5">Registered profiles</p>
          </div>
          <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
            <Users className="h-4 w-4" />
          </div>
        </div>

        <div className={`bg-white p-3 rounded-xl border shadow-2xs flex items-center justify-between ${pendingCount > 0 ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"}`}>
          <div>
            <span className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider block">Pending Review</span>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{pendingCount}</div>
            <p className="text-[10px] text-amber-500 mt-0.5 font-medium">
              {pendingCount > 0 ? "Awaiting review" : "All verified"}
            </p>
          </div>
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Campus Vehicles</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{vehicles.length}</div>
            <p className="text-[10px] text-emerald-600 mt-0.5 font-medium">
              {vehicles.filter(v => v.status === "active").length} active
            </p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Car className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Seat Pool</span>
            <div className="text-xl font-bold text-emerald-700 mt-0.5">
              {vehicles.reduce((acc, v) => acc + (v.availableSeats || 0), 0)}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">Available seats</p>
          </div>
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <Leaf className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Employee Verification Table - Compact */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Employee Verification & Directory</h2>
            <p className="text-[11px] text-slate-500">
              Approve or reject employee campus access requests ({employees.length} total)
            </p>
          </div>
          <Link href="/admin/employees">
            <button className="h-7 px-2.5 text-[11px] font-semibold border border-slate-200 text-slate-600 hover:bg-slate-100 rounded flex items-center gap-1 transition-colors">
              Full Directory <ArrowUpRight className="h-3 w-3" />
            </button>
          </Link>
        </div>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <CarLoader size="lg" message="Loading admin telemetry & verification queue..." />
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            No employees registered yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" style={{ minWidth: "580px" }}>
              <thead>
                <tr className="border-b border-slate-100 text-[10px] uppercase text-slate-400 bg-slate-50/40">
                  <th className="py-2 px-3 font-semibold w-[220px]">Employee</th>
                  <th className="py-2 px-3 font-semibold w-[100px]">Emp Id</th>
                  <th className="py-2 px-3 font-semibold w-[130px]">Department</th>
                  <th className="py-2 px-3 font-semibold w-[100px]">Status</th>
                  <th className="py-2 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 px-3 max-w-[220px]">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                          {getInitials(emp.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{emp.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {emp.employeeId}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px] max-w-[130px]">
                      <span className="truncate block">{emp.department}</span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      {emp.role === "admin" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">Admin</span>
                      ) : emp.role === "campus_admin" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Campus Admin</span>
                      ) : emp.verificationStatus === "approved" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Approved
                        </span>
                      ) : emp.verificationStatus === "rejected" ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          Rejected
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      {emp.role === "admin" || emp.role === "campus_admin" ? (
                        <span className="text-slate-400 text-[10px] italic">Admin</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {emp.verificationStatus !== "approved" && (
                            <button
                              type="button"
                              onClick={() => handleVerify(emp._id, "approve")}
                              disabled={actionLoadingId === emp._id}
                              className="h-6 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded flex items-center gap-1 disabled:opacity-60 transition-colors"
                            >
                              {actionLoadingId === emp._id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Approve
                            </button>
                          )}
                          {emp.verificationStatus !== "rejected" && (
                            <button
                              type="button"
                              onClick={() => handleVerify(emp._id, "reject")}
                              disabled={actionLoadingId === emp._id}
                              className="h-6 px-2 border border-rose-200 text-rose-700 hover:bg-rose-50 text-[10px] font-bold rounded flex items-center gap-1 disabled:opacity-60 transition-colors"
                            >
                              {actionLoadingId === emp._id && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                              Reject
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
