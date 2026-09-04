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
  Filter,
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

export default function ManageHubsPage() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<IHubItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [campusFilter, setCampusFilter] = useState<string>("all");
  const [campusesList, setCampusesList] = useState<Array<{ campusId: string; name: string }>>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.role === "admin";

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
      const loadedHubs: IHubItem[] = data.hubs || [];
      setHubs(loadedHubs);

      // Extract unique campuses for Super Admin filter
      const uniqueCampuses: Array<{ campusId: string; name: string }> = [];
      const seen = new Set<string>();
      loadedHubs.forEach((h) => {
        if (!seen.has(h.campusId)) {
          seen.add(h.campusId);
          uniqueCampuses.push({ campusId: h.campusId, name: h.campusName || h.campusId });
        }
      });
      setCampusesList(uniqueCampuses);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHubs();
  }, []);

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

  const handleDeleteHub = async (hub: IHubItem) => {
    if (hub.activeRidesCount > 0) {
      alert(`Cannot delete ${hub.name} because it has ${hub.activeRidesCount} active scheduled rides.`);
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

  const filteredHubs = useMemo(() => {
    return hubs.filter((h) => {
      if (statusFilter !== "all" && h.status !== statusFilter) return false;
      if (campusFilter !== "all" && h.campusId.toLowerCase() !== campusFilter.toLowerCase()) return false;
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
  }, [hubs, statusFilter, campusFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center">
        <CarLoader size="page" message="Loading Hubs Directory..." />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto animate-in fade-in-50 duration-300">
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
            <Compass className="h-4 w-4 text-emerald-600" />
            Manage Hubs
          </h1>
          <p className="text-[11px] text-slate-500">
            {isSuperAdmin
              ? "Directory of all commuting hub corridors across campuses"
              : `Commuting corridors registered for your campus (${session?.user?.campusName || "Campus"})`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/map">
            <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold gap-1.5 border-slate-200 h-8">
              <MapIcon className="h-3.5 w-3.5 text-slate-500" />
              View Map
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

      {/* Filter and Search Toolbar */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search hubs by name, corridor (e.g. Poonamallee → Porur) or area..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9 border-slate-200"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Super Admin Campus Filter */}
            {isSuperAdmin && campusesList.length > 0 && (
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 h-9"
              >
                <option value="all">All Campuses</option>
                {campusesList.map((c) => (
                  <option key={c.campusId} value={c.campusId}>
                    {c.name} ({c.campusId})
                  </option>
                ))}
              </select>
            )}

            {/* Status Selector */}
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-medium text-slate-600 h-9 items-center">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  statusFilter === "all" ? "bg-white text-slate-900 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  statusFilter === "active" ? "bg-white text-emerald-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`rounded-lg px-2.5 py-1 transition-all ${
                  statusFilter === "inactive" ? "bg-white text-slate-800 shadow-xs font-semibold" : "hover:text-slate-900"
                }`}
              >
                Inactive
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Hub Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredHubs.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-slate-200">
            <Compass className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-4 text-sm font-bold text-slate-900">No hubs match the selected filters</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Reset your search query or campus filter to view all registered commuting corridors.
            </p>
          </div>
        ) : (
          filteredHubs.map((hub) => {
            const isActive = hub.status === "active";
            const isWorking = actionLoadingId === hub._id;

            return (
              <Card
                key={hub._id}
                className="rounded-2xl border-slate-200/90 bg-white shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900">
                          {hub.name}
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
                      </div>
                      <p className="text-xs font-semibold text-slate-600 mt-0.5">
                        {hub.corridor}
                      </p>
                    </div>

                    <Badge variant="outline" className="text-[10px] py-0 border-slate-200 text-slate-400 font-mono">
                      {hub.hubId}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-3.5">
                  {/* Origin & Destination */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">Origin: <strong>{hub.origin.name}</strong></span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span className="truncate">Destination: <strong>{hub.destination.name}</strong></span>
                    </div>
                  </div>

                  {/* Corridor Metrics */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                    <div className="rounded-lg bg-slate-50/70 p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Distance</span>
                      <strong className="text-slate-800 text-xs font-bold">{hub.distanceKm} km</strong>
                    </div>
                    <div className="rounded-lg bg-slate-50/70 p-2 border border-slate-100">
                      <span className="text-[10px] text-slate-400 block font-semibold uppercase">Time</span>
                      <strong className="text-slate-800 text-xs font-bold">~{hub.durationMinutes}m</strong>
                    </div>
                    <div className="rounded-lg bg-emerald-50/60 p-2 border border-emerald-100">
                      <span className="text-[10px] text-emerald-700 block font-semibold uppercase">Rides</span>
                      <strong className="text-emerald-800 text-xs font-bold">{hub.activeRidesCount} active</strong>
                    </div>
                  </div>

                  {/* Campus Info */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                    <Building2 className="h-3 w-3 text-slate-400" />
                    <span>Campus: <strong>{hub.campusName}</strong></span>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    <Link href={`/admin/hubs/${hub._id}`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 gap-1"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Button>
                    </Link>

                    <Link href={`/admin/hubs/${hub._id}/edit`} className="flex-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl text-xs font-bold border-slate-200 text-blue-700 hover:bg-blue-50 gap-1"
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
                      className={`rounded-xl text-xs font-semibold border transition-all ${
                        isActive
                          ? "border-amber-200 text-amber-800 hover:bg-amber-50"
                          : "border-emerald-200 text-emerald-800 hover:bg-emerald-50"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5 mr-1" />
                      {isActive ? "Deactivate" : "Activate"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isWorking || hub.activeRidesCount > 0}
                      onClick={() => handleDeleteHub(hub)}
                      className="rounded-xl h-9 w-9 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title={hub.activeRidesCount > 0 ? "Cannot delete hub with active rides" : "Delete Hub"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
