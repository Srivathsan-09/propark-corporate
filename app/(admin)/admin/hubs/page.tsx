"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Compass,
  Plus,
  Search,
  MapPin,
  Route,
  Users,
  Car,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Eye,
  Edit3,
  Trash2,
  Power,
  Building2,
  Map as MapIcon,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

interface IHubItem {
  _id: string;
  hubId: string;
  name: string;
  corridor: string;
  origin: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
  };
  campusId: string;
  campusName: string;
  distanceKm: number;
  durationMinutes: number;
  status: "active" | "inactive";
  activeRidesCount: number;
  commutersCount: number;
  createdAt: string;
}

export default function CommuteHubAdminDashboard() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<IHubItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  const fetchHubs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commutehub/hubs");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to load hubs.");
      }
      const data = await res.json();
      setHubs(data.hubs || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHubs();
  }, []);

  // Status toggle handler
  const handleToggleStatus = async (hub: IHubItem) => {
    const nextStatus = hub.status === "active" ? "inactive" : "active";
    setActionLoadingId(hub._id);
    try {
      const res = await fetch(`/api/commutehub/hubs/${hub._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to update hub status.");
      }
      setHubs((prev) =>
        prev.map((h) => (h._id === hub._id ? { ...h, status: nextStatus } : h))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Delete hub handler
  const handleDeleteHub = async (hub: IHubItem) => {
    if (hub.activeRidesCount > 0) {
      alert(`Cannot delete ${hub.name} because it has ${hub.activeRidesCount} active scheduled rides. Deactivate it instead.`);
      return;
    }
    const confirmDelete = confirm(`Are you sure you want to delete "${hub.name} (${hub.corridor})"?`);
    if (!confirmDelete) return;

    setActionLoadingId(hub._id);
    try {
      const res = await fetch(`/api/commutehub/hubs/${hub._id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to delete hub.");
      }
      setHubs((prev) => prev.filter((h) => h._id !== hub._id));
    } catch (err: any) {
      alert(err.message || "Failed to delete hub.");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filtered hubs
  const filteredHubs = useMemo(() => {
    return hubs.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = h.name.toLowerCase().includes(q);
        const matchesCorridor = h.corridor.toLowerCase().includes(q);
        const matchesOrigin = h.origin?.name.toLowerCase().includes(q);
        const matchesDest = h.destination?.name.toLowerCase().includes(q);
        const matchesCampus = h.campusName.toLowerCase().includes(q) || h.campusId.toLowerCase().includes(q);
        if (!matchesName && !matchesCorridor && !matchesOrigin && !matchesDest && !matchesCampus) {
          return false;
        }
      }
      return true;
    });
  }, [hubs, statusFilter, searchQuery]);

  // KPIs
  const totalHubsCount = hubs.length;
  const activeHubsCount = hubs.filter((h) => h.status === "active").length;
  const totalActiveRides = hubs.reduce((sum, h) => sum + (h.activeRidesCount || 0), 0);
  const totalCommuters = hubs.reduce((sum, h) => sum + (h.commutersCount || 0), 0);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <CarLoader size="page" message="Loading CommuteHub Management Console..." />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in-50 duration-300 max-w-7xl mx-auto">
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
              <Compass className="h-4 w-4 text-emerald-600" />
              CommuteHub
            </h1>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5">
              Virtual Corridors
            </Badge>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isSuperAdmin
              ? "Oversee and configure multi-campus virtual commuting hubs across all corridors."
              : `Manage commuting corridors and hubs for ${session?.user?.campusName || "your campus"}.`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/map">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 h-8">
              <MapIcon className="h-3.5 w-3.5 text-slate-500" />
              Hub Map
            </Button>
          </Link>
          <Link href="/admin/hubs/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-2xs h-8">
              <Plus className="h-3.5 w-3.5" />
              Create Hub
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Hubs
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              {totalHubsCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Registered virtual corridors
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Active: <strong className="text-emerald-700">{activeHubsCount}</strong></span>
              <span>Inactive: <strong className="text-slate-700">{totalHubsCount - activeHubsCount}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Corridors
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Route className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-emerald-700">
              {activeHubsCount}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Currently open for employee rides
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Availability</span>
              <span className="font-semibold text-emerald-700">
                {totalHubsCount > 0 ? `${Math.round((activeHubsCount / totalHubsCount) * 100)}% active` : "0%"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Hub Rides
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Car className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              {totalActiveRides}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Scheduled rides under hubs
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Corridors in use</span>
              <span className="font-semibold text-slate-800">
                {hubs.filter((h) => h.activeRidesCount > 0).length} hubs
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Participating Commuters
            </CardTitle>
            <div className="h-8 w-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-slate-900">
              {totalCommuters}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Drivers & passengers in hubs
            </p>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Campus network</span>
              <span className="font-semibold text-slate-800">CommuteHub Active</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Hub Directory & Search Bar */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-500" />
                Manage Virtual Hubs
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                Configure origin, destination, and active state of commuting corridors
              </CardDescription>
            </div>

            {/* Status Filter Buttons */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition-all ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                All ({hubs.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-lg px-3 py-1.5 transition-all flex items-center gap-1 ${
                  statusFilter === "active" ? "bg-white text-emerald-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Active ({hubs.filter((h) => h.status === "active").length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`rounded-lg px-3 py-1.5 transition-all flex items-center gap-1 ${
                  statusFilter === "inactive" ? "bg-white text-slate-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                <XCircle className="h-3.5 w-3.5 text-slate-400" />
                Inactive ({hubs.filter((h) => h.status === "inactive").length})
              </button>
            </div>
          </div>

          {/* Search Input Bar */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search by hub name (e.g. Hub 1), corridor, landmark, or campus..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9 border-slate-200"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredHubs.length === 0 ? (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-sm font-bold text-slate-900">No hubs found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Try resetting your search query or status filter to see all registered corridors."
                  : "No commuting hubs have been created yet. Click below to add your first hub corridor."}
              </p>
              <div className="mt-5">
                <Link href="/admin/hubs/create">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold rounded-xl gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Create First Hub
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredHubs.map((hub) => {
                const isActive = hub.status === "active";
                const isWorking = actionLoadingId === hub._id;

                return (
                  <div
                    key={hub._id}
                    className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    {/* Left: Hub Information */}
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${
                          isActive
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-100 text-slate-400 border-slate-200"
                        }`}
                      >
                        <Compass className="h-5 w-5 stroke-[2]" />
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">
                            {hub.name}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="text-slate-600 font-semibold text-xs">
                            {hub.corridor}
                          </span>
                          <Badge
                            className={`text-[10px] font-semibold py-0 px-2 rounded-full border ${
                              isActive
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] py-0 border-slate-200 text-slate-500">
                            {hub.hubId}
                          </Badge>
                        </div>

                        {/* Origin and Destination Line */}
                        <div className="flex flex-wrap items-center gap-2 text-slate-600 pt-0.5">
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="h-3 w-3 text-emerald-600" />
                            {hub.origin.name}
                          </span>
                          <ArrowRight className="h-3 w-3 text-slate-400" />
                          <span className="flex items-center gap-1 font-medium">
                            <MapPin className="h-3 w-3 text-rose-600" />
                            {hub.destination.name}
                          </span>
                        </div>

                        {/* Campus, Distance & Time Meta */}
                        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <strong>{hub.campusName}</strong> ({hub.campusId})
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Route className="h-3 w-3 text-slate-400" />
                            {hub.distanceKm} km
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            ~{hub.durationMinutes} mins
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Metrics & Actions */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      {/* Active Rides Badge */}
                      <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                        <Car className="h-3.5 w-3.5 text-indigo-600" />
                        <span className="text-xs font-semibold text-slate-700">
                          {hub.activeRidesCount} {hub.activeRidesCount === 1 ? "Ride" : "Rides"}
                        </span>
                        <span className="text-slate-300">•</span>
                        <Users className="h-3.5 w-3.5 text-purple-600" />
                        <span className="text-xs font-medium text-slate-500">
                          {hub.commutersCount} Commuters
                        </span>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        <Link href={`/admin/hubs/${hub._id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-8 px-2.5 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                            title="View Hub Details & Rides"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>

                        <Link href={`/admin/hubs/${hub._id}/edit`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl h-8 px-2.5 text-xs font-semibold border-slate-200 text-blue-700 hover:bg-blue-50 gap-1"
                            title="Edit Corridor Hub"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                        </Link>

                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isWorking}
                          onClick={() => handleToggleStatus(hub)}
                          className={`rounded-xl h-8 px-2.5 text-xs font-semibold border gap-1 transition-all ${
                            isActive
                              ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                              : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                          }`}
                          title={isActive ? "Deactivate Hub" : "Activate Hub"}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {isActive ? "Deactivate" : "Activate"}
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isWorking || hub.activeRidesCount > 0}
                          onClick={() => handleDeleteHub(hub)}
                          className="rounded-xl h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title={hub.activeRidesCount > 0 ? "Cannot delete hub with active rides" : "Delete Hub"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
