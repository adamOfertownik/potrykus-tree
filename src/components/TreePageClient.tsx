"use client";

import { useEffect, useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { FamilyTreeView } from "@/components/FamilyTreeView";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { buildDescendantTree, searchPeople } from "@/lib/tree";
import { exportListPdf, exportTreeA0Pdf } from "@/lib/pdf";
import { displayName } from "@/lib/db-client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function TreePageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [rootId, setRootId] = useState<string | null>(null);

  useEffect(() => {
    const root = searchParams.get("root");
    if (root) setRootId(root);
  }, [searchParams]);
  const [pdfBusy, setPdfBusy] = useState<"list" | "a0" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const people = family.data?.people ?? [];
  const meta = family.data?.meta;
  const effectiveRoot = rootId || meta?.rootPersonId || "";

  const tree = useMemo(() => {
    if (!people.length || !effectiveRoot) return null;
    return buildDescendantTree(people, effectiveRoot);
  }, [people, effectiveRoot]);

  const matches = useMemo(
    () => (query.trim() ? searchPeople(people, query).slice(0, 12) : []),
    [people, query],
  );

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

  const onExportList = () => {
    setPdfError(null);
    setPdfBusy("list");
    try {
      exportListPdf(people, effectiveRoot, meta?.title || "Drzewo Potrykus");
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfBusy(null);
    }
  };

  const onExportA0 = async () => {
    setPdfError(null);
    setPdfBusy("a0");
    try {
      await exportTreeA0Pdf();
    } catch (e) {
      setPdfError((e as Error).message);
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <AppShell peopleCount={people.length}>
      <section className="toolbar">
        <div className="search-wrap">
          <input
            type="search"
            placeholder="Znajdź osobę…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
          {matches.length > 0 && (
            <ul className="search-results">
              {matches.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/osoba/${p.id}`}
                    onClick={() => {
                      setRootId(p.id);
                      setQuery("");
                    }}
                  >
                    {displayName(p)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRootId(meta?.rootPersonId || null)}
          >
            Od korzenia
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pdfBusy !== null}
            onClick={onExportList}
          >
            {pdfBusy === "list" ? "PDF…" : "PDF lista"}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pdfBusy !== null}
            onClick={onExportA0}
          >
            {pdfBusy === "a0" ? "A0…" : "PDF A0"}
          </button>
        </div>
      </section>

      {pdfError && (
        <p className="banner-error" role="alert">
          {pdfError}
        </p>
      )}

      <div className="tree-scroll">
        {tree ? (
          <FamilyTreeView root={tree} focusId={effectiveRoot} />
        ) : (
          <p className="empty-hint">Brak danych drzewa dla wybranego korzenia.</p>
        )}
      </div>
    </AppShell>
  );
}
