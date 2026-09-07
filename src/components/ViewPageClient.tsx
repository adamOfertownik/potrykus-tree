"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ViewGate } from "@/components/ViewGate";
import { useAuthStatus } from "@/lib/hooks";

export function ViewPageClient() {
  const router = useRouter();
  const auth = useAuthStatus();

  useEffect(() => {
    if (auth.data?.unlocked) router.replace("/drzewo");
  }, [auth.data?.unlocked, router]);

  if (auth.isLoading || auth.data?.unlocked) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return <ViewGate />;
}
