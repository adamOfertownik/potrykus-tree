"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { PersonSearch } from "@/components/PersonSearch";
import { buildDescendantList } from "@/lib/list";
import { displayName, formatPolishDate } from "@/lib/db-client";
import type { Person } from "@/types/family";

function birthSortKey(iso?: string): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function AgeList({ people }: { people: Person[] }) {
  const sorted = useMemo(() => {
    return [...people]
      .filter((p) => !p.id.startsWith("unknown"))
      .sort((a, b) => {
        const byBirth = birthSortKey(a.birthDate) - birthSortKey(b.birthDate);
        if (byBirth !== 0) return byBirth;
        return displayName(a).localeCompare(displayName(b), "pl");
      });
  }, [people]);

  return (
    <ul className="age-list">
      {sorted.map((p) => (
        <li key={p.id} className="age-list__row">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.photoUrl} alt="" className="age-list__photo" />
          ) : (
            <span className="age-list__photo age-list__photo--empty" aria-hidden>
              {p.firstName.slice(0, 1)}
            </span>
          )}
          <div>
            <Link href={`/osoba/${p.id}`} className="genealogy-name">
              {displayName(p)}
            </Link>
            <p className="age-list__meta">
              {p.birthDate
                ? `ur. ${formatPolishDate(p.birthDate)}`
                : "data urodzenia nieznana"}
              {p.deathDate ? ` · zm. ${formatPolishDate(p.deathDate)}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ListInner({
  people,
  rootId,
}: {
  people: Person[];
  rootId: string;
}) {
  const [view, setView] = useState<"tree" | "age">("age");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const router = useRouter();
  const entries = useMemo(
    () =>
      people.length && rootId ? buildDescendantList(people, rootId) : [],
    [people, rootId],
  );

  return (
    <>
      <section className="toolbar">
        <PersonSearch
          people={people}
          placeholder="Szukaj na liście…"
          onSelect={(p) => {
            setHighlightId(p.id);
            document
              .getElementById(`list-person-${p.id}`)
              ?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
        <div className="list-view-toggle" role="group" aria-label="Widok listy">
          <button
            type="button"
            className={`btn btn-mini ${view === "age" ? "is-active" : ""}`}
            onClick={() => setView("age")}
          >
            Od najstarszego
          </button>
          <button
            type="button"
            className={`btn btn-mini ${view === "tree" ? "is-active" : ""}`}
            onClick={() => setView("tree")}
          >
            Hierarchia
          </button>
        </div>
      </section>

      <div className="genealogy-panel">
        <header className="genealogy-panel__head">
          <h1>
            {view === "age" ? "Lista od najstarszego" : "Lista potomków"}
          </h1>
          <p>
            {view === "age"
              ? "Wszyscy z drzewa, od najstarszej daty urodzenia, ze zdjęciem gdy jest w kartotece."
              : "Hierarchia z widocznymi powiązaniami — jak w dokumencie rodzinnym. PDF pobierzesz z menu u góry."}
          </p>
        </header>

        {view === "age" ? (
          <AgeList people={people} />
        ) : (
        <ol className="genealogy-list">
          {entries.map((entry) => {
            const birth = formatPolishDate(entry.person.birthDate);
            const death = formatPolishDate(entry.person.deathDate);
            const depth = Math.floor(entry.railDepth);
            const isHighlight = highlightId === entry.person.id;

            return (
              <li
                key={`${entry.person.id}-${entry.isSpouse ? "s" : "p"}-${entry.depth}`}
                id={
                  entry.isSpouse ? undefined : `list-person-${entry.person.id}`
                }
                className={[
                  "genealogy-item",
                  entry.isSpouse ? "is-spouse" : "is-person",
                  entry.isLast ? "is-last" : "",
                  isHighlight ? "is-highlight" : "",
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
                  {!entry.isSpouse && (
                    <span className="genealogy-gen">{entry.generation}.</span>
                  )}
                  {entry.isSpouse && (
                    <span className="genealogy-spouse">małż.</span>
                  )}
                  <Link
                    href={`/osoba/${entry.person.id}`}
                    className="genealogy-name"
                  >
                    {displayName(entry.person)}
                  </Link>
                  {birth && <span className="genealogy-date"> u. {birth}</span>}
                  {death && <span className="genealogy-date"> z. {death}</span>}
                  {!entry.isSpouse && (
                    <button
                      type="button"
                      className="genealogy-focus"
                      title="Pokaż w drzewie"
                      onClick={() =>
                        router.push(
                          `/drzewo?root=${encodeURIComponent(entry.person.id)}`,
                        )
                      }
                    >
                      drzewo
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        )}
      </div>
    </>
  );
}

export function ListPageClient() {
  return (
    <AuthedPage loadingLabel="Wczytywanie listy…">
      {({ people, family }) => (
        <ListInner people={people} rootId={family.meta.rootPersonId ?? ""} />
      )}
    </AuthedPage>
  );
}
