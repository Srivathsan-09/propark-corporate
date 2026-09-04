"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  IndianRupee,
  Wallet,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  ArrowUpRight,
  ArrowDownLeft,
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
  estimatedSoloCost: number;
  savingsVsSoloCab: number;
}

export default function FinancesPage() {
  const [summary, setSummary] = useState<IFinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<IFinancialTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState<"all" | "earnings" | "spendings">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "paid" | "partially_paid" | "not_paid">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchFinances = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finances");
      if (!res.ok) {
        throw new Error("Failed to load financial records.");
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

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // Type Tab Filter
      if (activeTab === "earnings" && tx.type !== "earning") return false;
      if (activeTab === "spendings" && tx.type !== "spending") return false;

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
  }, [transactions, activeTab, statusFilter, searchQuery]);

  // Export to CSV
  const handleExportCSV = () => {
    if (transactions.length === 0) return;

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

    const rows = filteredTransactions.map((tx) => [
      tx.id,
      tx.type === "earning" ? "Driver Earning" : "Carpool Expense",
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
      `CommuteX_Financial_Statement_${new Date().toISOString().split("T")[0]}.csv`
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

  const isNetProfit = summary.netBalance >= 0;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Finances
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track your carpool earnings, travel expenses, and payment records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={transactions.length === 0}
            className="rounded-xl border-slate-200 text-xs font-semibold gap-1.5 shadow-xs hover:bg-slate-50 text-slate-700"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            Export CSV
          </Button>

          <Link href="/rides/offer">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-xs">
              Offer a Ride
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards: Driver Earnings, Carpool Spendings, Net Balance */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Card 1: Driver Earnings */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Driver Earnings
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              ₹{summary.totalDriverCollected.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total collected from coworkers
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Pending: <strong className="text-slate-800 font-semibold">₹{summary.totalDriverPending.toLocaleString()}</strong></span>
              <span>{summary.passengersCarriedCount} passengers ({summary.ridesOfferedCount} rides)</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Carpool Spendings */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Carpool Spendings
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              ₹{summary.totalPassengerSpent.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Total spent on shared rides
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Due to drivers: <strong className="text-slate-800 font-semibold">₹{summary.totalPassengerDue.toLocaleString()}</strong></span>
              <span>{summary.carpoolsTakenCount} rides taken</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Net Balance */}
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Balance
            </CardTitle>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-bold ${isNetProfit && summary.netBalance > 0 ? "text-emerald-700" : "text-slate-900"}`}>
              {isNetProfit && summary.netBalance > 0 ? "+" : ""}₹{summary.netBalance.toLocaleString()}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Driver earnings minus passenger spendings
            </p>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className={`font-semibold ${isNetProfit ? "text-emerald-700" : "text-slate-700"}`}>
                {isNetProfit ? "Positive cashflow" : "Net spending"}
              </span>
              <span>{summary.ridesOfferedCount + summary.carpoolsTakenCount} total rides</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment History & Activity Section */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-500" />
                Payment History
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Detailed record of fares received and paid
              </CardDescription>
            </div>

            {/* Tab switchers */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                All ({transactions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("earnings")}
                className={`rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                  activeTab === "earnings" ? "bg-white text-emerald-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />
                Driver Earnings ({transactions.filter((t) => t.type === "earning").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("spendings")}
                className={`rounded-lg px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                  activeTab === "spendings" ? "bg-white text-indigo-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                <ArrowDownLeft className="h-3.5 w-3.5 text-indigo-600" />
                Carpool Spendings ({transactions.filter((t) => t.type === "spending").length})
              </button>
            </div>
          </div>

          {/* Search and Payment Status Filter Bar */}
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5 pt-1">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by coworker name, location or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9 border-slate-200"
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
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  statusFilter === "all"
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("paid")}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  statusFilter === "paid"
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                }`}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("partially_paid")}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  statusFilter === "partially_paid"
                    ? "bg-amber-700 text-white border-amber-700"
                    : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
                }`}
              >
                Partially Paid
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("not_paid")}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-all ${
                  statusFilter === "not_paid"
                    ? "bg-slate-700 text-white border-slate-700"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                }`}
              >
                Unpaid
              </button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <IndianRupee className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">No transactions found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all" || activeTab !== "all"
                  ? "Try resetting your search or payment filters to see all records."
                  : "You have not completed any paid rides or carpools yet. Offer a ride or book a seat to start tracking finances."}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Link href="/rides/offer">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl">
                    Offer a Ride
                  </Button>
                </Link>
                <Link href="/rides/find">
                  <Button size="sm" variant="outline" className="text-xs font-bold rounded-xl border-slate-200">
                    Find a Ride
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isEarning = tx.type === "earning";
                const isPaid = tx.paymentStatus === "paid";
                const isPartiallyPaid = tx.paymentStatus === "partially_paid";

                return (
                  <div
                    key={tx.id}
                    className="p-4 sm:px-6 hover:bg-slate-50/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    {/* Left: Transaction Type & Route Info */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isEarning
                            ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {isEarning ? (
                          <ArrowUpRight className="h-5 w-5 stroke-[2]" />
                        ) : (
                          <ArrowDownLeft className="h-5 w-5 stroke-[2]" />
                        )}
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold text-[11px] px-2 py-0.5 rounded-md ${
                              isEarning
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-100"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {isEarning ? "Driver" : "Passenger"}
                          </span>
                          <span className="text-[11px] text-slate-400">•</span>
                          <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {tx.date} at {tx.time}
                          </span>
                        </div>

                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 pt-0.5">
                          <span>{tx.startingLocation}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          <span>{tx.destination}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 pt-0.5">
                          <span>
                            {isEarning ? "Received from" : "Paid to"}:{" "}
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
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-base font-bold ${
                            isEarning ? "text-emerald-700" : "text-slate-900"
                          }`}
                        >
                          {isEarning ? "+" : "-"}₹{tx.amountPaid}
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
                          <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium px-2 py-0.5 gap-1">
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
        </CardContent>
      </Card>
    </div>
  );
}
