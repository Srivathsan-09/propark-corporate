"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CarLoader } from "@/components/common/CarLoader";

export default function AdminSustainabilityPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/settings?tab=sustainability");
  }, [router]);

  return (
    <div className="py-20 flex flex-col items-center justify-center">
      <CarLoader size="page" message="Opening Sustainability in Settings..." />
    </div>
  );
}
