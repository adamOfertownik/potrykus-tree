"use client";

import { useEffect, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";

export function TreePageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [rootId, setRootId] = useState<string | null>(null);

  useEffect(() => {
    const root = searchParams.get("root");
    if (root) setRootId(root);
  }, [searchParams]);

  const people = family.data?.people ?? [];
  const meta = family.data?.meta;
  const effectiveRoot = rootId || meta?.rootPersonId || "";

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
      <section className="toolbar">
        <PersonSearch
          people={people}
          placeholder="Szukaj w drzewie…"
          onSelect={(p) => {
            setRootId(p.id);
            router.replace(`/drzewo?root=${encodeURIComponent(p.id)}`);
          }}
        />
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setRootId(meta?.rootPersonId || null);
              router.replace("/drzewo");
            }}
          >
            Od korzenia
          </button>
        </div>
      </section>

      <div className="tree-scroll tree-scroll--chart">
        {effectiveRoot ? (
          <FamilyChartView
            people={people}
            mainId={effectiveRoot}
            onMainChange={(id) => {
              setRootId(id);
              router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
            }}
          />
        ) : (
          <p className="empty-hint">Brak danych drzewa.</p>
        )}
      </div>
    </AppShell>
  );
}
