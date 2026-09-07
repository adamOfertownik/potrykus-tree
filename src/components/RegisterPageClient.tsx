"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterGate } from "@/components/RegisterGate";
import { useAuthStatus } from "@/lib/hooks";

export function RegisterPageClient() {
  const router = useRouter();
  const auth = useAuthStatus();

  useEffect(() => {
    if (auth.data?.unlocked) router.replace("/drzewo");
  }, [auth.data?.unlocked, router]);

  if (auth.isLoading || auth.data?.unlocked) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return <RegisterGate />;
}
