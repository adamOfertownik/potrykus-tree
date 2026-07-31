"use client";

import { useEffect, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { displayName } from "@/lib/db-client";
import Link from "next/link";

export function TreePageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const searchParams = useSearchParams();

  // Read ?root= on first paint — don't wait for useEffect (that centered on Franciszek)
  const [rootId, setRootId] = useState<string | null>(
    () => searchParams.get("root"),
  );

  useEffect(() => {
    setRootId(searchParams.get("root"));
  }, [searchParams]);

  const people = family.data?.people ?? [];
  const meta = family.data?.meta;
  const familyRoot = meta?.rootPersonId || "";
  const effectiveRoot = rootId || familyRoot;
  const focusedAway =
    Boolean(rootId) && Boolean(familyRoot) && rootId !== familyRoot;
  const focusPerson = focusedAway
    ? people.find((p) => p.id === rootId) ?? null
    : null;

  const goFullTree = () => {
    setRootId(null);
    window.location.assign("/drzewo");
  };

  const focusBranch = (id: string) => {
    setRootId(id);
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
          onSelect={(p) => focusBranch(p.id)}
        />
        <Link href="/pokrewienstwo" className="btn btn-secondary btn-inline">
          Kto kim?
        </Link>
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

      <div className="tree-scroll tree-scroll--chart">
        {effectiveRoot ? (
          <FamilyChartView
            people={people}
            mainId={effectiveRoot}
            onFocusBranch={focusBranch}
          />
        ) : (
          <p className="empty-hint">Brak danych drzewa.</p>
        )}
      </div>
    </AppShell>
  );
}
