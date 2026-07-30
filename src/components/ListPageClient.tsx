"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { buildDescendantList } from "@/lib/tree";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { exportListPdf } from "@/lib/pdf";

export function ListPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const [query, setQuery] = useState("");

  const people = family.data?.people ?? [];
  const rootId = family.data?.meta.rootPersonId ?? "";

  const entries = useMemo(() => {
    if (!people.length || !rootId) return [];
    return buildDescendantList(people, rootId);
  }, [people, rootId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) =>
      displayName(e.person).toLowerCase().includes(q),
    );
  }, [entries, query]);

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
        <div className="search-wrap">
          <input
            type="search"
            placeholder="Filtruj listę…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              exportListPdf(
                people,
                rootId,
                family.data?.meta.title || "Drzewo Potrykus",
              )
            }
          >
            Pobierz PDF listy
          </button>
        </div>
      </section>

      <ol className="genealogy-list">
        {filtered.map((entry) => {
          const birth = formatPolishDate(entry.person.birthDate);
          const death = formatPolishDate(entry.person.deathDate);
          return (
            <li
              key={`${entry.person.id}-${entry.isSpouse ? "s" : "p"}-${entry.depth}`}
              className={`genealogy-item${entry.isSpouse ? " is-spouse" : ""}`}
              style={{ paddingLeft: `${entry.depth * 1.25}rem` }}
            >
              <span className="genealogy-rail" aria-hidden />
              {!entry.isSpouse && (
                <span className="genealogy-gen">{entry.generation}.</span>
              )}
              {entry.isSpouse && <span className="genealogy-spouse">małż.</span>}
              <Link href={`/osoba/${entry.person.id}`} className="genealogy-name">
                {displayName(entry.person)}
              </Link>
              {birth && <span className="genealogy-date"> u. {birth}</span>}
              {death && <span className="genealogy-date"> z. {death}</span>}
            </li>
          );
        })}
      </ol>
    </AppShell>
  );
}
