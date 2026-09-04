"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Route,
  Search,
  Clock,
  Car,
  MapPin,
  ArrowRight,
  Plus,
  Compass,
  ArrowLeft,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CarLoader } from "@/components/common/CarLoader";

export default function EmployeeAvailableHubsPage() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
        throw new Error(data.error || "Failed to load hubs.");
      }

      setHubs(data.hubs || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load hubs.");
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
        <CarLoader message="Loading Virtual Corridors..." />
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
            <Route className="h-6 w-6 text-emerald-600" />
            Available Commuting Corridors
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Choose a corridor to browse scheduled colleague carpools or offer a ride
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/commutehub/map">
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-slate-200">
              Interactive Map
            </Button>
          </Link>
          <Link href="/commutehub/rides/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Offer a Ride
            </Button>
          </Link>
        </div>
      </div>

      {/* Search Bar */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by corridor name, pickup point, or destination..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl text-xs border-slate-200"
            />
          </div>
        </CardContent>
      </Card>

      {/* Hubs Grid */}
      {filteredHubs.length === 0 ? (
        <Card className="rounded-2xl border-slate-200 bg-white p-12 text-center shadow-xs">
          <Route className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-slate-700">No corridors match your search</p>
          <p className="text-[11px] text-slate-400 mt-1">
            Try searching for a different area or neighborhood.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredHubs.map((hub) => (
            <Card
              key={hub._id}
              className="rounded-2xl border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
            >
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] text-slate-600 bg-slate-50">
                    {hub.hubId}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                  >
                    {hub.activeRidesCount || 0} scheduled rides
                  </Badge>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-slate-900">{hub.name}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-700 font-medium">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      {hub.origin.name}
                    </span>
                    <span className="text-slate-400">&rarr;</span>
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-red-500"></span>
                      {hub.destination.name}
                    </span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex items-center justify-between text-[11px] text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Route className="h-3.5 w-3.5 text-emerald-600" />
                    <strong>{hub.distanceKm} km</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-indigo-600" />
                    ~<strong>{hub.durationMinutes} mins</strong>
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex items-center gap-2">
                <Link href={`/commutehub/rides/find?hubId=${hub._id}`} className="flex-1">
                  <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">
                    Find Rides
                  </Button>
                </Link>
                <Link href={`/commutehub/rides/create?hubId=${hub._id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full rounded-xl text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50">
                    Offer Ride
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
