import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white lg:bg-slate-50">
      {/* Left Side: Desktop Fixed Viewport Brand Logo (Never overflows or zooms on long content) */}
      <div className="hidden lg:flex lg:w-1/2 h-screen sticky top-0 bg-white items-center justify-center overflow-hidden border-r border-slate-200 p-4 lg:p-10">
        <img
          src="/images/commutex-logo.png"
          alt="CommuteX — Ride Together • Go Further"
          className="w-full h-full max-h-[85vh] object-contain transition-all duration-300"
        />
      </div>

      {/* Right Side: Responsive Form Container */}
      <div className="flex flex-1 flex-col items-center justify-center p-3 sm:p-6 lg:p-8 w-full lg:w-1/2 bg-white sm:bg-slate-50 min-h-screen">
        <div className="w-full max-w-md lg:max-w-lg bg-white sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-lg overflow-hidden flex flex-col my-auto">
          {/* Mobile Full-Width Logo Header (Edge-to-Edge, No Border, Seamlessly Joined with Form) */}
          <div className="w-full bg-white flex items-center justify-center pt-6 pb-2 px-6 lg:hidden">
            <img
              src="/images/commutex-logo.png"
              alt="CommuteX"
              className="w-full max-w-[260px] h-auto object-contain max-h-[140px]"
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
