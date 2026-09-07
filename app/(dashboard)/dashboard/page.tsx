"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Car,
  Search,
  PlusCircle,
  Clock,
  CheckCircle2,
  Users,
  ShieldCheck,
  Building2,
  ArrowRight,
  Leaf,
  Sparkles,
  AlertTriangle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";

interface IVehicleItem {
  _id: string;
  vehicleType: string;
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  availableSeats: number;
  status: "active" | "inactive";
}

interface IUserProfile {
  _id: string;
  name: string;
  employeeId: string;
  email: string;
  department: string;
  role: "employee" | "admin";
  verificationStatus: "pending" | "approved" | "rejected";
  isApproved: boolean;
}

interface ICarbonStats {
  totalCO2SavedKg: number;
  totalVKRKm: number;
  carpoolRidesCount: number;
  averageOccupancy: number;
  averageCO2SavedPerRideKg: number;
  averageCO2SavedPerPassengerKg: number;
  totalActualCarpoolCO2Kg: number;
  totalSoloBaselineCO2Kg: number;
  overallReductionPercentage: number;
  equivalentTreesPlanted: number;
}

export default function DashboardPage() {
  const { data: session, status, update: updateSession } = useSession();
  const [vehicles, setVehicles] = useState<IVehicleItem[]>([]);
  const [userProfile, setUserProfile] = useState<IUserProfile | null>(null);
  const [carbonStats, setCarbonStats] = useState<ICarbonStats | null>(null);
  const [carbonSource, setCarbonSource] = useState<string>("IPCC 2006 / MoEFCC India GHG Platform");
  const [isLoading, setIsLoading] = useState(true);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [vehRes, profRes, carbonRes] = await Promise.all([
          fetch("/api/vehicles"),
          fetch("/api/profile"),
          fetch("/api/carbon/my-impact"),
        ]);

        if (vehRes.ok) {
          const vehData = await vehRes.json();
          setVehicles(vehData.vehicles || []);
        }

        if (profRes.ok) {
          const profData = await profRes.json();
          const prof: IUserProfile = profData.profile;
          setUserProfile(prof);

          // If DB shows approved but local session was still pending, sync session
          if (prof.isApproved && !session?.user?.isApproved) {
            updateSession({
              verificationStatus: "approved",
              isApproved: true,
            });
          }
        }

        if (carbonRes.ok) {
          const cData = await carbonRes.json();
          if (cData.stats) setCarbonStats(cData.stats);
          if (cData.activeEmissionFactorSource) setCarbonSource(cData.activeEmissionFactorSource);
        }
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (session?.user) {
      loadDashboardData();
    }
  }, [session]);

  const firstName = session?.user?.name ? session.user.name.split(" ")[0] : "Colleague";
  
  // Directly read latest live status from MongoDB profile query with fallback to session
  const isApproved =
    userProfile?.isApproved ?? (session?.user?.isApproved || session?.user?.role === "admin");
  const verificationStatus =
    userProfile?.verificationStatus ??
    session?.user?.verificationStatus ??
    (isApproved ? "approved" : "pending");

  const getGreetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  const handleRestrictedAction = (e: React.MouseEvent) => {
    if (!isApproved) {
      e.preventDefault();
      setIsVerificationModalOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      {/* Pending Approval Notice Banner */}
      {!isLoading && !isApproved && (
        <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 text-amber-900 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shrink-0 shadow-xs">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-900">
                  Account Pending Campus Admin Approval
                </h3>
                <Badge className="bg-amber-200 text-amber-900 border-amber-300 text-[10px] uppercase font-bold">
                  Verification Pending
                </Badge>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-2xl">
                Your corporate profile (Emp Id: <strong className="font-mono">{session?.user?.employeeId}</strong>) is currently awaiting verification from the campus mobility administrator. You can register your vehicles and configure your profile. Finding and offering rides will be unlocked upon approval.
              </p>
            </div>
          </div>

          <Link href="/profile">
            <Button size="sm" variant="outline" className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs shrink-0">
              Review Profile
            </Button>
          </Link>
        </div>
      )}

      {/* Personalized Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 mb-3 border border-emerald-500/30">
            <Building2 className="h-3.5 w-3.5" /> Corporate Commute Portal
          </div>

          {status === "loading" ? (
            <Skeleton className="h-9 w-64 bg-slate-700 mb-2" />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {getGreetingTime()}, {firstName}!
            </h1>
          )}

          <p className="mt-2 text-sm sm:text-base text-slate-300 leading-relaxed">
            Ready for your campus commute? Connect with verified coworkers, share daily rides, cut commute expenses, and travel sustainably.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/rides/find" onClick={handleRestrictedAction}>
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold gap-2 shadow-sm">
                <Search className="h-4 w-4" /> Find a Ride
                {!isApproved && <Lock className="h-3.5 w-3.5 ml-1 text-slate-900 opacity-70" />}
              </Button>
            </Link>
            <Link href="/rides/offer" onClick={handleRestrictedAction}>
              <Button
                variant="outline"
                className="border-slate-700 bg-slate-800/80 text-white hover:bg-slate-700 hover:text-white gap-2"
              >
                <PlusCircle className="h-4 w-4" /> Offer a Ride
                {!isApproved && <Lock className="h-3.5 w-3.5 ml-1 text-slate-400" />}
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Account Statistics Row */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Commute Overview
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Registered Vehicles */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500">
                Registered Vehicles
              </CardTitle>
              <Car className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">{vehicles.length}</div>
              )}
              <p className="text-[11px] text-slate-500 mt-1">Available for carpooling</p>
            </CardContent>
          </Card>

          {/* Upcoming Rides */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500">
                Upcoming Rides
              </CardTitle>
              <Clock className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">0</div>
              <p className="text-[11px] text-slate-500 mt-1">Scheduled for this week</p>
            </CardContent>
          </Card>

          {/* Completed Rides */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500">
                Completed Rides
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">
                  {carbonStats?.carpoolRidesCount || 0}
                </div>
              )}
              <p className="text-[11px] text-slate-500 mt-1">Total trips completed</p>
            </CardContent>
          </Card>

          {/* Verification Status Card */}
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-xs font-medium text-slate-500">
                Account Status
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {isApproved ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold">
                  Verified & Active
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs font-bold">
                  Pending Admin Approval
                </Badge>
              )}
              <p className="text-[11px] text-slate-500 mt-1.5">
                {isApproved ? "Full campus ride access" : "Awaiting admin confirmation"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MY ENVIRONMENTAL IMPACT SECTION */}
      <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 shadow-xs">
        <CardHeader className="pb-3 border-b border-emerald-100/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <Leaf className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                My Environmental Impact
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Quantitative sustainability metrics from your completed carpool rides
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] font-semibold border-emerald-300 text-emerald-800 bg-emerald-100/50 w-fit">
            Research-Grade Carbon Model
          </Badge>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Estimated CO2 Avoided */}
            <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Estimated CO₂ Avoided
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-0.5">
                {isLoading ? <Skeleton className="h-7 w-16" /> : `${carbonStats?.totalCO2SavedKg ?? 0} kg`}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">
                vs Solo Commute Baseline
              </span>
            </div>

            {/* Vehicle-Km Reduced */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Vehicle-Km Reduced (VKR)
              </span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {isLoading ? <Skeleton className="h-7 w-16" /> : `${carbonStats?.totalVKRKm ?? 0} km`}
              </div>
              <span className="text-[10px] text-slate-500">
                Road congestion saved
              </span>
            </div>

            {/* Carpool Rides Completed */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Carpool Trips
              </span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {isLoading ? <Skeleton className="h-7 w-12" /> : (carbonStats?.carpoolRidesCount ?? 0)}
              </div>
              <span className="text-[10px] text-slate-500">
                Driver + Passenger rides
              </span>
            </div>

            {/* Average Occupancy */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[11px] font-medium text-slate-500 block">
                Average Occupancy
              </span>
              <div className="text-2xl font-black text-slate-900 mt-0.5">
                {isLoading ? <Skeleton className="h-7 w-12" /> : (carbonStats?.averageOccupancy ? `${carbonStats.averageOccupancy}` : "1.0")}
              </div>
              <span className="text-[10px] text-slate-500">
                Persons per vehicle
              </span>
            </div>
          </div>

          {/* Secondary stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-100 text-xs text-slate-600">
            <div>
              <span className="text-[10px] text-slate-400 block">Avg CO₂ Saved/Ride</span>
              <span className="font-semibold text-slate-800">{carbonStats?.averageCO2SavedPerRideKg ?? 0} kg</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Avg CO₂ Saved/Passenger</span>
              <span className="font-semibold text-slate-800">{carbonStats?.averageCO2SavedPerPassengerKg ?? 0} kg</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CO₂ Reduction %</span>
              <span className="font-semibold text-emerald-700">{carbonStats?.overallReductionPercentage ?? 0}%</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Tree Equivalent</span>
              <span className="font-semibold text-emerald-800">~{carbonStats?.equivalentTreesPlanted ?? 0} trees/yr</span>
            </div>
          </div>

          {/* Methodology & Transparency Note */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
            <span className="text-emerald-700 font-bold shrink-0">Methodology:</span>
            <span>
              Values represent <strong>estimated CO₂ avoided</strong> calculated using individual passenger solo travel distances minus actual physical carpool vehicle distance multiplied by configured emission factors (<em>{carbonSource}</em>). Values are computational estimates rather than direct tailpipe sensor measurements.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid: Registered Vehicles & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Vehicles Summary (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">My Vehicles</h2>
              <p className="text-xs text-slate-500">
                Manage your registered vehicles to offer rides to colleagues
              </p>
            </div>
            <Link href="/vehicles">
              <Button size="sm" variant="outline" className="gap-1 text-xs">
                Manage All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-slate-200">
              <CarLoader size="md" message="Loading your vehicles..." />
            </div>
          ) : vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="No vehicle added yet"
              description="Add your car or two-wheeler to start offering rides to colleagues heading to campus."
              actionLabel="Add Vehicle"
              onAction={() => {
                window.location.href = "/vehicles";
              }}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {vehicles.slice(0, 2).map((vehicle) => (
                <Card key={vehicle._id} className="border-slate-200 hover:border-slate-300 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-[11px]">
                        {vehicle.vehicleType}
                      </Badge>
                      <Badge
                        variant={vehicle.status === "active" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {vehicle.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold mt-1">
                      {vehicle.vehicleModel}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs text-slate-600">
                      {vehicle.registrationNumber}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 text-xs text-slate-500">
                    <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-1">
                      <span>Capacity: {vehicle.seatingCapacity} seats</span>
                      <span className="font-medium text-emerald-700">
                        {vehicle.availableSeats} offerable seats
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Corporate Trust & Commute Guidelines (1 col) */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Campus Mobility</h2>
          <Card className="border-slate-200 bg-slate-900 text-white">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                <Sparkles className="h-4 w-4" /> CommuteX Benefits
              </div>
              <CardTitle className="text-base font-semibold text-white">
                Campus Verification Policy
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin Verified:</strong> Only approved employees with valid company IDs can participate in rides.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Leaf className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Eco Commute:</strong> Shared rides directly cut down fuel expenses, traffic congestion, and carbon footprint.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Users className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Internal Trust:</strong> Travel comfortably knowing all carpool participants belong to your campus.
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* VERIFICATION REQUIRED MODAL */}
      <Dialog open={isVerificationModalOpen} onOpenChange={setIsVerificationModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-3">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold text-slate-900">
              Campus Admin Approval Required
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-slate-600 pt-2 leading-relaxed">
              Your employee profile (Emp Id: <strong>{session?.user?.employeeId}</strong>) is currently pending review by the campus administrator.
              <br /><br />
              Finding and offering rides will be unlocked immediately once your identity is approved. You can continue adding your vehicle and editing your commute preferences in the meantime.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="sm:justify-center pt-3">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 font-bold w-full sm:w-auto"
              onClick={() => setIsVerificationModalOpen(false)}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
