"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { FamilyChartView } from "@/components/FamilyChartView";
import { MeetingBranchPanel } from "@/components/MeetingBranchPanel";
import { PersonSearch } from "@/components/PersonSearch";
import { useIdentity } from "@/components/IdentityProvider";
import { displayName } from "@/lib/db-client";
import {
  getFamilyTreeChoices,
  isOnMainFamilyTree,
  treeChoiceForPerson,
} from "@/lib/list";
import { GENERATION_TRUNK_ID } from "@/lib/chartOverview";
import { MEETING_ROOT_ID } from "@/lib/meetingBranches";
import { findApexPersonId } from "@/lib/tree";
import type { FamilyPayload } from "@/types/family";

function startHighlight(
  urlRoot: string | null,
  urlHighlight: string | null,
): string | null {
  if (urlRoot) return urlRoot;
  if (urlHighlight) return urlHighlight;
  return GENERATION_TRUNK_ID;
}

export function TreePageClient() {
  const searchParams = useSearchParams();
  const urlRoot = searchParams.get("root");
  const urlHighlight = searchParams.get("hl");

  return (
    <AuthedPage
      exportRootId={urlRoot || undefined}
      loadingLabel="Wczytywanie drzewa…"
      immersive
    >
      {({ people, family }) => (
        <TreePageBody
          people={people}
          family={family}
          urlRoot={urlRoot}
          urlHighlight={urlHighlight}
        />
      )}
    </AuthedPage>
  );
}

function TreePageBody({
  people,
  family,
  urlRoot,
  urlHighlight,
}: {
  people: FamilyPayload["people"];
  family: FamilyPayload;
  urlRoot: string | null;
  urlHighlight: string | null;
}) {
  const router = useRouter();
  const { identity, promptIdentity } = useIdentity();
  const [viewRoot, setViewRoot] = useState<string | null>(urlRoot);
  const [highlightId, setHighlightId] = useState<string | null>(() =>
    startHighlight(urlRoot, urlHighlight),
  );
  const [chartMissing, setChartMissing] = useState(false);

  useEffect(() => {
    setViewRoot(urlRoot);
  }, [urlRoot]);

  useEffect(() => {
    if (urlRoot) {
      setHighlightId(urlRoot);
      return;
    }
    if (urlHighlight) {
      setHighlightId(urlHighlight);
      return;
    }
    if (identity?.personId) {
      setHighlightId(identity.personId);
      return;
    }
    setHighlightId(GENERATION_TRUNK_ID);
  }, [urlRoot, urlHighlight, identity?.personId]);

  useEffect(() => {
    setChartMissing(false);
  }, [highlightId, viewRoot]);

  const familyRoot = family.meta.rootPersonId || people[0]?.id || "";
  const apexId = familyRoot ? findApexPersonId(people, familyRoot) : "";
  const defaultMain = apexId || familyRoot;
  const treeChoices = getFamilyTreeChoices(people, familyRoot);
  const currentChoice = viewRoot
    ? treeChoiceForPerson(people, viewRoot, familyRoot)
    : treeChoices.find((choice) => !choice.detached) ?? treeChoices[0] ?? null;
  const viewingDetachedTree = Boolean(currentChoice?.detached);
  const effectiveRoot = viewRoot || defaultMain;
  const focusedAway =
    Boolean(viewRoot) && Boolean(defaultMain) && viewRoot !== defaultMain;
  const focusPerson = focusedAway
    ? people.find((p) => p.id === viewRoot) ?? null
    : null;
  const highlightPerson = highlightId
    ? people.find((p) => p.id === highlightId) ?? null
    : null;
  const offTrunk = Boolean(
    highlightId && !isOnMainFamilyTree(people, highlightId, familyRoot),
  );
  const showOffTrunk = Boolean(highlightPerson && (offTrunk || chartMissing));

  const replaceTreeUrl = (href: string) => {
    router.replace(href);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", href);
    }
  };

  const focusPersonInTree = (id: string) => {
    setViewRoot(null);
    setHighlightId(id);
    setChartMissing(false);
    replaceTreeUrl(`/drzewo?hl=${encodeURIComponent(id)}`);
  };

  const fullTreeHref = (() => {
    const stayOn = highlightId || viewRoot;
    return stayOn ? `/drzewo?hl=${encodeURIComponent(stayOn)}` : "/drzewo";
  })();

  const focusBranch = (id: string) => {
    setHighlightId(id);
    setViewRoot(id);
    setChartMissing(false);
    replaceTreeUrl(`/drzewo?root=${encodeURIComponent(id)}`);
  };

  const clearHighlight = () => {
    const home = identity?.personId || GENERATION_TRUNK_ID;
    setViewRoot(null);
    setHighlightId(home);
    setChartMissing(false);
    replaceTreeUrl(`/drzewo?hl=${encodeURIComponent(home)}`);
  };

  return (
    <div className="tree-page">
      <section className="tree-page__chrome">
        <PersonSearch
          people={people}
          placeholder="Szukaj w drzewie…"
          className="person-search--overlay"
          onSelect={(p) => focusPersonInTree(p.id)}
          trailing={
            <button
              type="button"
              className="btn btn-secondary btn-mini tree-who-btn"
              data-testid="change-who"
              title="Zmień, kim jesteś na tym urządzeniu"
              onClick={promptIdentity}
            >
              Ja
            </button>
          }
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
                  const home = identity?.personId || GENERATION_TRUNK_ID;
                  setHighlightId(home);
                  setViewRoot(null);
                  setChartMissing(false);
                  replaceTreeUrl(`/drzewo?hl=${encodeURIComponent(home)}`);
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
              href={fullTreeHref}
              className="btn btn-primary"
              data-testid="full-tree-back"
              onClick={() => {
                setViewRoot(null);
                setChartMissing(false);
              }}
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
                href={`/lista?hl=${encodeURIComponent(highlightPerson.id)}`}
                className="btn btn-secondary"
                data-testid="tree-off-trunk-list"
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
                onClick={clearHighlight}
              >
                Wyczyść
              </button>
            </div>
          </div>
        )}
      </section>

      {viewRoot === MEETING_ROOT_ID && (
        <div className="tree-page__meeting-bar">
          <MeetingBranchPanel
            people={people}
            attendingPersonIds={family.attendingPersonIds ?? []}
            variant="bar"
          />
        </div>
      )}

      <div className="tree-scroll tree-scroll--chart">
        {effectiveRoot ? (
          <FamilyChartView
            people={people}
            mainId={effectiveRoot}
            highlightId={highlightId}
            attendingPersonIds={family.attendingPersonIds}
            overview
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
}
