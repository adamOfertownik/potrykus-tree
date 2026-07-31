"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { displayName } from "@/lib/db-client";

export function TreePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rootId = searchParams.get("root");
  const [highlightId, setHighlightId] = useState<string | null>(rootId);

  useEffect(() => {
    if (rootId) setHighlightId(rootId);
  }, [rootId]);

  return (
    <AuthedPage
      exportRootId={rootId || undefined}
      loadingLabel="Wczytywanie drzewa…"
    >
      {({ people, family }) => {
        const familyRoot = family.meta.rootPersonId || "";
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
          setHighlightId(null);
          router.replace("/drzewo");
        };

        const focusBranch = (id: string) => {
          setHighlightId(id);
          router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
        };

        return (
          <>
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
              <div
                className="tree-focus-bar tree-focus-bar--highlight"
                role="status"
              >
                <p>
                  Podświetlone: <strong>{displayName(highlightPerson)}</strong>{" "}
                  — całe drzewo zostaje widoczne
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
          </>
        );
      }}
    </AuthedPage>
  );
}
