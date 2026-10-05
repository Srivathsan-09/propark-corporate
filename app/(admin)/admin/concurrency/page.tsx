"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CarLoader } from "@/components/common/CarLoader";

export default function AdminConcurrencyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/settings?tab=concurrency");
  }, [router]);

  return (
    <div className="py-20 flex flex-col items-center justify-center">
      <CarLoader size="page" message="Opening Concurrency Engine in Settings..." />
    </div>
  );
}
