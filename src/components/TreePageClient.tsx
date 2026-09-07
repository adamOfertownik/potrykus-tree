"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { PersonSearch } from "@/components/PersonSearch";
import { ReportPersonDataModal } from "@/components/ReportPersonDataModal";
import { displayName } from "@/lib/db-client";

export function TreePageClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rootId = searchParams.get("root");
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const highlightId = pickedId ?? rootId;

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
        const reportPerson = reportId
          ? people.find((p) => p.id === reportId) ?? null
          : null;

        const goFullTree = () => {
          setPickedId(null);
          router.replace("/drzewo");
        };

        const focusBranch = (id: string) => {
          setPickedId(id);
          router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
        };

        return (
          <>
            <section className="toolbar toolbar--tree">
              <PersonSearch
                people={people}
                placeholder="Szukaj w drzewie…"
                onSelect={(p) => setPickedId(p.id)}
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
                <div className="tree-focus-bar__actions">
                  {focusPerson && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setReportId(focusPerson.id)}
                    >
                      Zgłoś błędne dane
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={goFullTree}
                  >
                    ← Pełne drzewo
                  </button>
                </div>
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
                    onClick={() => setReportId(highlightPerson.id)}
                  >
                    Zgłoś błędne dane
                  </button>
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
                    onClick={() => setPickedId(null)}
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
                  onHighlight={setPickedId}
                  onFocusBranch={focusBranch}
                  onHighlightMissing={focusBranch}
                />
              ) : (
                <p className="empty-hint">Brak danych drzewa.</p>
              )}
            </div>

            {reportPerson && (
              <ReportPersonDataModal
                open
                person={reportPerson}
                onClose={() => setReportId(null)}
              />
            )}
          </>
        );
      }}
    </AuthedPage>
  );
}
