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
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/hubs">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-600 hover:text-slate-900 rounded-xl text-xs px-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-emerald-600" />
            Global Multi-Hub Corridor Map
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geographic bird’s-eye visualization of all active corporate commuting corridors
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/hubs/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Create Hub
            </Button>
          </Link>
          <Link href="/admin/hubs/manage">
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-slate-200">
              <Layers className="h-3.5 w-3.5" />
              Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Grid: Map (8 cols) + Corridor Selector (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Corridor Selector & Filters */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Corridor Directory</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700">
                  {filteredHubs.length} Hubs
                </Badge>
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Select a corridor below to highlight and zoom into its road route
              </CardDescription>

              {/* Campus filter for super admin */}
              {isSuperAdmin && campuses.length > 0 && (
                <div className="mt-3">
                  <select
                    value={selectedCampus}
                    onChange={(e) => setSelectedCampus(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-xs focus:border-emerald-500 focus:outline-hidden"
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Filter corridors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 rounded-xl text-xs border-slate-200"
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 max-h-[500px] overflow-y-auto space-y-1.5">
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
                      className={`cursor-pointer rounded-xl p-3 border text-xs transition-all ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/60 shadow-xs"
                          : "border-slate-100 hover:border-slate-200 hover:bg-slate-50/80"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-900">{hub.name}</span>
                        <Badge
                          variant="outline"
                          className={
                            hub.status === "active"
                              ? "text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "text-[9px] bg-slate-100 text-slate-600 border-slate-200"
                          }
                        >
                          {hub.status}
                        </Badge>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                        <span>{hub.origin.name}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span>{hub.destination.name}</span>
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 border-t border-slate-100/80 pt-1.5">
                        <span>{hub.distanceKm} km (~{hub.durationMinutes} mins)</span>
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
            height="620px"
            viewMode="admin"
          />
        </div>
      </div>
    </div>
  );
}
