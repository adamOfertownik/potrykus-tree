"use client";

import type { ReactNode } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import type { FamilyPayload } from "@/types/family";

type Props = {
  children: (ctx: {
    family: FamilyPayload;
    people: FamilyPayload["people"];
  }) => ReactNode;
  exportRootId?: string;
  loadingLabel?: string;
};

export function AuthedPage({
  children,
  exportRootId,
  loadingLabel = "Wczytywanie…",
}: Props) {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);

  if (auth.isLoading) {
    return <div className="loading-screen">Ładowanie…</div>;
  }
  if (!auth.data?.unlocked) {
    return <AccessGate />;
  }
  if (family.isLoading) {
    return (
      <AppShell>
        <div className="loading-screen">{loadingLabel}</div>
      </AppShell>
    );
  }
  if (family.isError || !family.data) {
    return (
      <AppShell>
        <div className="loading-screen">
          Nie udało się wczytać danych. Odśwież stronę lub podaj kod ponownie.
        </div>
      </AppShell>
    );
  }

  const people = family.data.people;

  return (
    <AppShell peopleCount={people.length} exportRootId={exportRootId}>
      {children({ family: family.data, people })}
    </AppShell>
  );
}
