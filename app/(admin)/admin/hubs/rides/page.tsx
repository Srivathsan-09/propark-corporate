"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Car,
  Route,
  Search,
  Calendar,
  Clock,
  IndianRupee,
  Users,
  ArrowLeft,
  Building2,
  Filter,
  CheckCircle2,
  AlertCircle,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

export default function AdminHubRidesPage() {
  const { data: session } = useSession();
  const [rides, setRides] = useState<any[]>([]);
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedHub, setSelectedHub] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchHubsAndRides();
  }, []);

  const fetchHubsAndRides = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch available hubs for filter dropdown
      const hubsRes = await fetch("/api/commutehub/hubs");
      const hubsData = await hubsRes.json();
      if (hubsData.success) {
        setHubs(hubsData.hubs || []);
      }

      // 2. Fetch all hub rides
      const ridesRes = await fetch("/api/commutehub/rides");
      const ridesData = await ridesRes.json();
      if (!ridesRes.ok || !ridesData.success) {
        throw new Error(ridesData.error || "Failed to load corridor rides.");
      }

      setRides(ridesData.rides || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load corridor rides.");
    } finally {
      setLoading(false);
    }
  };

  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      // Hub filter
      if (selectedHub !== "all") {
        const rideHubId = ride.hubId?._id || ride.hubId?.hubId || ride.hubId;
        if (rideHubId !== selectedHub) return false;
      }

      // Status filter
      if (selectedStatus !== "all" && ride.status !== selectedStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const driverName = (ride.driver?.name || "").toLowerCase();
        const driverDept = (ride.driver?.department || "").toLowerCase();
        const vehiclePlate = (ride.vehicle?.registrationNumber || "").toLowerCase();
        const corridor = (ride.hubId?.corridor || "").toLowerCase();
        const hubName = (ride.hubId?.name || "").toLowerCase();

        return (
          driverName.includes(query) ||
          driverDept.includes(query) ||
          vehiclePlate.includes(query) ||
          corridor.includes(query) ||
          hubName.includes(query)
        );
      }

      return true;
    });
  }, [rides, selectedHub, selectedStatus, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Loading Corridor Rides..." />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* Compact Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Link href="/admin/hubs">
            <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
              <Car className="h-4 w-4 text-emerald-600" />
              CommuteHub Corridor Rides
            </h1>
            <p className="text-[11px] text-slate-500">
              Monitor and manage employee carpooling rides scheduled across virtual corridors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/create">
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-2xs font-semibold">
              <Route className="h-3.5 w-3.5" />
              New Hub Corridor
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search driver, vehicle plate, or corridor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 rounded-xl text-xs border-slate-200"
              />
            </div>

            {/* Hub Selector */}
            <div>
              <select
                value={selectedHub}
                onChange={(e) => setSelectedHub(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-xs focus:border-emerald-500 focus:outline-hidden"
              >
                <option value="all">All Corridors ({hubs.length})</option>
                {hubs.map((hub) => (
                  <option key={hub._id} value={hub._id}>
                    {hub.name} ({hub.corridor})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Selector */}
            <div>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 shadow-xs focus:border-emerald-500 focus:outline-hidden"
              >
                <option value="all">All Ride Statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rides Table / List */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <span>Matching Corridor Rides</span>
              <Badge variant="outline" className="text-[10px] text-emerald-700">
                {filteredRides.length} Total
              </Badge>
            </CardTitle>
            <CardDescription className="text-[11px] text-slate-500">
              Rides scheduled along established corridor routes
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredRides.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No corridor rides found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Try clearing filters or check back when employees post new scheduled rides.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRides.map((ride) => {
                const hubData = ride.hubId || ride.hub;
                return (
                  <div
                    key={ride._id}
                    className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Left: Driver info & Corridor */}
                    <div className="flex items-start gap-3.5">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                        {ride.driver?.name?.charAt(0) || "D"}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            {ride.driver?.name || "Corporate Driver"}
                          </span>
                          {ride.driver?.department && (
                            <Badge variant="outline" className="text-[10px] text-slate-600">
                              {ride.driver.department}
                            </Badge>
                          )}
                          <Badge
                            className={
                              ride.status === "scheduled"
                                ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                                : ride.status === "in_progress"
                                ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                                : ride.status === "completed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                                : "bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
                            }
                            variant="outline"
                          >
                            {ride.status}
                          </Badge>
                        </div>

                        {/* Corridor Info */}
                        {hubData && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <span className="font-semibold text-emerald-700 flex items-center gap-1">
                              <Route className="h-3.5 w-3.5" />
                              {hubData.name}:
                            </span>
                            <span className="text-slate-600">{hubData.corridor}</span>
                          </div>
                        )}

                        {/* Vehicle & Date */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 mt-1.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {ride.departureDate} at {ride.departureTime}
                          </span>
                          <span>•</span>
                          <span>
                            {ride.vehicle?.vehicleModel || "Vehicle"} (
                            {ride.vehicle?.registrationNumber || "Reg"})
                          </span>
                          <span>•</span>
                          <span className="font-medium text-slate-700">
                            {ride.availableSeats} open seats ({ride.totalSeats} total)
                          </span>
                          {ride.pricePerSeat > 0 && (
                            <>
                              <span>•</span>
                              <span className="font-bold text-slate-900 flex items-center">
                                <IndianRupee className="h-3 w-3" />
                                {ride.pricePerSeat}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {hubData?._id && (
                        <Link href={`/admin/hubs/${hubData._id}`}>
                          <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Corridor Hub
                          </Button>
                        </Link>
                      )}
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
