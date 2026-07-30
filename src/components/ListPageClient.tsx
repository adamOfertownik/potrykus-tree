"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { PersonSearch } from "@/components/PersonSearch";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { buildDescendantList } from "@/lib/list";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { exportListPdf } from "@/lib/pdf";
import { useRouter } from "next/navigation";

export function ListPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const router = useRouter();

  const people = family.data?.people ?? [];
  const rootId = family.data?.meta.rootPersonId ?? "";

  const entries = useMemo(() => {
    if (!people.length || !rootId) return [];
    return buildDescendantList(people, rootId);
  }, [people, rootId]);

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie listy…</div>
      </AppShell>
    );
  }
  if (!family.data) {
    return (
      <AppShell>
        <div className="loading-screen">Brak danych.</div>
      </AppShell>
    );
  }

  return (
    <AppShell peopleCount={people.length}>
      <section className="toolbar">
        <PersonSearch
          people={people}
          placeholder="Szukaj na liście…"
          onSelect={(p) => {
            setHighlightId(p.id);
            const el = document.getElementById(`list-person-${p.id}`);
            el?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pdfBusy}
            onClick={async () => {
              setPdfBusy(true);
              try {
                await exportListPdf(
                  people,
                  rootId,
                  family.data?.meta.title || "Drzewo Potrykus",
                );
              } finally {
                setPdfBusy(false);
              }
            }}
          >
            {pdfBusy ? "Generuję PDF…" : "Pobierz PDF listy"}
          </button>
        </div>
      </section>

      <div className="genealogy-panel">
        <header className="genealogy-panel__head">
          <h1>Lista potomków</h1>
          <p>
            Hierarchia z widocznymi powiązaniami — jak w dokumencie rodzinnym.
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
                  entry.isSpouse
                    ? undefined
                    : `list-person-${entry.person.id}`
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
                  {birth && (
                    <span className="genealogy-date">
                      {" "}
                      u. {birth}
                    </span>
                  )}
                  {death && (
                    <span className="genealogy-date">
                      {" "}
                      z. {death}
                    </span>
                  )}
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
    </AppShell>
  );
}
