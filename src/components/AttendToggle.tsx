"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAdminAuthStatus } from "@/lib/hooks";

type Props = {
  personId: string;
  fullName: string;
  attending: boolean;
  compact?: boolean;
};

export function AttendToggle({
  personId,
  fullName,
  attending,
  compact = false,
}: Props) {
  const admin = useAdminAuthStatus();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!admin.data?.loggedIn) return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/event/attend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          fullName,
          attending: !attending,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["event"] }),
        qc.invalidateQueries({ queryKey: ["family"] }),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="attend-toggle">
      <button
        type="button"
        className={`genealogy-attend${attending ? " is-on" : ""}${
          compact ? " is-compact" : ""
        }`}
        disabled={busy}
        title={
          attending
            ? "Administrator: usuń zapis na spotkanie"
            : "Administrator: zaznacz zapis na spotkanie"
        }
        onClick={toggle}
      >
        {busy ? "…" : attending ? "wypisz" : "zapisz"}
      </button>
      {error ? (
        <span className="attend-toggle__err" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
