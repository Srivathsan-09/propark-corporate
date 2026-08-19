import React from "react";
import { CarLoader } from "@/components/common/CarLoader";

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-8">
      <CarLoader size="lg" message="Finding your ride..." />
    </div>
  );
}
