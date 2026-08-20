"use client";

import React from "react";

export interface CarLoaderProps {
  /** Optional loading message displayed underneath the car */
  message?: string;
  /** Size preset */
  size?: "inline" | "sm" | "md" | "lg" | "fullscreen" | "page" | "track";
  /** Optional container class names */
  className?: string;
  /** Whether to render the road dashed track beneath the car (default true) */
  showRoad?: boolean;
  /** Custom primary brand color for the car (default: Pro Park emerald) */
  carColor?: string;
  /** Accessible label for screen readers (default: "Loading...") */
  accessibleLabel?: string;
}

export function CarLoader({
  message,
  size = "md",
  className = "",
  showRoad = true,
  carColor = "#059669",
  accessibleLabel,
}: CarLoaderProps) {
  // Dimensions & scale mapping
  const sizeConfig = {
    inline: {
      container: "w-32 h-9",
      track: "w-32 h-7",
      carWidth: 42,
      carHeight: 18,
      textSize: "text-[11px]",
      roadHeight: "h-[1.5px]",
    },
    sm: {
      container: "w-44 h-14",
      track: "w-44 h-10",
      carWidth: 54,
      carHeight: 24,
      textSize: "text-xs",
      roadHeight: "h-[2px]",
    },
    md: {
      container: "w-64 h-20",
      track: "w-64 h-14",
      carWidth: 68,
      carHeight: 30,
      textSize: "text-xs",
      roadHeight: "h-[2px]",
    },
    lg: {
      container: "w-80 h-28",
      track: "w-80 h-18",
      carWidth: 84,
      carHeight: 37,
      textSize: "text-sm",
      roadHeight: "h-[2.5px]",
    },
    page: {
      container: "w-full max-w-md h-28",
      track: "w-full h-20",
      carWidth: 84,
      carHeight: 37,
      textSize: "text-sm font-semibold",
      roadHeight: "h-[2.5px]",
    },
    track: {
      container: "w-full h-10",
      track: "w-full h-8",
      carWidth: 56,
      carHeight: 24,
      textSize: "text-xs",
      roadHeight: "h-[2px]",
    },
    fullscreen: {
      container: "w-72 sm:w-88 h-32",
      track: "w-72 sm:w-88 h-20",
      carWidth: 92,
      carHeight: 40,
      textSize: "text-sm sm:text-base",
      roadHeight: "h-[2.5px]",
    },
  };

  const current = sizeConfig[size] || sizeConfig.md;
  const isFullscreen = size === "fullscreen";

  const loaderContent = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center select-none ${
        isFullscreen ? "p-8 rounded-3xl bg-white/90 dark:bg-slate-900/90 shadow-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md" : ""
      } ${className}`}
    >
      <span className="sr-only">{accessibleLabel || message || "Loading..."}</span>

      {/* Animation Track */}
      <div className={`relative overflow-hidden ${current.track} flex items-end justify-center`}>
        {/* Driving Car with Attached Exhaust & Wheels */}
        <div className="propark-car-traveler">
          <svg
            width={current.carWidth}
            height={current.carHeight}
            viewBox="0 0 74 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="overflow-visible"
          >
            <defs>
              {/* Pro Park Signature Emerald Body Gradient */}
              <linearGradient id="proparkCarBodyGrad" x1="8" y1="6" x2="68" y2="24" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#047857" />
                <stop offset="50%" stopColor={carColor} />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>

              {/* Roof & Hood Gloss Highlight */}
              <linearGradient id="proparkGlassGrad" x1="20" y1="6" x2="52" y2="14" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>

              {/* Headlight Beam Gradient */}
              <linearGradient id="headlightBeam" x1="68" y1="17" x2="74" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#6ee7b7" stopOpacity="0" />
              </linearGradient>

              {/* Soft Exhaust Particle Radial Gradient */}
              <radialGradient id="exhaustGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#cbd5e1" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#94a3b8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Exhaust Cloud Particles Emitted from Rear Pipe (x=8, y=21) */}
            <g className="propark-exhaust-clouds pointer-events-none">
              <circle cx="8" cy="21" r="3.2" fill="url(#exhaustGrad)" className="propark-puff-1" />
              <circle cx="8" cy="20.5" r="2.8" fill="url(#exhaustGrad)" className="propark-puff-2" />
              <circle cx="8" cy="21.5" r="3.5" fill="url(#exhaustGrad)" className="propark-puff-3" />
            </g>

            {/* Car Chassis & Body with Micro-Bounce Motion */}
            <g className="propark-car-body-motion">
              {/* Headlight Forward Beam Flare */}
              <polygon points="68,16 74,15 74,21 68,19" fill="url(#headlightBeam)" />

              {/* Main Aerodynamic Sport Sedan Body */}
              <path
                d="M 10 21
                   L 10 15.5
                   C 10.5 14.5, 12 14, 14 13.8
                   L 20 13.5
                   C 22 13.2, 24 8.5, 27 6.5
                   C 29 5.2, 32 5, 42 5
                   C 46 5, 49 5.8, 52 8.5
                   L 57 13.2
                   L 66 14.8
                   C 68 15.2, 69 16.5, 69 18
                   L 69 21.2
                   C 69 22, 68 22.5, 67 22.5
                   L 61 22.5
                   C 60.5 18.5, 47.5 18.5, 47 22.5
                   L 27 22.5
                   C 26.5 18.5, 13.5 18.5, 13 22.5
                   L 10.5 22.5
                   C 9.8 22.5, 9.5 22, 10 21 Z"
                fill="url(#proparkCarBodyGrad)"
                stroke="#065f46"
                strokeWidth="0.8"
                strokeLinejoin="round"
              />

              {/* Aerodynamic Side Character Line */}
              <path
                d="M 12 16 Q 38 15 67 17.5"
                stroke="#34d399"
                strokeWidth="0.75"
                strokeLinecap="round"
                opacity="0.8"
              />

              {/* Windows: Dark Tinted Glass with Gloss Reflection */}
              {/* Rear Window */}
              <path
                d="M 22 13.2
                   L 27.5 7.2
                   C 28.5 6.5, 30 6.3, 34 6.3
                   L 34 13.2
                   Z"
                fill="url(#proparkGlassGrad)"
                stroke="#0f172a"
                strokeWidth="0.5"
              />

              {/* Front Window */}
              <path
                d="M 36 13.2
                   L 36 6.3
                   C 40 6.3, 44 6.8, 47 8.5
                   L 54 13.2
                   Z"
                fill="url(#proparkGlassGrad)"
                stroke="#0f172a"
                strokeWidth="0.5"
              />

              {/* Glass Sun Reflection Streak */}
              <path
                d="M 28 8 L 32 8 L 29 12 L 25 12 Z"
                fill="#6ee7b7"
                opacity="0.25"
              />
              <path
                d="M 38 8 L 43 8 L 40 12 L 35 12 Z"
                fill="#6ee7b7"
                opacity="0.25"
              />

              {/* Door Cut Lines & Handle */}
              <line x1="35" y1="6.3" x2="35" y2="22" stroke="#047857" strokeWidth="0.8" />
              <rect x="38" y="14.5" width="3.5" height="0.9" rx="0.45" fill="#e2e8f0" />
              <rect x="25" y="14.5" width="3.5" height="0.9" rx="0.45" fill="#e2e8f0" />

              {/* Front Headlight: Modern Cyan LED Bar */}
              <polygon points="65.5,15.5 68.2,16 68.2,18 64.5,18" fill="#a7f3d0" />

              {/* Rear Taillight: Ruby Red LED */}
              <rect x="9.8" y="15" width="2.2" height="2.8" rx="0.6" fill="#f43f5e" />

              {/* Exhaust Tip */}
              <rect x="8.5" y="21" width="2" height="1.2" rx="0.4" fill="#64748b" />
            </g>

            {/* Rear Wheel (Center at x=20, y=22) */}
            <g className="propark-wheel-back">
              {/* Outer Rubber Tire */}
              <circle cx="20" cy="22" r="5.2" fill="#1e293b" stroke="#0f172a" strokeWidth="0.6" />
              {/* Silver Alloy Rim */}
              <circle cx="20" cy="22" r="3.4" fill="#94a3b8" />
              <circle cx="20" cy="22" r="2.2" fill="#0f172a" />
              {/* 4-Spoke Cross Pattern that rotates */}
              <line x1="20" y1="18.8" x2="20" y2="25.2" stroke="#34d399" strokeWidth="0.9" />
              <line x1="16.8" y1="22" x2="23.2" y2="22" stroke="#34d399" strokeWidth="0.9" />
              {/* Center Hubcap */}
              <circle cx="20" cy="22" r="1" fill="#f8fafc" />
            </g>

            {/* Front Wheel (Center at x=54, y=22) */}
            <g className="propark-wheel-front">
              {/* Outer Rubber Tire */}
              <circle cx="54" cy="22" r="5.2" fill="#1e293b" stroke="#0f172a" strokeWidth="0.6" />
              {/* Silver Alloy Rim */}
              <circle cx="54" cy="22" r="3.4" fill="#94a3b8" />
              <circle cx="54" cy="22" r="2.2" fill="#0f172a" />
              {/* 4-Spoke Cross Pattern that rotates */}
              <line x1="54" y1="18.8" x2="54" y2="25.2" stroke="#34d399" strokeWidth="0.9" />
              <line x1="50.8" y1="22" x2="57.2" y2="22" stroke="#34d399" strokeWidth="0.9" />
              {/* Center Hubcap */}
              <circle cx="54" cy="22" r="1" fill="#f8fafc" />
            </g>
          </svg>
        </div>

        {/* Road & Moving Dashes beneath wheels */}
        {showRoad && (
          <div className="w-full absolute bottom-0 left-0 right-0 flex flex-col items-center">
            {/* Subtle Road Track Surface */}
            <div className={`w-full ${current.roadHeight} bg-slate-200 dark:bg-slate-700/80 rounded-full relative overflow-hidden`}>
              <div className="propark-road-line absolute inset-0 opacity-80" />
            </div>
          </div>
        )}
      </div>

      {/* Optional Pro Park Themed Message Text */}
      {message && (
        <p
          className={`mt-2 font-medium tracking-tight text-slate-600 dark:text-slate-300 animate-pulse text-center ${current.textSize}`}
        >
          {message}
        </p>
      )}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in-50 duration-200 p-4">
        {loaderContent}
      </div>
    );
  }

  return loaderContent;
}

export default CarLoader;
