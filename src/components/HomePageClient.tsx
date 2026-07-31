"use client";

import { useEffect } from "react";
import { AccessGate } from "@/components/AccessGate";
import { useAuthStatus } from "@/lib/hooks";

/**
 * Entry at `/` — show the family code gate for new visitors.
 * Do NOT server-redirect to /drzewo (that hop broke mobile + SW).
 * Already unlocked → continue to the tree.
 */
export function HomePageClient() {
  const auth = useAuthStatus();

  useEffect(() => {
    if (auth.data?.unlocked) {
      window.location.replace("/drzewo");
    }
  }, [auth.data?.unlocked]);

  if (auth.isLoading) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  if (auth.data?.unlocked) {
    return <div className="loading-screen">Przechodzę do drzewa…</div>;
  }

  return <AccessGate afterUnlockHref="/drzewo" />;
}
