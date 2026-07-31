"use client";

import { useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { displayName } from "@/lib/db-client";

export function TreePageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const searchParams = useSearchParams();

  // Focus lives in the URL; every change of it goes through a full navigation
  const rootId = searchParams.get("root");
  const [highlightId, setHighlightId] = useState<string | null>(rootId);

  const people = family.data?.people ?? [];
  const meta = family.data?.meta;
  const familyRoot = meta?.rootPersonId || "";
  const effectiveRoot = rootId || familyRoot;
  const focusedAway =
    Boolean(rootId) && Boolean(familyRoot) && rootId !== familyRoot;
  const focusPerson = focusedAway
    ? people.find((p) => p.id === rootId) ?? null
    : null;
  const highlightPerson = highlightId
    ? people.find((p) => p.id === highlightId) ?? null
    : null;

  const goFullTree = () => {
    window.location.assign("/drzewo");
  };

  const focusBranch = (id: string) => {
    window.location.assign(`/drzewo?root=${encodeURIComponent(id)}`);
  };

  if (auth.isLoading) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  if (!auth.data?.unlocked) {
    return <AccessGate />;
  }

  if (family.isLoading) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie drzewa…</div>
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

  return (
    <AppShell peopleCount={people.length} exportRootId={effectiveRoot}>
      <section className="toolbar toolbar--tree">
        <PersonSearch
          people={people}
          placeholder="Szukaj w drzewie…"
          onSelect={(p) => setHighlightId(p.id)}
        />
      </section>

      {focusedAway && (
        <div className="tree-focus-bar" role="status">
          <p>
            Widok wokół:{" "}
            <strong>
              {focusPerson ? displayName(focusPerson) : "wybranej osoby"}
            </strong>
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={goFullTree}
          >
            ← Pełne drzewo
          </button>
        </div>
      )}

      {highlightPerson && !focusedAway && (
        <div className="tree-focus-bar tree-focus-bar--highlight" role="status">
          <p>
            Podświetlone: <strong>{displayName(highlightPerson)}</strong> — całe
            drzewo zostaje widoczne
          </p>
          <div className="tree-focus-bar__actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => focusBranch(highlightPerson.id)}
            >
              Pokaż tylko tę gałąź
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setHighlightId(null)}
            >
              Wyczyść
            </button>
          </div>
        </div>
      )}

      <div className="tree-scroll tree-scroll--chart">
        {effectiveRoot ? (
          <FamilyChartView
            people={people}
            mainId={effectiveRoot}
            highlightId={highlightId}
            onHighlight={setHighlightId}
            onFocusBranch={focusBranch}
            onHighlightMissing={focusBranch}
          />
        ) : (
          <p className="empty-hint">Brak danych drzewa.</p>
        )}
      </div>
    </AppShell>
  );
}
