"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Car,
  Users,
  Clock,
  ArrowRight,
  Check,
  X,
  AlertCircle,
  Sparkles,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { CarLoader } from "@/components/common/CarLoader";

interface INotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  sender?: {
    name: string;
    companyName?: string;
    profileImage?: string;
  };
}

export default function NotificationsPage() {
  const { data: session } = useSession();

  const [notifications, setNotifications] = useState<INotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchNotifications();
    }
  }, [session]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Mark read error:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ride_started":
        return <Navigation className="h-5 w-5 text-emerald-600 animate-pulse" />;
      case "ride_completed":
        return <CheckCircle2 className="h-5 w-5 text-blue-600" />;
      case "ride_posted":
        return <Car className="h-5 w-5 text-blue-600" />;
      case "ride_requested":
        return <Users className="h-5 w-5 text-amber-600" />;
      case "request_accepted":
        return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
      case "request_rejected":
        return <X className="h-5 w-5 text-rose-600" />;
      default:
        return <Bell className="h-5 w-5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 animate-in fade-in-50 duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bell className="h-6 w-6 text-emerald-600" /> Notifications & Alerts
          </h1>
          <p className="text-sm text-slate-500">
            Real-time updates on campus rides offered, live GPS departures, and passenger confirmations
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-xs font-semibold rounded-xl border-emerald-200 text-emerald-800 hover:bg-emerald-50 self-start sm:self-auto"
          >
            Mark All as Read ({unreadCount})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center rounded-2xl bg-white border border-slate-200 shadow-sm">
          <CarLoader size="lg" message="Loading your notifications..." />
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="You're all caught up! You will receive alerts when colleagues offer rides or request stops on your route."
          actionLabel="Find a Ride"
          onAction={() => {
            window.location.href = "/rides/find";
          }}
        />
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <Card
              key={notif._id}
              className={`border-slate-200 shadow-sm rounded-2xl p-4 transition-all ${
                !notif.isRead ? "bg-emerald-50/40 border-emerald-200" : "bg-white"
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-slate-200 shadow-xs shrink-0 mt-0.5">
                  {getNotificationIcon(notif.type)}
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-900 text-sm">{notif.title}</h3>
                    <span className="text-[11px] text-slate-400">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{notif.message}</p>

                  <div className="pt-2 flex items-center gap-3 text-xs">
                    {notif.type === "ride_started" ? (
                      <Link
                        href="/rides/my-rides"
                        className="font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <Navigation className="h-3.5 w-3.5" /> Track Driver Live GPS <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : notif.type === "ride_requested" ? (
                      <Link
                        href="/rides/my-rides"
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        Review Passenger Request <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : notif.type === "ride_posted" ? (
                      <Link
                        href="/rides/find"
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        View & Book Ride <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <Link
                        href="/rides/my-rides"
                        className="font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        View in My Rides <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
