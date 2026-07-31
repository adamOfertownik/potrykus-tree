"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthedPage } from "@/components/AuthedPage";
import { PersonSearch } from "@/components/PersonSearch";
import { buildDescendantList } from "@/lib/list";
import { displayName, formatPolishDate } from "@/lib/db-client";
import type { Person } from "@/types/family";

function ListInner({
  people,
  rootId,
}: {
  people: Person[];
  rootId: string;
}) {
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
      </section>

      <div className="genealogy-panel">
        <header className="genealogy-panel__head">
          <h1>Lista potomków</h1>
          <p>
            Hierarchia z widocznymi powiązaniami — jak w dokumencie rodzinnym.
            PDF pobierzesz z menu u góry.
          </p>
        </header>

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
