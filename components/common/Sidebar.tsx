"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  Search,
  PlusCircle,
  Clock,
  Car,
  Bell,
  User,
  ShieldAlert,
  Shield,
  ShieldCheck,
  Users,
  Route,
  BarChart3,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";
  const isAdmin = isSuperAdmin || isCampusAdmin;

  // Navigation specifically for Platform / Campus Admins
  const adminNavItems = [
    {
      title: "Overview & Analytics",
      href: "/admin",
      icon: LayoutDashboard,
    },
    {
      title: "Campuses Master Data",
      href: "/admin/campuses",
      icon: Building2,
    },
    ...(isSuperAdmin
      ? [
          {
            title: "Campus Administrators",
            href: "/admin/admins",
            icon: ShieldCheck,
          },
        ]
      : []),
    {
      title: "Registered Employees",
      href: "/admin/employees",
      icon: Users,
    },
    {
      title: "All Campus Vehicles",
      href: "/admin/vehicles",
      icon: Car,
    },
    {
      title: "Campus Rides Hub",
      href: "/admin/rides",
      icon: Route,
      phaseBadge: "Phase 2",
    },
    {
      title: "System Reports & Safety",
      href: "/admin/reports",
      icon: ShieldAlert,
    },
    ...(isSuperAdmin
      ? [
          {
            title: "Audit Logs & Security",
            href: "/admin/audit-logs",
            icon: Shield,
          },
        ]
      : []),
  ];

  // Navigation specifically for Employees / Commuters
  const employeeNavItems = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Find a Ride",
      href: "/rides/find",
      icon: Search,
      phaseBadge: "Phase 2",
    },
    {
      title: "Offer a Ride",
      href: "/rides/offer",
      icon: PlusCircle,
      phaseBadge: "Phase 2",
    },
    {
      title: "My Rides",
      href: "/rides/my-rides",
      icon: Clock,
      phaseBadge: "Phase 2",
    },
    {
      title: "My Vehicles",
      href: "/vehicles",
      icon: Car,
    },
    {
      title: "Notifications",
      href: "/notifications",
      icon: Bell,
      phaseBadge: "Phase 4",
    },
    {
      title: "My Profile",
      href: "/profile",
      icon: User,
    },
    {
      title: "Safety & Reports",
      href: "/reports",
      icon: ShieldAlert,
    },
  ];

  const currentNavItems = isAdmin ? adminNavItems : employeeNavItems;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed top-16 bottom-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
          <div className="px-3 mb-2 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {isAdmin ? "Admin Console" : "Corporate Commute"}
            </span>
            {isSuperAdmin && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-[10px] py-0 px-1.5 font-semibold">
                Super Admin
              </Badge>
            )}
            {isCampusAdmin && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-[10px] py-0 px-1.5 font-semibold">
                Campus Admin
              </Badge>
            )}
          </div>

          <nav className="space-y-1">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin" || item.href === "/dashboard"
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? isAdmin
                        ? "bg-purple-50 text-purple-900 font-semibold"
                        : "bg-emerald-50 text-emerald-900 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-colors",
                        isActive
                          ? isAdmin
                            ? "text-purple-600"
                            : "text-emerald-600"
                          : "text-slate-400 group-hover:text-slate-600"
                      )}
                    />
                    <span>{item.title}</span>
                  </div>

                  {item.phaseBadge && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 font-normal text-slate-400 border-slate-200 group-hover:border-slate-300"
                    >
                      {item.phaseBadge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer info box */}
        <div className="border-t border-slate-200 p-4">
          <div className={cn("rounded-lg p-3 text-xs", isAdmin ? "bg-purple-50/70 text-purple-900" : "bg-slate-50 text-slate-600")}>
            <p className="font-semibold">{isAdmin ? "Campus Admin Portal" : "CommuteX Campus"}</p>
            <p className="mt-0.5 text-[11px] opacity-80">
              {isAdmin ? "Platform oversight & fleet control" : "Corporate Ride Sharing & Commute"}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
