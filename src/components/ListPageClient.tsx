"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AttendToggle } from "@/components/AttendToggle";
import { AuthedPage } from "@/components/AuthedPage";
import { GraphEditHost } from "@/components/GraphEditHost";
import { PersonSearch } from "@/components/PersonSearch";
import { buildCompleteFamilyList } from "@/lib/list";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { meetingBranchLabel } from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollToListPerson(id: string): boolean {
  const el = document.querySelector(`[data-person-id="${CSS.escape(id)}"]`);
  if (!el) return false;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "center",
  });
  return true;
}

function scheduleScrollToListPerson(id: string) {
  const delays = [0, 80, 280, 640];
  const timers = delays.map((ms) =>
    window.setTimeout(() => scrollToListPerson(id), ms),
  );
  return () => timers.forEach((t) => window.clearTimeout(t));
}

function ListInner({
  people,
  rootId,
  attendingPersonIds,
  urlHighlight,
}: {
  people: Person[];
  rootId: string;
  attendingPersonIds: string[];
  urlHighlight: string | null;
}) {
  const [highlightId, setHighlightId] = useState<string | null>(urlHighlight);
  const [selected, setSelected] = useState<Person | null>(null);
  const router = useRouter();
  const entries = useMemo(
    () => (people.length ? buildCompleteFamilyList(people, rootId) : []),
    [people, rootId],
  );

  const attending = useMemo(
    () => new Set(attendingPersonIds),
    [attendingPersonIds],
  );

  const closeSelected = useCallback(() => setSelected(null), []);

  const goToPerson = useCallback(
    (person: Person) => {
      setSelected(null);
      router.push(`/osoba/${encodeURIComponent(person.id)}`);
    },
    [router],
  );

  const focusBranch = useCallback(
    (person: Person) => {
      setSelected(null);
      router.push(`/drzewo?root=${encodeURIComponent(person.id)}`);
    },
    [router],
  );

  const handleApplied = useCallback(
    ({ createdPersonId }: { createdPersonId?: string }) => {
      const id = createdPersonId || selected?.id;
      if (id) setHighlightId(id);
    },
    [selected],
  );

  useEffect(() => {
    if (urlHighlight) setHighlightId(urlHighlight);
  }, [urlHighlight]);

  useEffect(() => {
    if (!highlightId) return;
    return scheduleScrollToListPerson(highlightId);
  }, [highlightId, entries]);

  return (
    <>
      <section className="toolbar toolbar--list">
        <PersonSearch
          people={people}
          placeholder="Szukaj na liście…"
          onSelect={(p) => {
            setHighlightId(p.id);
            scrollToListPerson(p.id);
          }}
        />
      </section>

      <div className="genealogy-panel">
        <header className="genealogy-panel__head">
          <h1>Lista rodziny</h1>
          <p>
            Te same osoby co na drzewie — wszyscy z bazy Neon. Numer przy
            imieniu to pokolenie od najstarszego przodka (jeden pień, jedno
            „1.”), nie kolejny numer z bazy. PDF pobierzesz z menu u góry.
            Plus przy osobie dodaje dziecko, partnera albo przenosi gałąź.
            Pomarańczowa ramka oznacza zapis na spotkanie rodzinne.
            Szare pozycje z dopiskiem „roboczo” czekają na akceptację —
            możesz od razu dodać im dzieci i wysłać wszystko razem.
            Administrator może zaznaczyć zapis przyciskiem „zapisz”.
          </p>
        </header>

        <ol className="genealogy-list">
          {entries.map((entry, index) => {
            const birth = formatPolishDate(entry.person.birthDate);
            const death = formatPolishDate(entry.person.deathDate);
            const depth = Math.floor(entry.railDepth);
            const isHighlight = highlightId === entry.person.id;
            const isAttending = attending.has(entry.person.id);
            const isPending = Boolean(entry.person.pending);
            const showDetachedHead =
              Boolean(entry.detached) && !entries[index - 1]?.detached;
            const startOfDetachedTree =
              Boolean(entry.detached) &&
              !entry.isSpouse &&
              entry.depth === 0 &&
              entry.generation === 1;

            return (
              <Fragment
                key={`${entry.person.id}-${entry.isSpouse ? "s" : "p"}-${entry.depth}`}
              >
              {showDetachedHead && (
                <li className="genealogy-section">
                  <h2>Pozostałe osoby</h2>
                  <p>
                    Są w bazie, ale nie mają wpisanego rodzica w głównym pniu
                    — dlatego numeracja pokoleń zaczyna się tu od nowa od 1.
                    Każda taka gałąź to osobne drzewo, bez przypisania do
                    głównej gałęzi.
                  </p>
                </li>
              )}
              {startOfDetachedTree && (
                <li className="genealogy-section genealogy-section--branch">
                  <h3>{displayName(entry.person, people)}</h3>
                  <p>Brak przypisania do głównej gałęzi.</p>
                </li>
              )}
              <li
                data-person-id={entry.person.id}
                id={
                  entry.isSpouse
                    ? `list-person-${entry.person.id}-spouse-${entry.depth}`
                    : `list-person-${entry.person.id}`
                }
                className={[
                  "genealogy-item",
                  entry.isSpouse ? "is-spouse" : "is-person",
                  entry.isLast ? "is-last" : "",
                  isHighlight ? "is-highlight" : "",
                  isAttending ? "is-attending" : "",
                  isPending ? "is-pending" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  {
                    "--depth": depth,
                  } as React.CSSProperties
                }
              >
                <span className="genealogy-guides" aria-hidden>
                  {Array.from({ length: depth }).map((_, i) => (
                    <span
                      key={i}
                      className={[
                        "genealogy-guide",
                        entry.ancestorLast[i] ? "is-ended" : "is-cont",
                        i === depth - 1 ? "is-elbow" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ))}
                </span>

                <div className="genealogy-content">
                  <div className="genealogy-main">
                    {!entry.isSpouse && (
                      <span className="genealogy-gen">{entry.generation}.</span>
                    )}
                    {entry.isSpouse && (
                      <span className="genealogy-spouse">małż.</span>
                    )}
                    {isPending ? (
                      <span className="genealogy-name">{displayName(entry.person, people)}</span>
                    ) : (
                      <Link
                        href={`/osoba/${entry.person.id}`}
                        className="genealogy-name"
                      >
                        {displayName(entry.person, people)}
                      </Link>
                    )}
                    {isPending && (
                      <span className="pending-pill">roboczo</span>
                    )}
                    {isAttending && (
                      <span className="attending-pill">
                        {meetingBranchLabel(entry.person.id, people)}
                      </span>
                    )}
                    {birth && (
                      <span className="genealogy-date"> u. {birth}</span>
                    )}
                    {death && (
                      <span className="genealogy-date"> z. {death}</span>
                    )}
                    {!birth &&
                      !death &&
                      !entry.isSpouse &&
                      entry.person.firstName.trim().toUpperCase() === "NN" && (
                        <span className="genealogy-date"> imię nieznane</span>
                      )}
                  </div>
                  <span className="genealogy-actions">
                    <button
                      type="button"
                      className="genealogy-add"
                      aria-label={`Dodaj powiązanie: ${displayName(entry.person, people)}`}
                      title="Dodaj powiązanie"
                      onClick={() => setSelected(entry.person)}
                    >
                      +
                    </button>
                    {!isPending && (
                      <AttendToggle
                        personId={entry.person.id}
                        fullName={displayName(entry.person, people)}
                        attending={isAttending}
                        compact
                      />
                    )}
                    <button
                      type="button"
                      className="genealogy-focus"
                      title="Pokaż w drzewie"
                      onClick={() =>
                        router.push(
                          `/drzewo?hl=${encodeURIComponent(entry.person.id)}`,
                        )
                      }
                    >
                      drzewo
                    </button>
                  </span>
                </div>
              </li>
              </Fragment>
            );
          })}
        </ol>
      </div>

      <GraphEditHost
        people={people}
        person={selected}
        onClose={closeSelected}
        onViewPerson={goToPerson}
        onFocusBranch={focusBranch}
        onApplied={handleApplied}
        toastClassName="list-edit-toast"
      />
    </>
  );
}

export function ListPageClient() {
  const searchParams = useSearchParams();
  const urlHighlight = searchParams.get("hl");

  return (
    <AuthedPage loadingLabel="Wczytywanie listy…">
      {({ people, family }) => (
        <ListInner
          people={people}
          rootId={family.meta.rootPersonId ?? ""}
          attendingPersonIds={family.attendingPersonIds ?? []}
          urlHighlight={urlHighlight}
        />
      )}
    </AuthedPage>
  );
}
