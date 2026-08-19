import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row bg-white lg:bg-slate-50">
      {/* Left Side: Desktop Full Edge-to-Edge Image (No margins, no padding) */}
      <div className="hidden lg:block lg:w-1/2 min-h-screen relative bg-white overflow-hidden border-r border-slate-200">
        <img
          src="/images/commutex-logo.png"
          alt="CommuteX — Ride Together • Go Further"
          className="w-full h-full object-cover object-center"
        />
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
