"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Compass,
  Route,
  Car,
  Search,
  Plus,
  MapPin,
  Clock,
  Users,
  Map as MapIcon,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CarLoader } from "@/components/common/CarLoader";

export default function CommuteHubEmployeeDashboard() {
  const { data: session } = useSession();
  const [hubs, setHubs] = useState<any[]>([]);
  const [myRidesSummary, setMyRidesSummary] = useState<{ offered: number; booked: number }>({
    offered: 0,
    booked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch hubs available to this employee
      const hubsRes = await fetch("/api/commutehub/hubs");
      const hubsData = await hubsRes.json();
      if (hubsData.success) {
        setHubs(hubsData.hubs || []);
      }

      // Fetch my hub rides count
      const myRidesRes = await fetch("/api/commutehub/my-rides");
      const myRidesData = await myRidesRes.json();
      if (myRidesData.success) {
        setMyRidesSummary({
          offered: myRidesData.offeredRides?.length || 0,
          booked: myRidesData.bookedRides?.length || 0,
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load CommuteHub data.");
    } finally {
      setLoading(false);
    }
  };

  const activeHubs = hubs.filter((h) => h.status === "active");

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Connecting to CommuteHub corridors..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-500/10 via-slate-50 to-emerald-50/20 p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Badge className="bg-emerald-600 text-white border-0 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5">
                CommuteHub Active
              </Badge>
              {session?.user?.campusId && (
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  Campus Network
                </span>
              )}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900">
              Welcome to CommuteHub, {session?.user?.name || "Colleague"}
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl leading-relaxed">
              Commute along fixed virtual corridors with verified colleagues. Find rides or share empty seats
              along established corporate routes like Poonamallee &rarr; Porur and Tambaram &rarr; Guindy.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            <Link href="/commutehub/rides/find">
              <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold gap-1.5 shadow-sm">
                <Search className="h-3.5 w-3.5" />
                Find Corridor Ride
              </Button>
            </Link>
            <Link href="/commutehub/rides/create">
              <Button variant="outline" className="w-full sm:w-auto rounded-xl text-xs font-semibold gap-1.5 border-slate-200 bg-white hover:bg-slate-50">
                <Plus className="h-3.5 w-3.5" />
                Offer a Ride
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Action Cards (4 Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/commutehub/rides/find" className="group">
          <Card className="h-full rounded-2xl border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Search className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="mt-3 text-xs font-bold text-slate-900">Find a Ride</h3>
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              Select an established corridor and book a seat with a verified colleague.
            </p>
          </Card>
        </Link>

        <Link href="/commutehub/rides/create" className="group">
          <Card className="h-full rounded-2xl border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Plus className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="mt-3 text-xs font-bold text-slate-900">Offer a Ride</h3>
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              Driving along a corridor? Share your ride and earn fuel contribution.
            </p>
          </Card>
        </Link>

        <Link href="/commutehub/hubs" className="group">
          <Card className="h-full rounded-2xl border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Route className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="mt-3 text-xs font-bold text-slate-900">Active Corridors ({activeHubs.length})</h3>
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              Browse all virtual commuting corridors available for your campus.
            </p>
          </Card>
        </Link>

        <Link href="/commutehub/map" className="group">
          <Card className="h-full rounded-2xl border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <MapIcon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
            </div>
            <h3 className="mt-3 text-xs font-bold text-slate-900">Interactive Map</h3>
            <p className="mt-1 text-[11px] text-slate-500 leading-normal">
              View all corridor road routes and stop points geographically on the map.
            </p>
          </Card>
        </Link>
      </div>

      {/* My Activity Summary Banner */}
      {(myRidesSummary.offered > 0 || myRidesSummary.booked > 0) && (
        <Card className="rounded-2xl border-slate-200 bg-white shadow-xs">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <Car className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Your Hub Commutes</h4>
                <p className="text-[11px] text-slate-500">
                  {myRidesSummary.offered} rides offered as driver • {myRidesSummary.booked} rides requested as passenger
                </p>
              </div>
            </div>

            <Link href="/commutehub/my-rides">
              <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1 border-slate-200">
                View My Hub Rides
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Available Virtual Corridors Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Route className="h-4 w-4 text-emerald-600" />
              Active Corridors in Your Campus
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select a corridor to view available carpools or offer a ride
            </p>
          </div>

          <Link href="/commutehub/hubs">
            <Button variant="ghost" size="sm" className="text-xs text-emerald-700 hover:text-emerald-800 p-0 h-auto font-semibold">
              View all corridors &rarr;
            </Button>
          </Link>
        </div>

        {activeHubs.length === 0 ? (
          <Card className="rounded-2xl border-slate-200 bg-white p-8 text-center shadow-xs">
            <Route className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-700">No active corridors yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Campus administrators will publish commuting corridors shortly.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeHubs.slice(0, 6).map((hub) => (
              <Card
                key={hub._id}
                className="rounded-2xl border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="font-mono text-[9px] text-slate-600 bg-slate-50">
                      {hub.hubId}
                    </Badge>
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      {hub.activeRidesCount || 0} active rides
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-900">{hub.name}</h3>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">{hub.origin.name}</span>
                      <span className="text-slate-400">&rarr;</span>
                      <span className="font-medium text-slate-800">{hub.destination.name}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 border-t border-slate-100 pt-2.5">
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

                <div className="border-t border-slate-100 bg-slate-50/60 p-3 flex items-center gap-2">
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
    </div>
  );
}
