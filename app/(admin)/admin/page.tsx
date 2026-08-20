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

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs font-semibold">
              <Shield className="h-3 w-3 mr-1" /> Campus Administration Console
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-2">
            Admin Dashboard & Verification
          </h1>
          <p className="text-sm text-slate-500">
            Review corporate employee verification requests, campus carpooling fleet, and live passenger commute manifests.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/campuses">
            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Campuses
            </Button>
          </Link>
          <Link href="/admin/employees">
            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl gap-1.5">
              <Users className="h-3.5 w-3.5" /> Employees
            </Button>
          </Link>
          <Link href="/admin/vehicles">
            <Button variant="outline" size="sm" className="text-xs font-semibold rounded-xl gap-1.5">
              <Car className="h-3.5 w-3.5" /> Fleet Desk
            </Button>
          </Link>
          <Link href="/admin/rides">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-xs">
              <Route className="h-3.5 w-3.5" /> Track Rides & Passengers
            </Button>
          </Link>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Employees
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{employees.length}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Registered corporate profiles
            </p>
          </CardContent>
        </Card>

        {/* Pending Verification */}
        <Card className={`border-slate-200 bg-white shadow-sm ${pendingCount > 0 ? "border-amber-300 ring-2 ring-amber-100" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Pending Approvals
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-amber-800">{pendingCount}</div>
            )}
            <p className="text-xs text-amber-600 mt-1 font-medium">
              {pendingCount > 0 ? "Awaiting admin review" : "All employees verified"}
            </p>
          </CardContent>
        </Card>

        {/* Registered Fleet */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Campus Vehicles
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Car className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-slate-900">{vehicles.length}</div>
            )}
            <p className="text-xs text-slate-500 mt-1">
              <span className="text-emerald-600 font-medium">{vehicles.filter(v => v.status === "active").length}</span> active for carpools
            </p>
          </CardContent>
        </Card>

        {/* Total Commute Seat Capacity */}
        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Commute Seat Pool
            </CardTitle>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Leaf className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {vehicles.reduce((acc, v) => acc + (v.availableSeats || 0), 0)} Seats
            </div>
            <p className="text-xs text-slate-500 mt-1">Available corporate commuter capacity</p>
          </CardContent>
        </Card>
      </div>

      {/* Live Registered Employees Table with Approval Controls */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">
              Employee Verification & Directory
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Approve or reject employee campus access requests ({employees.length} total)
            </CardDescription>
          </div>
          <Link href="/admin/employees">
            <Button variant="outline" size="sm" className="text-xs gap-1">
              Full Directory <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center">
              <CarLoader size="lg" message="Loading admin telemetry & verification queue..." />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No employees registered yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-3 px-4 font-semibold">Employee</th>
                    <th className="py-3 px-4 font-semibold">Company ID</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Verification Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Approval Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                            {getInitials(emp.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{emp.name}</div>
                            <div className="text-xs text-slate-500">{emp.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-slate-700">
                        {emp.employeeId}
                      </td>
                      <td className="py-3 px-4 text-slate-700 text-xs">
                        {emp.department}
                      </td>
                      <td className="py-3 px-4">
                        {emp.role === "admin" ? (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px]">
                            Admin
                          </Badge>
                        ) : emp.verificationStatus === "approved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                            Approved
                          </Badge>
                        ) : emp.verificationStatus === "rejected" ? (
                          <Badge variant="destructive" className="text-[10px]">
                            Rejected
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                            Pending Review
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {emp.role !== "admin" && (
                          <div className="flex items-center justify-end gap-1.5">
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
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
