"use client";

import Link from "next/link";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { PersonCard } from "@/components/PersonCard";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { displayName, formatPolishDate, lifespan } from "@/lib/db-client";

export function PersonPageClient({ id }: { id: string }) {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || !family.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie osoby…</div>
      </AppShell>
    );
  }

  const people = family.data.people;
  const person = people.find((p) => p.id === id);
  if (!person) {
    return (
      <AppShell peopleCount={people.length}>
        <div className="loading-screen">Nie znaleziono osoby.</div>
      </AppShell>
    );
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const parents = person.parentIds
    .map((pid) => byId.get(pid))
    .filter(Boolean);
  const spouses = person.spouseIds
    .map((pid) => byId.get(pid))
    .filter(Boolean);
  const children = people.filter((p) => p.parentIds.includes(person.id));
  const siblings =
    person.parentIds.length === 0
      ? []
      : people.filter(
          (p) =>
            p.id !== person.id &&
            p.parentIds.some((pid) => person.parentIds.includes(pid)),
        );

  return (
    <AppShell peopleCount={people.length}>
      <article className="person-detail">
        <Link href="/drzewo" className="back-link">
          ← Wróć do drzewa
        </Link>

        <header className="person-detail__header">
          <div className="person-detail__avatar">
            {person.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.photoUrl} alt="" />
            ) : (
              <span className="person-card__silhouette large" />
            )}
          </div>
          <div>
            <h1>{displayName(person)}</h1>
            {person.maidenName && (
              <p className="person-detail__maiden">
                Nazwisko rodowe: {person.maidenName}
              </p>
            )}
            <p className="person-detail__dates">{lifespan(person)}</p>
            {person.phone && (
              <p className="person-detail__phone">
                Telefon: <a href={`tel:${person.phone}`}>{person.phone}</a>
              </p>
            )}
            {person.notes && (
              <p className="person-detail__notes">{person.notes}</p>
            )}
            <Link href={`/drzewo?root=${person.id}`} className="btn btn-primary">
              Pokaż gałąź w drzewie
            </Link>
          </div>
        </header>

        <section className="person-relations">
          <h2>Rodzice</h2>
          <div className="relation-grid">
            {parents.length === 0 && <p className="empty-hint">Brak danych</p>}
            {parents.map(
              (p) =>
                p && (
                  <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />
                ),
            )}
          </div>
        </section>

        <section className="person-relations">
          <h2>Rodzeństwo ({siblings.length})</h2>
          <div className="relation-grid">
            {siblings.length === 0 && <p className="empty-hint">Brak danych</p>}
            {siblings.map((p) => (
              <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />
            ))}
          </div>
        </section>

        <section className="person-relations">
          <h2>Małżonek / partner</h2>
          <div className="relation-grid">
            {spouses.length === 0 && <p className="empty-hint">Brak danych</p>}
            {spouses.map(
              (p) =>
                p && (
                  <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />
                ),
            )}
          </div>
        </section>

        <section className="person-relations">
          <h2>Dzieci ({children.length})</h2>
          <div className="relation-grid">
            {children.length === 0 && <p className="empty-hint">Brak danych</p>}
            {children.map((p) => (
              <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />
            ))}
          </div>
        </section>

        <dl className="person-facts">
          <div>
            <dt>Data urodzenia</dt>
            <dd>{formatPolishDate(person.birthDate) || "—"}</dd>
          </div>
          <div>
            <dt>Data zgonu</dt>
            <dd>{formatPolishDate(person.deathDate) || "—"}</dd>
          </div>
          <div>
            <dt>Płeć</dt>
            <dd>
              {person.gender === "male"
                ? "mężczyzna"
                : person.gender === "female"
                  ? "kobieta"
                  : "—"}
            </dd>
          </div>
        </dl>
      </article>
    </AppShell>
  );
}
