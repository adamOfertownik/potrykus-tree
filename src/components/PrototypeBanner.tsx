"use client";

import { useAuthStatus } from "@/lib/hooks";

export function PrototypeBanner() {
  const auth = useAuthStatus();
  const storage = auth.data?.storage;
  // Hide once Neon is wired; keep a soft notice only for file fallback.
  if (storage === "neon") return null;

  return (
    <aside className="prototype-banner" role="status">
      <strong>Prototyp</strong>
      <span>
        {storage === "file"
          ? "Zapisy idą lokalnie — podłącz Neon (DATABASE_URL), żeby trwały na produkcji."
          : "Ładowanie stanu zapisu…"}
      </span>
    </aside>
  );
}
