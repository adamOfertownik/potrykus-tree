"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AccessGate } from "@/components/AccessGate";
import { useAuthStatus } from "@/lib/hooks";

export function LoginPageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const auth = useAuthStatus();
  const nextHref = searchParams.get("next") || "/drzewo";

  useEffect(() => {
    if (!auth.data?.unlocked) return;
    if (nextHref.startsWith("/admin") && auth.data.role !== "admin") {
      router.replace("/drzewo");
      return;
    }
    router.replace(nextHref);
  }, [auth.data, nextHref, router]);

  if (auth.isLoading || auth.data?.unlocked) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return <AccessGate afterLoginHref={nextHref} />;
}
