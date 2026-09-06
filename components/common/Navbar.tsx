"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Car, Shield, Menu, X, User as UserIcon, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, getInitials } from "@/lib/utils";

interface NavbarProps {
  onMobileMenuToggle?: () => void;
  isMobileMenuOpen?: boolean;
}

export function Navbar({ onMobileMenuToggle, isMobileMenuOpen }: NavbarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [avatarSrc, setAvatarSrc] = useState<string | null>(session?.user?.image || null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setAvatarSrc(session?.user?.image || null);
    setImgError(false);
  }, [session?.user?.image]);

  useEffect(() => {
    const handleProfilePhotoUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{ image?: string }>;
      if (customEvent.detail && customEvent.detail.image !== undefined) {
        setAvatarSrc(customEvent.detail.image || null);
        setImgError(false);
      }
    };

    window.addEventListener("profile-photo-updated", handleProfilePhotoUpdated);
    return () => {
      window.removeEventListener("profile-photo-updated", handleProfilePhotoUpdated);
    };
  }, []);

  const isSuperAdmin = session?.user?.role === "admin";
  const isCampusAdmin = session?.user?.role === "campus_admin";
  const isAdmin = isSuperAdmin || isCampusAdmin;

  const isCommuteHub = pathname.startsWith("/commutehub") || pathname.startsWith("/admin/hubs");

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="relative sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/80">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onMobileMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 md:hidden"
          aria-label="Toggle navigation"
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Brand Logo */}
        <Link
          href={isCommuteHub ? (isAdmin ? "/admin/hubs" : "/commutehub") : (isAdmin ? "/admin" : "/dashboard")}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <img
            src="/images/commutex-logo.png"
            alt="CommuteX"
            className="h-9 w-auto object-contain rounded-md"
          />
          <div className="flex flex-col">
            <span className="text-base font-black tracking-tight text-slate-900 leading-tight flex items-center">
              COMMUTE<span className="text-emerald-600">{isCommuteHub ? "HUB" : "X"}</span>
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              {isCommuteHub ? "Hub-Based Corridors" : "Corporate Commute"}
            </span>
          </div>
        </Link>
      </div>

      {/* Dead-Center: Mode Switcher (CommuteX ↔ CommuteHub) */}
      {session?.user && (
        <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 items-center rounded-xl bg-slate-100 p-1 text-xs font-semibold border border-slate-200/80 shadow-2xs z-20">
          <button
            type="button"
            onClick={() => router.push(isAdmin ? "/admin" : "/dashboard")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all text-xs cursor-pointer",
              !isCommuteHub
                ? "bg-white text-slate-900 shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-900"
            )}
            title="Switch to CommuteX Standard Mode"
          >
            <Car className="h-3.5 w-3.5 text-emerald-600" />
            <span className="font-semibold">CommuteX</span>
          </button>
          <button
            type="button"
            onClick={() => router.push(isAdmin ? "/admin/hubs" : "/commutehub")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all text-xs cursor-pointer",
              isCommuteHub
                ? "bg-emerald-600 text-white shadow-xs font-bold"
                : "text-slate-500 hover:text-slate-900"
            )}
            title="Switch to CommuteHub Corridor Mode"
          >
            <Compass className="h-3.5 w-3.5" />
            <span className="font-semibold">CommuteHub</span>
          </button>
        </div>
      )}

      {/* User info & Actions */}
      <div className="flex items-center gap-3">
        {session?.user ? (
          <>
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-800">
                  {session.user.name}
                </span>
                {session.user.role === "admin" ? (
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800 gap-1 text-[11px]">
                    <Shield className="h-3 w-3" /> Admin
                  </Badge>
                ) : (
                  <Badge variant="default" className="text-[11px]">
                    {session.user.employeeId || "Employee"}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-slate-500">
                {session.user.department || session.user.email}
              </span>
            </div>

            {/* User Avatar */}
            <Link
              href="/profile"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors overflow-hidden shrink-0"
              title="View Profile"
            >
              {avatarSrc && !imgError ? (
                <img
                  key={avatarSrc}
                  src={avatarSrc}
                  alt={session.user.name || "User"}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                getInitials(session.user.name || "PP")
              )}
            </Link>

            {/* Logout CTA */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 text-slate-600 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">Logout</span>
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button size="sm">Register</Button>
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
