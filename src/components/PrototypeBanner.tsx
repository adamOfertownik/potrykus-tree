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
          ? "Ta strona nie widzi Neona. W Vercel musi być potrykus_DATABASE_URL (Production i Preview), potem Redeploy."
          : "Ładowanie stanu zapisu…"}
      </span>
    </aside>
  );
}
