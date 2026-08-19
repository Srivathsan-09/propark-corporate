"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationCarProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [visible, setVisible] = useState(false);

  // Trigger when pathname or searchParams change
  useEffect(() => {
    // When route finishes changing, briefly complete the animation then hide
    if (isNavigating) {
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setTimeout(() => setVisible(false), 300);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept click on internal links
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const isBlank = target.getAttribute("target") === "_blank";
      const isDownload = target.hasAttribute("download");

      if (
        href &&
        !isBlank &&
        !isDownload &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:") &&
        !href.startsWith("tel:") &&
        !href.startsWith("http")
      ) {
        // If clicking on current path, do nothing
        if (href === pathname || href === window.location.pathname) return;

        setVisible(true);
        setIsNavigating(true);
      }
    };

    document.addEventListener("click", handleAnchorClick);
    return () => document.removeEventListener("click", handleAnchorClick);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed top-16 left-0 right-0 z-50 h-2 pointer-events-none transition-opacity duration-300 ${
        isNavigating ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Top Emerald Glow Bar Track */}
      <div className="relative w-full h-full bg-emerald-100/60 dark:bg-emerald-950/40 backdrop-blur-xs overflow-hidden">
        {/* Animated Dashed Road Ground Line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[1.5px]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #10b981 0px, #10b981 6px, transparent 6px, transparent 12px)",
          }}
        />

        {/* Driving Mini Car */}
        <div
          className="absolute -top-3.5"
          style={{
            animation: "propark-topbar-car-drive 1.4s cubic-bezier(0.25, 0.1, 0.25, 1) infinite",
          }}
        >
          <svg
            width="38"
            height="18"
            viewBox="0 0 74 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible drop-shadow-sm"
          >
            <defs>
              <linearGradient id="topbarCarGrad" x1="8" y1="6" x2="68" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#047857" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
            </defs>

            {/* Exhaust puff */}
            <circle cx="8" cy="21" r="3" fill="#94a3b8" opacity="0.6" />

            {/* Body */}
            <path
              d="M 10 21 L 10 15.5 C 10.5 14.5, 12 14, 14 13.8 L 20 13.5 C 22 13.2, 24 8.5, 27 6.5 C 29 5.2, 32 5, 42 5 C 46 5, 49 5.8, 52 8.5 L 57 13.2 L 66 14.8 C 68 15.2, 69 16.5, 69 18 L 69 21.2 C 69 22, 68 22.5, 67 22.5 L 61 22.5 C 60.5 18.5, 47.5 18.5, 47 22.5 L 27 22.5 C 26.5 18.5, 13.5 18.5, 13 22.5 L 10.5 22.5 C 9.8 22.5, 9.5 22, 10 21 Z"
              fill="url(#topbarCarGrad)"
              stroke="#065f46"
              strokeWidth="0.8"
            />
            {/* Wheels */}
            <circle cx="20" cy="22" r="4.8" fill="#1e293b" />
            <circle cx="20" cy="22" r="2.2" fill="#34d399" />
            <circle cx="54" cy="22" r="4.8" fill="#1e293b" />
            <circle cx="54" cy="22" r="2.2" fill="#34d399" />
          </svg>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes propark-topbar-car-drive {
          0% {
            left: -45px;
          }
          100% {
            left: 100%;
          }
        }
      ` }} />
    </div>
  );
}
