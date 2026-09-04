"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  Map as MapIcon,
  Route,
  Search,
  ArrowLeft,
  Building2,
  Car,
  Plus,
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

export default function EmployeeHubMapPage() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<IHubMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/commutehub/hubs");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load corridors.");
      }

      setHubs(data.hubs || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load corridors map.");
    } finally {
      setLoading(false);
    }
  };

  const filteredHubs = useMemo(() => {
    return hubs.filter((hub) => {
      const query = searchQuery.toLowerCase();
      return (
        hub.name.toLowerCase().includes(query) ||
        hub.corridor.toLowerCase().includes(query) ||
        hub.origin.name.toLowerCase().includes(query) ||
        hub.destination.name.toLowerCase().includes(query)
      );
    });
  }, [hubs, searchQuery]);

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Rendering Campus Corridor Map..." />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/commutehub">
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-slate-600 hover:text-slate-900 rounded-xl text-xs px-2">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-emerald-600" />
            Interactive Corridor Map
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geographic view of all active commuting corridors available for your campus
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/commutehub/rides/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Offer a Ride
            </Button>
          </Link>
          <Link href="/commutehub/rides/find">
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-slate-200">
              <Search className="h-3.5 w-3.5" />
              Find Rides
            </Button>
          </Link>
        </div>
      </div>

      {/* Grid: Corridors list (4 cols) + Map (8 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: List of Corridors */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 border-b border-slate-100">
              <CardTitle className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Active Corridors</span>
                <Badge variant="outline" className="text-[10px] text-emerald-700">
                  {filteredHubs.length} Available
                </Badge>
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-500">
                Click a corridor below to inspect its route on the map
              </CardDescription>

              {/* Search */}
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Filter corridors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-8 rounded-xl text-xs border-slate-200"
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
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
                          {hub.activeRidesCount || 0} rides
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 mt-1 flex items-center gap-1">
                        <span>{hub.origin.name}</span>
                        <span className="text-slate-400">&rarr;</span>
                        <span>{hub.destination.name}</span>
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 border-t border-slate-100/80 pt-1.5">
                        <span>{hub.distanceKm} km (~{hub.durationMinutes} mins)</span>
                        <Link
                          href={`/commutehub/rides/find?hubId=${hub._id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-semibold text-emerald-700 hover:underline"
                        >
                          Find Rides &rarr;
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Multi-Hub Interactive Map */}
        <div className="lg:col-span-8">
          <MultiHubMap
            hubs={filteredHubs}
            selectedHubId={selectedHubId}
            onSelectHub={(hub) => setSelectedHubId(hub ? hub._id : null)}
            height="620px"
            viewMode="employee"
          />
        </div>
      </div>
    </div>
  );
}
