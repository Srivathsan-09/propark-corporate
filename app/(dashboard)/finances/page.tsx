"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  IndianRupee,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpRight,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

interface IFinancialTransaction {
  id: string;
  rideId: string;
  type: "earning" | "spending";
  date: string;
  time: string;
  startingLocation: string;
  destination: string;
  pickupStop: string;
  dropStop: string;
  seats: number;
  fare: number;
  amountPaid: number;
  remainingAmount: number;
  paymentStatus: "paid" | "partially_paid" | "not_paid";
  rideStatus: string;
  isBoarded: boolean;
  counterpart: {
    id?: string;
    name: string;
    email?: string;
    companyName?: string;
    department?: string;
    profileImage?: string;
    employeeId?: string;
  };
  vehicle?: any;
}

interface IFinanceSummary {
  totalDriverEarningsCommitted: number;
  totalDriverCollected: number;
  totalDriverPending: number;
  ridesOfferedCount: number;
  passengersCarriedCount: number;
  totalPassengerCommitted: number;
  totalPassengerSpent: number;
  totalPassengerDue: number;
  carpoolsTakenCount: number;
  netBalance: number;
}

const INITIAL_RIDES_COUNT = 4;

export default function FinancesPage() {
  const [summary, setSummary] = useState<IFinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<IFinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination Toggle
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partially_paid" | "not_paid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllRides, setShowAllRides] = useState(false);

  const fetchFinances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finances");
      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to load financial records.");
      }
      const data = await res.json();
      setSummary(data.summary);
      setTransactions(data.allTransactions || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFinances();
  }, []);

  // Filter only earnings transactions (rides where the employee earned)
  const earnedTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Show only driver earnings
      if (tx.type !== "earning") return false;

      // Status Filter
      if (statusFilter !== "all" && tx.paymentStatus !== statusFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = tx.counterpart?.name?.toLowerCase().includes(q);
        const matchesRoute =
          tx.startingLocation?.toLowerCase().includes(q) ||
          tx.destination?.toLowerCase().includes(q) ||
          tx.pickupStop?.toLowerCase().includes(q) ||
          tx.dropStop?.toLowerCase().includes(q);
        const matchesDept = tx.counterpart?.department?.toLowerCase().includes(q);
        if (!matchesName && !matchesRoute && !matchesDept) return false;
      }

      return true;
    });
  }, [transactions, statusFilter, searchQuery]);

  // Sliced for display: initial 3-4 rides, or all rides when user clicks "All rides"
  const displayedTransactions = useMemo(() => {
    if (showAllRides) return earnedTransactions;
    return earnedTransactions.slice(0, INITIAL_RIDES_COUNT);
  }, [earnedTransactions, showAllRides]);

  // Export to CSV
  const handleExportCSV = () => {
    if (earnedTransactions.length === 0) return;

    const headers = [
      "Transaction ID",
      "Type",
      "Date",
      "Time",
      "Route",
      "Pickup Stop",
      "Drop Stop",
      "Seats",
      "Counterpart Name",
      "Counterpart Department",
      "Total Fare (INR)",
      "Amount Paid (INR)",
      "Remaining Due (INR)",
      "Payment Status",
      "Ride Status",
    ];

    const rows = earnedTransactions.map((tx) => [
      tx.id,
      "Earned Carpool Fare",
      tx.date,
      tx.time,
      `"${tx.startingLocation} -> ${tx.destination}"`,
      `"${tx.pickupStop}"`,
      `"${tx.dropStop}"`,
      tx.seats,
      `"${tx.counterpart?.name || ""}"`,
      `"${tx.counterpart?.department || ""}"`,
      tx.fare,
      tx.amountPaid,
      tx.remainingAmount,
      tx.paymentStatus,
      tx.rideStatus,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `CommuteX_Earnings_Statement_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex h-[450px] w-full items-center justify-center">
        <CarLoader size="lg" message="Loading your commute finances & earnings ledger..." />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="mx-auto max-w-4xl py-12 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
        <h2 className="mt-4 text-lg font-bold text-slate-900">Unable to load financial data</h2>
        <p className="mt-1 text-sm text-slate-500">{error || "Please try again later."}</p>
        <Button onClick={fetchFinances} className="mt-4 bg-emerald-600 hover:bg-emerald-700">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12 animate-in fade-in-50 duration-300 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Earnings & Payouts
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={earnedTransactions.length === 0}
            className="rounded-xl border-slate-200 text-xs font-semibold gap-1.5 shadow-xs hover:bg-slate-50 text-slate-700 h-8 sm:h-9"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </Button>

          <Link href="/rides/offer">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs h-8 sm:h-9">
              Offer a Ride
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards: How the Employee Earned (Compact 2-in-a-row on Mobile) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-3">
        {/* Card 1: Total Earnings Collected */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2 space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Total Fares Collected
            </CardTitle>
            <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
              <IndianRupee className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0">
            <div className="text-lg sm:text-3xl font-bold text-slate-900">
              ₹{summary.totalDriverCollected.toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 truncate">
              From coworker passengers
            </p>
            <div className="mt-1.5 sm:mt-3 pt-1.5 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] text-slate-500">
              <span>Settled:</span>
              <strong className="text-emerald-700 font-bold">100% credited</strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pending to Collect */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2 space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Pending Collection
            </CardTitle>
            <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
              <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0">
            <div className="text-lg sm:text-3xl font-bold text-slate-900">
              ₹{summary.totalDriverPending.toLocaleString()}
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 truncate">
              From completed rides
            </p>
            <div className="mt-1.5 sm:mt-3 pt-1.5 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] text-slate-500">
              <span>Expected:</span>
              <strong className="text-slate-800 font-semibold">₹{summary.totalDriverEarningsCommitted.toLocaleString()}</strong>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Carpool Rides Offered */}
        <Card className="col-span-2 md:col-span-1 rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between p-2.5 sm:p-4 pb-1 sm:pb-2 space-y-0">
            <CardTitle className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
              Rides Offered & Shared
            </CardTitle>
            <div className="flex h-6 w-6 sm:h-8 sm:w-8 items-center justify-center rounded-lg sm:rounded-xl bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
              <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
            </div>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-4 pt-0">
            <div className="text-lg sm:text-3xl font-bold text-slate-900">
              {summary.ridesOfferedCount} <span className="text-xs sm:text-base font-medium text-slate-500">Rides</span>
            </div>
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 truncate">
              Campus carpool trips you drove
            </p>
            <div className="mt-1.5 sm:mt-3 pt-1.5 sm:pt-2.5 border-t border-slate-100 flex items-center justify-between text-[9px] sm:text-[11px] text-slate-500">
              <span>Passengers carried:</span>
              <strong className="text-slate-800 font-semibold">{summary.passengersCarriedCount} coworkers</strong>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rides Where Employee Earned Section */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 sm:p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-emerald-600" />
                Rides Where You Earned
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Carpool trips offered to coworkers showing fares collected and pending
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                {earnedTransactions.length} {earnedTransactions.length === 1 ? "Ride" : "Rides"}
              </span>
            </div>
          </div>

          {/* Search and Payment Status Filter Bar */}
          <div className="mt-3 flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by coworker name, location or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-xl h-8 sm:h-9 border-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 w-full sm:w-auto shrink-0">
              <span className="text-[11px] font-semibold text-slate-500 px-1">Status:</span>
              {(["all", "paid", "partially_paid", "not_paid"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                    statusFilter === st
                      ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {st === "all" ? "All" : st === "paid" ? "Paid" : st === "partially_paid" ? "Partially Paid" : "Unpaid"}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {earnedTransactions.length === 0 ? (
            <div className="py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                <IndianRupee className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">No earnings recorded yet</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "No earned rides match your current search or status filter."
                  : "You haven't earned from carpools yet. Offer a ride to coworkers on your campus commute to start earning fares."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link href="/rides/offer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl shadow-xs">
                    Offer a Ride
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {displayedTransactions.map((tx) => {
                const isPaid = tx.paymentStatus === "paid";
                const isPartiallyPaid = tx.paymentStatus === "partially_paid";

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 sm:px-5 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    {/* Left: Earning Icon & Route Info */}
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-100">
                            Earned Fare
                          </span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {tx.date} at {tx.time}
                          </span>
                        </div>

                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{tx.startingLocation}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          <span>{tx.destination}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                          <span>
                            Received from:{" "}
                            <strong className="text-slate-800 font-semibold">
                              {tx.counterpart?.name || "Coworker"}
                            </strong>
                            {tx.counterpart?.department ? ` (${tx.counterpart.department})` : ""}
                          </span>
                          <span>•</span>
                          <span>
                            Pickup: <strong>{tx.pickupStop}</strong>
                          </span>
                          <span>→</span>
                          <span>
                            Drop: <strong>{tx.dropStop}</strong>
                          </span>
                          <span>•</span>
                          <span>Seats: <strong>{tx.seats}</strong></span>
                          {tx.isBoarded && (
                            <Badge className="bg-emerald-50 text-emerald-700 text-[10px] py-0 px-1.5 border border-emerald-200">
                              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> Boarded
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Amounts & Payment Status Badge */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                      <div className="flex items-center gap-1">
                        <span className="text-base font-bold text-emerald-700">
                          +₹{tx.amountPaid}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">
                          / ₹{tx.fare}
                        </span>
                      </div>

                      <div className="mt-1">
                        {isPaid ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium px-2 py-0.5 gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </Badge>
                        ) : isPartiallyPaid ? (
                          <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-medium px-2 py-0.5 gap-1">
                            <AlertCircle className="h-3 w-3" /> Due: ₹{tx.remainingAmount}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium px-2 py-0.5 gap-1">
                            <X className="h-3 w-3" /> Unpaid
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Toggle Button for All Rides */}
          {earnedTransactions.length > INITIAL_RIDES_COUNT && (
            <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAllRides(!showAllRides)}
                className="text-xs font-bold rounded-xl border-slate-300 text-slate-700 hover:bg-white shadow-xs gap-1.5 h-8 px-4"
              >
                {showAllRides ? (
                  <>Show Recent ({INITIAL_RIDES_COUNT} rides)</>
                ) : (
                  <>All rides ({earnedTransactions.length})</>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
