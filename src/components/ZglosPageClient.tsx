"use client";

import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { ChangeRequestPanel } from "@/components/ChangeRequestPanel";
import { useAuthStatus, useFamily } from "@/lib/hooks";

export function ZglosPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || !family.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie…</div>
      </AppShell>
    );
  }

  return (
    <AppShell peopleCount={family.data.people.length}>
      <ChangeRequestPanel people={family.data.people} />
    </AppShell>
  );
}
