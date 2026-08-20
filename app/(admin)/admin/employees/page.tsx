"use client";

import React, { useEffect, useState } from "react";
import { Users, Search, ArrowLeft, Check, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  campusCompanyId?: string;
  campusId?: string;
  campusName?: string;
  role: "employee" | "admin" | "campus_admin";
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
  homeLocation?: string;
  vehicleCount: number;
  createdAt: string;
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<IEmployee[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCampus, setSelectedCampus] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/admin/employees");
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (err) {
      console.error("Failed to load employees:", err);
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

  // Get unique campuses and companies for filters
  const uniqueCampuses = Array.from(new Set(employees.map((e) => e.campusName).filter(Boolean)));
  const uniqueCompanies = Array.from(new Set(employees.map((e) => e.companyName).filter(Boolean)));

  const filtered = employees.filter((emp) => {
    const matchesSearch =
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (emp.companyName && emp.companyName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.campusName && emp.campusName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (emp.campusCompanyId && emp.campusCompanyId.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCampus = selectedCampus === "all" || emp.campusName === selectedCampus;
    const matchesCompany = selectedCompany === "all" || emp.companyName === selectedCompany;
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "pending" && emp.verificationStatus === "pending") ||
      (selectedStatus === "approved" && emp.verificationStatus === "approved") ||
      (selectedStatus === "rejected" && emp.verificationStatus === "rejected");

    return matchesSearch && matchesCampus && matchesCompany && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Overview
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Registered Employees Directory
          </h1>
          <p className="text-xs text-slate-500">
            Super Admin access: Manage campuses, companies inside campuses, and employees
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Campus Filter */}
          <select
            value={selectedCampus}
            onChange={(e) => setSelectedCampus(e.target.value)}
            className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-emerald-600 shadow-xs"
          >
            <option value="all">🏢 All Campuses</option>
            {uniqueCampuses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Company Filter */}
          <select
            value={selectedCompany}
            onChange={(e) => setSelectedCompany(e.target.value)}
            className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-emerald-600 shadow-xs"
          >
            <option value="all">🏬 All Companies</option>
            {uniqueCompanies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 px-2.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium focus:outline-emerald-600 shadow-xs"
          >
            <option value="all">⚡ All Statuses</option>
            <option value="pending">⏳ Pending</option>
            <option value="approved">✅ Approved</option>
            <option value="rejected">❌ Rejected</option>
          </select>

          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search name, ID, campus..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            Corporate Employees ({filtered.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <CarLoader size="lg" message="Loading campus employees..." />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No employees matched your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <th className="py-3 px-4 font-semibold">Employee</th>
                    <th className="py-3 px-4 font-semibold">Company ID</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Contact</th>
                    <th className="py-3 px-4 font-semibold">Vehicles</th>
                    <th className="py-3 px-4 font-semibold">Verification Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((emp) => (
                    <tr key={emp._id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
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
                      <td className="py-3 px-4 text-xs">
                        <div className="font-semibold text-slate-900">{emp.companyName || "ABC Technologies"}</div>
                        <div className="text-emerald-700 font-medium text-[11px] flex items-center gap-1">
                          <span>{emp.campusName || "Tech Park Chennai"}</span>
                          {emp.campusId && (
                            <span className="font-mono text-[10px] text-slate-400">({emp.campusId})</span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[10px]">{emp.department}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        {emp.phone || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-slate-700 text-xs">
                          {emp.vehicleCount} vehicles
                        </Badge>
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
