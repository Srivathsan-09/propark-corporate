"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/common/Navbar";
import { Sidebar } from "@/components/common/Sidebar";
import { NavigationCarProgress } from "@/components/common/NavigationCarProgress";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Navigation Top Car Loader Bar */}
      <NavigationCarProgress />

      {/* Top Navbar */}
      <Navbar
        isMobileMenuOpen={isMobileMenuOpen}
        onMobileMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
      />

      <div className="flex flex-1">
        {/* Responsive Sidebar */}
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
