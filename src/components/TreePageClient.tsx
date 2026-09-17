"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { MeetingBranchPanel } from "@/components/MeetingBranchPanel";
import { PersonSearch } from "@/components/PersonSearch";
import { displayName } from "@/lib/db-client";
import {
  getFamilyTreeChoices,
  isOnMainFamilyTree,
  treeChoiceForPerson,
} from "@/lib/list";
import { MEETING_ROOT_ID, MEETING_TREE_HREF } from "@/lib/meetingBranches";
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
  const [chartMissing, setChartMissing] = useState(false);

  useEffect(() => {
    setViewRoot(urlRoot);
  }, [urlRoot]);

  useEffect(() => {
    if (urlRoot) setHighlightId(urlRoot);
    else if (urlHighlight) setHighlightId(urlHighlight);
  }, [urlRoot, urlHighlight]);

  useEffect(() => {
    setChartMissing(false);
  }, [highlightId, viewRoot]);

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
        const treeChoices = getFamilyTreeChoices(people, familyRoot);
        const currentChoice = viewRoot
          ? treeChoiceForPerson(people, viewRoot, familyRoot)
          : treeChoices.find((choice) => !choice.detached) ?? treeChoices[0] ?? null;
        const viewingDetachedTree = Boolean(currentChoice?.detached);
        const effectiveRoot = viewRoot || defaultMain;
        const focusedAway =
          Boolean(viewRoot) &&
          Boolean(defaultMain) &&
          viewRoot !== defaultMain;
        const chartOverview =
          !highlightId || highlightId === effectiveRoot;
        const focusPerson = focusedAway
          ? people.find((p) => p.id === viewRoot) ?? null
          : null;
        const highlightPerson = highlightId
          ? people.find((p) => p.id === highlightId) ?? null
          : null;
        const offTrunk = Boolean(
          highlightId && !isOnMainFamilyTree(people, highlightId, familyRoot),
        );
        const showOffTrunk = Boolean(
          highlightPerson && (offTrunk || chartMissing),
        );

        const goFullTreeHref = (() => {
          const stayOn = highlightId || viewRoot;
          return stayOn
            ? `/drzewo?hl=${encodeURIComponent(stayOn)}`
            : "/drzewo";
        })();

        const focusBranch = (id: string) => {
          setHighlightId(id);
          setViewRoot(id);
          setChartMissing(false);
          router.replace(`/drzewo?root=${encodeURIComponent(id)}`);
        };

        const clearHighlight = () => {
          setHighlightId(null);
          setChartMissing(false);
          router.replace("/drzewo");
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

              {treeChoices.length > 0 && (
                <label className="tree-switcher" data-testid="tree-switcher">
                  <span>Które drzewo</span>
                  <select
                    value={currentChoice?.id || defaultMain}
                    aria-label="Które drzewo"
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const next = treeChoices.find((choice) => choice.id === nextId);
                      if (!next || !next.detached) {
                        setHighlightId(null);
                        setViewRoot(null);
                        setChartMissing(false);
                        router.replace("/drzewo");
                        return;
                      }
                      focusBranch(next.id);
                    }}
                  >
                    {treeChoices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.detached
                          ? `${choice.label} — brak w głównym pniu`
                          : choice.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {viewRoot !== MEETING_ROOT_ID && (
                <Link
                  href={MEETING_TREE_HREF}
                  className="btn btn-primary meeting-franciszek-btn meeting-franciszek-btn--compact"
                  data-testid="spotkanie-od-franciszka"
                >
                  Spotkanie od Franciszka
                </Link>
              )}

              {viewRoot === MEETING_ROOT_ID && (
                <MeetingBranchPanel
                  people={people}
                  attendingPersonIds={family.attendingPersonIds ?? []}
                  variant="bar"
                />
              )}

              {focusedAway && (
                <div className="tree-focus-bar" role="status">
                  <p>
                    <span className="only-narrow">Wokół: </span>
                    <span className="only-wide">Widok wokół: </span>
                    <strong>
                      {focusPerson ? displayName(focusPerson) : "wybranej osoby"}
                    </strong>
                  </p>
                  <Link
                    href={goFullTreeHref}
                    className="btn btn-primary"
                    data-testid="full-tree-back"
                  >
                    ← Pełne drzewo
                  </Link>
                  {showOffTrunk && !viewingDetachedTree && (
                    <p className="tree-focus-bar__note">
                      Nie ma rodziców w głównym pniu Potrykusów. Na liście ta
                      osoba jest w „Pozostałe osoby” (numeracja od 1.), a pełny
                      graf tej karty nie pokazuje.
                    </p>
                  )}
                </div>
              )}

              {viewingDetachedTree && currentChoice && (
                <div
                  className="tree-focus-bar tree-focus-bar--detached"
                  role="status"
                  data-testid="tree-detached-caption"
                >
                  <p>
                    <strong>
                      {currentChoice.label.replace(/ · \d+ os\.$/, "")}
                    </strong>{" "}
                    — brak przypisania do głównej gałęzi. W bazie nie ma
                    rodziców, którzy łączą tę gałąź z pniem. Na liście jest w
                    „Pozostałe osoby”.
                  </p>
                </div>
              )}

              {highlightPerson && !focusedAway && showOffTrunk && (
                <div
                  className="tree-focus-bar tree-focus-bar--detached"
                  role="status"
                  data-testid="tree-off-trunk"
                >
                  <p>
                    <strong>{displayName(highlightPerson)}</strong> nie ma
                    powiązania z głównym drzewem — w bazie nie ma rodziców,
                    którzy łączą tę osobę z pniem. Dlatego na liście jest jako
                    1. w „Pozostałe osoby”, a na tym grafie karty nie widać.
                  </p>
                  <div className="tree-focus-bar__actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      data-testid="show-off-trunk-branch"
                      onClick={() => focusBranch(highlightPerson.id)}
                    >
                      Pokaż tę gałąź
                    </button>
                    <Link
                      href="/lista"
                      className="btn btn-secondary"
                    >
                      Lista
                    </Link>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={clearHighlight}
                    >
                      Wyczyść
                    </button>
                  </div>
                </div>
              )}

              {highlightPerson && !focusedAway && !showOffTrunk && (
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
                      onClick={clearHighlight}
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
                  attendingPersonIds={family.attendingPersonIds}
                  overview={chartOverview}
                  overviewNextGeneration={focusedAway}
                  onHighlight={setHighlightId}
                  onFocusBranch={focusBranch}
                  onHighlightMissing={(id) => {
                    if (id === highlightId) setChartMissing(true);
                  }}
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
