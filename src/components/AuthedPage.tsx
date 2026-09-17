"use client";

import type { ReactNode } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { DraftGraphBanner } from "@/components/DraftGraphBanner";
import { useDraftGraph } from "@/components/DraftGraphProvider";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import type { FamilyPayload } from "@/types/family";

type Props = {
  children: (ctx: {
    family: FamilyPayload;
    people: FamilyPayload["people"];
  }) => ReactNode;
  exportRootId?: string;
  loadingLabel?: string;
  /** Edge-to-edge main (tree graph) */
  immersive?: boolean;
};

export function AuthedPage({
  children,
  exportRootId,
  loadingLabel = "Wczytywanie…",
  immersive = false,
}: Props) {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const drafts = useDraftGraph();

  if (auth.isLoading) {
    return <div className="loading-screen">Ładowanie…</div>;
  }
  if (!auth.data?.unlocked) {
    return <AccessGate />;
  }
  if (family.isLoading) {
    return (
      <AppShell immersive={immersive}>
        <div className="loading-screen">{loadingLabel}</div>
      </AppShell>
    );
  }
  if (family.isError || !family.data) {
    return (
      <AppShell immersive={immersive}>
        <div className="loading-screen">
          Nie udało się wczytać danych. Odśwież stronę lub podaj kod ponownie.
        </div>
      </AppShell>
    );
  }

  const people = drafts.mergePeople(family.data.people);
  const mergedFamily = { ...family.data, people };

  return (
    <AppShell
      peopleCount={people.length}
      exportRootId={exportRootId}
      immersive={immersive}
    >
      <DraftGraphBanner />
      {children({ family: mergedFamily, people })}
    </AppShell>
  );
}
