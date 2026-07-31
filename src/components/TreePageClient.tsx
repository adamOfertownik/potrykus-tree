"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";

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

        const goFullTree = () => {
          setHighlightId(null);
          router.replace("/drzewo");
        };

        const focusBranch = (id: string) => {
          setHighlightId(id);
          router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
        };

        return (
          <div className="tree-page">
            <section className="toolbar toolbar--tree">
              <PersonSearch
                people={people}
                placeholder="Szukaj w drzewie…"
                compact
                onSelect={(p) => setHighlightId(p.id)}
              />
            </section>

            <div className="tree-scroll tree-scroll--chart">
              {effectiveRoot ? (
                <FamilyChartView
                  people={people}
                  mainId={effectiveRoot}
                  highlightId={highlightId}
                  focusedAway={focusedAway}
                  onHighlight={setHighlightId}
                  onFocusBranch={focusBranch}
                  onClearHighlight={() => {
                    if (focusedAway) goFullTree();
                    else setHighlightId(null);
                  }}
                  onShowFullTree={goFullTree}
                  onHighlightMissing={focusBranch}
                />
              ) : (
                <p className="empty-hint">Brak danych drzewa.</p>
              )}
            </div>
          </div>
        );
      }}
    </AuthedPage>
  );
}
