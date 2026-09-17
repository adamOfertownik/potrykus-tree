"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { displayName } from "@/lib/db-client";
import { findApexPersonId } from "@/lib/tree";

export function TreePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlRoot = searchParams.get("root");
  const urlHighlight = searchParams.get("hl");
  const [viewRoot, setViewRoot] = useState<string | null>(urlRoot);
  const [highlightId, setHighlightId] = useState<string | null>(
    urlRoot || urlHighlight,
  );

  useEffect(() => {
    setViewRoot(urlRoot);
  }, [urlRoot]);

  useEffect(() => {
    if (urlRoot) setHighlightId(urlRoot);
    else if (urlHighlight) setHighlightId(urlHighlight);
  }, [urlRoot, urlHighlight]);

  return (
    <AuthedPage
      exportRootId={viewRoot || undefined}
      loadingLabel="Wczytywanie drzewa…"
      immersive
    >
      {({ people, family }) => {
        const familyRoot = family.meta.rootPersonId || people[0]?.id || "";
        const apexId = familyRoot
          ? findApexPersonId(people, familyRoot)
          : "";
        const defaultMain = apexId || familyRoot;
        const effectiveRoot = viewRoot || defaultMain;
        const focusedAway =
          Boolean(viewRoot) &&
          Boolean(defaultMain) &&
          viewRoot !== defaultMain;
        const focusPerson = focusedAway
          ? people.find((p) => p.id === viewRoot) ?? null
          : null;
        const highlightPerson = highlightId
          ? people.find((p) => p.id === highlightId) ?? null
          : null;

        const goFullTree = () => {
          const stayOn = highlightId || viewRoot;
          if (stayOn) setHighlightId(stayOn);
          setViewRoot(null);
          router.replace("/drzewo");
        };

        const focusBranch = (id: string) => {
          setHighlightId(id);
          setViewRoot(id);
          router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
        };

        return (
          <div className="tree-page">
            <section className="tree-page__chrome">
              <PersonSearch
                people={people}
                placeholder="Szukaj w drzewie…"
                className="person-search--overlay"
                onSelect={(p) => setHighlightId(p.id)}
              />

              {focusedAway && (
                <div className="tree-focus-bar" role="status">
                  <p>
                    <span className="only-narrow">Wokół: </span>
                    <span className="only-wide">Widok wokół: </span>
                    <strong>
                      {focusPerson ? displayName(focusPerson) : "wybranej osoby"}
                    </strong>
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-testid="full-tree-back"
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
                    <span className="only-wide">Podświetlone: </span>
                    <strong>{displayName(highlightPerson)}</strong>
                  </p>
                  <div className="tree-focus-bar__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => focusBranch(highlightPerson.id)}
                    >
                      Ta gałąź
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
            </section>

            <div className="tree-scroll tree-scroll--chart">
              {effectiveRoot ? (
                <FamilyChartView
                  people={people}
                  mainId={effectiveRoot}
                  highlightId={highlightId}
                  overview={!viewRoot}
                  onHighlight={setHighlightId}
                  onFocusBranch={focusBranch}
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
