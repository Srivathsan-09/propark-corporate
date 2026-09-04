"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Map as MapIcon,
  Route,
  Plus,
  Compass,
  ArrowLeft,
  Building2,
  Layers,
  Search,
  CheckCircle2,
  Eye,
  Car,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";
import type { IHubMapItem } from "@/components/map/MultiHubMap";

const MultiHubMap = dynamic(() => import("@/components/map/MultiHubMap"), {
  ssr: false,
});

export default function AdminMultiHubMapPage() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<IHubMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCampus, setSelectedCampus] = useState<string>("all");
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";

  useEffect(() => {
    fetchHubs();
  }, [selectedCampus]);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const url =
        selectedCampus !== "all"
          ? `/api/commutehub/hubs?campusId=${encodeURIComponent(selectedCampus)}`
          : `/api/commutehub/hubs`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load hubs.");
      }

      setHubs(data.hubs || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load hubs map.");
    } finally {
      setLoading(false);
    }
  };

  const campuses = useMemo(() => {
    const map = new Map<string, string>();
    hubs.forEach((h) => {
      if (h.campusId && h.campusName) {
        map.set(h.campusId, h.campusName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [hubs]);

  const filteredHubs = useMemo(() => {
    return hubs.filter((hub) => {
      const matchesSearch =
        hub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.corridor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.origin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hub.destination.name.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesSearch;
    });
  }, [hubs, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Rendering Hub Network Map..." />
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-7xl mx-auto">
      {/* Compact Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Link href="/admin/hubs">
            <Button variant="outline" size="sm" className="rounded-xl h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-slate-900 shadow-2xs">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center gap-1.5 leading-tight">
              <MapIcon className="h-4 w-4 text-emerald-600" />
              Global Multi-Hub Corridor Map
            </h1>
            <p className="text-[11px] text-slate-500">
              Bird’s-eye geographic visualization of all active corporate commuting corridors
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/create">
            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Create Hub
            </Button>
          </Link>
          <Link href="/admin/hubs/manage">
            <Button variant="outline" size="sm" className="h-8 rounded-xl text-xs gap-1.5 border-slate-200 text-slate-700">
              <Layers className="h-3.5 w-3.5" />
              Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Single-Screen Grid: Directory (4 cols) + Map (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Left Column: Corridor Selector & Filters */}
        <div className="lg:col-span-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs overflow-hidden h-[490px] flex flex-col">
            <CardHeader className="p-3.5 pb-2 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-slate-900">
                  Corridor Directory
                </CardTitle>
                <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-200">
                  {filteredHubs.length} Hubs
                </Badge>
              </div>
              <CardDescription className="text-[11px] text-slate-500">
                Click a corridor to highlight on map
              </CardDescription>

              {/* Campus filter for super admin */}
              {isSuperAdmin && campuses.length > 0 && (
                <div className="mt-2">
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs focus:border-emerald-500 focus:outline-hidden h-8"
                  >
                    <option value="all">All Campuses</option>
                    {campuses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Search Box */}
              <div className="relative mt-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Filter corridors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7.5 h-8 rounded-xl text-xs border-slate-200"
                />
              </div>
            </CardHeader>

            {/* Scrollable list inside the fixed height card */}
            <CardContent className="p-2 flex-1 overflow-y-auto space-y-1.5">
              {filteredHubs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  No corridors match your filter.
                </div>
              ) : (
                filteredHubs.map((hub) => {
                  const isSelected = selectedHubId === hub._id;
                  return (
                    <div
                      key={hub._id}
                      onClick={() => setSelectedHubId(isSelected ? null : hub._id)}
                      className={`cursor-pointer rounded-xl p-2.5 border text-xs transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 shadow-2xs"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900 truncate">{hub.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            hub.status === "active"
                              ? "text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0"
                              : "text-[9px] bg-slate-100 text-slate-600 border-slate-200 shrink-0"
                          }
                        >
                          {hub.status}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1 truncate">
                        <span>{hub.origin.name}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span>{hub.destination.name}</span>
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 border-t border-slate-100/80 pt-1">
                        <span>{hub.distanceKm} km (~{hub.durationMinutes}m)</span>
                        <span className="font-medium text-emerald-700">
                          {hub.activeRidesCount || 0} rides
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Interactive Multi-Hub Map */}
        <div className="lg:col-span-8">
          <MultiHubMap
            hubs={filteredHubs}
            selectedHubId={selectedHubId}
            onSelectHub={(hub) => setSelectedHubId(hub ? hub._id : null)}
            height="490px"
            viewMode="admin"
          />
        </div>
      </div>
    </div>
  );
}
