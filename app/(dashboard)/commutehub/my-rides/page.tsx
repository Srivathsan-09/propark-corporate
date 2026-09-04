"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  Car,
  Route,
  Calendar,
  Clock,
  IndianRupee,
  Users,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Plus,
  Search,
  Navigation,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CarLoader } from "@/components/common/CarLoader";

export default function MyHubRidesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"offered" | "booked">("offered");
  const [offeredRides, setOfferedRides] = useState<any[]>([]);
  const [bookedRides, setBookedRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyHubRides();
  }, []);

  const fetchMyHubRides = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/commutehub/my-rides");
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to load your hub rides.");
      }

      setOfferedRides(data.offeredRides || []);
      setBookedRides(data.bookedRides || []);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load your hub rides.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3">
        <CarLoader message="Loading Your Hub Commutes..." />
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
            <Car className="h-6 w-6 text-emerald-600" />
            My CommuteHub Rides
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track your offered corridor carpools and booked passenger commutes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/commutehub/rides/create">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs gap-1.5 shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Offer Ride
            </Button>
          </Link>
          <Link href="/commutehub/rides/find">
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 border-slate-200">
              <Search className="h-3.5 w-3.5" />
              Find Ride
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab("offered")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "offered"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Car className="h-4 w-4" />
          Offered as Driver ({offeredRides.length})
        </button>

        <button
          onClick={() => setActiveTab("booked")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "booked"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Users className="h-4 w-4" />
          Booked as Passenger ({bookedRides.length})
        </button>
      </div>

      {/* Tab 1: Offered Rides */}
      {activeTab === "offered" && (
        <div className="space-y-4">
          {offeredRides.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 bg-white p-12 text-center shadow-xs">
              <Car className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">You haven’t offered any corridor rides yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Share your empty seats along a fixed corporate corridor and help colleagues commute.
              </p>
              <div className="mt-4">
                <Link href="/commutehub/rides/create">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">
                    Offer a Corridor Ride
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {offeredRides.map((ride) => {
                const hub = ride.hubId;
                const requests = ride.requests || [];
                const accepted = requests.filter((r: any) => r.status === "accepted");

                return (
                  <Card
                    key={ride._id}
                    className="rounded-2xl border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        {hub && (
                          <Badge variant="outline" className="font-mono text-[9px] text-slate-600 bg-slate-50">
                            {hub.hubId}
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

                      {hub && (
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{hub.name}</h3>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <span>{hub.origin.name}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span>{hub.destination.name}</span>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
                        <span className="flex items-center gap-1 font-medium text-slate-800">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {ride.departureDate} at {ride.departureTime}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span>
                          {ride.vehicle?.vehicleModel || "Vehicle"} ({ride.vehicle?.registrationNumber || "Reg"})
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="font-medium text-slate-700">
                          {ride.availableSeats} of {ride.totalSeats} seats open
                        </span>
                        {ride.pricePerSeat > 0 && (
                          <span className="font-bold text-slate-900 flex items-center">
                            <IndianRupee className="h-3.5 w-3.5" />
                            {ride.pricePerSeat} / seat
                          </span>
                        )}
                      </div>

                      {/* Passenger Requests Summary */}
                      <div className="border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                        <span>{requests.length} passenger requests ({accepted.length} accepted)</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex items-center justify-end gap-2">
                      <Link href={`/rides/${ride._id}`}>
                        <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1 border-slate-200">
                          <Eye className="h-3 w-3" />
                          Manage Ride
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Booked Rides */}
      {activeTab === "booked" && (
        <div className="space-y-4">
          {bookedRides.length === 0 ? (
            <Card className="rounded-2xl border-slate-200 bg-white p-12 text-center shadow-xs">
              <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">You have no booked hub rides</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Browse available corridors and request a seat in a colleague’s carpool.
              </p>
              <div className="mt-4">
                <Link href="/commutehub/rides/find">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold">
                    Find Corridor Rides
                  </Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bookedRides.map((ride) => {
                const hub = ride.hubId;
                const myRequest = (ride.requests || []).find(
                  (r: any) =>
                    (r.passenger?._id || r.passenger)?.toString() === session?.user?.id
                );

                return (
                  <Card
                    key={ride._id}
                    className="rounded-2xl border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-all overflow-hidden flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        {hub && (
                          <Badge variant="outline" className="font-mono text-[9px] text-slate-600 bg-slate-50">
                            {hub.hubId}
                          </Badge>
                        )}
                        <Badge
                          className={
                            myRequest?.status === "accepted"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
                              : myRequest?.status === "rejected"
                              ? "bg-red-50 text-red-700 border-red-200 text-[10px]"
                              : "bg-amber-50 text-amber-700 border-amber-200 text-[10px]"
                          }
                          variant="outline"
                        >
                          Request {myRequest?.status || "pending"}
                        </Badge>
                      </div>

                      {hub && (
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">{hub.name}</h3>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <span>{hub.origin.name}</span>
                            <span className="text-slate-400">&rarr;</span>
                            <span>{hub.destination.name}</span>
                          </div>
                        </div>
                      )}

                      {/* Driver & Vehicle */}
                      <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2.5">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                          {ride.driver?.name?.charAt(0) || "D"}
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-slate-900">{ride.driver?.name || "Driver"}</p>
                          <p className="text-[11px] text-slate-500">
                            {ride.vehicle?.vehicleModel} ({ride.vehicle?.registrationNumber})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
                        <span className="flex items-center gap-1 font-medium text-slate-800">
                          <Calendar className="h-3.5 w-3.5 text-slate-400" />
                          {ride.departureDate} at {ride.departureTime}
                        </span>
                        {ride.pricePerSeat > 0 && (
                          <span className="font-bold text-slate-900 flex items-center">
                            <IndianRupee className="h-3.5 w-3.5" />
                            {ride.pricePerSeat}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 bg-slate-50/50 p-3 flex items-center justify-end gap-2">
                      <Link href={`/rides/${ride._id}`}>
                        <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1 border-slate-200">
                          <Eye className="h-3 w-3" />
                          Ride Details
                        </Button>
                      </Link>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
