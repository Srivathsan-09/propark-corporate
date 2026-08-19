import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white lg:bg-slate-50">
      {/* Left Side: Desktop Brand Logo Showcase (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 bg-white border-r border-slate-200/80 relative overflow-hidden">
        {/* Subtle decorative background green radial gradient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Full CommuteX Logo - Centered */}
        <div className="relative z-10 w-full max-w-lg flex flex-col items-center justify-center p-4">
          <img
            src="/images/commutex-logo.png"
            alt="CommuteX — Ride Together • Go Further"
            className="w-full h-auto object-contain max-h-[440px] drop-shadow-md transition-transform duration-300 hover:scale-[1.02]"
          />
        </div>
      </div>

      {/* Right Side: Seamless Edge-to-Edge Form Container on Mobile */}
      <div className="flex flex-1 flex-col items-center justify-start sm:justify-center p-0 sm:p-6 lg:p-12 w-full lg:w-1/2 bg-white sm:bg-slate-50">
        <div className="w-full max-w-md bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-lg overflow-hidden flex flex-col">
          {/* Mobile Full-Width Logo Header (Edge-to-Edge, No Border, Seamlessly Joined with Form) */}
          <div className="w-full bg-white flex items-center justify-center pt-8 pb-3 px-6 lg:hidden">
            <img
              src="/images/commutex-logo.png"
              alt="CommuteX"
              className="w-full max-w-[300px] h-auto object-contain max-h-[170px]"
            />
          </div>

          {/* Form Content */}
          <div className="w-full flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
