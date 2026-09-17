"use client";

import { useState } from "react";
import Link from "next/link";
import { AttendToggle } from "@/components/AttendToggle";
import { AuthedPage } from "@/components/AuthedPage";
import { AdminPersonRelsModal } from "@/components/AdminPersonRelsModal";
import { PersonCard } from "@/components/PersonCard";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";
import { useIdentity } from "@/components/IdentityProvider";
import { useAdminAuthStatus } from "@/lib/hooks";
import { describeKinship } from "@/lib/kinship";
import { displayName, formatPolishDate, lifespan } from "@/lib/db-client";
import { findRelationConflicts } from "@/lib/relationConflicts";
import { getChildrenIds } from "@/lib/tree";
import type { Person } from "@/types/family";

function PersonInner({
  id,
  people,
  attendingPersonIds,
}: {
  id: string;
  people: Person[];
  attendingPersonIds: string[];
}) {
  const { identity } = useIdentity();
  const admin = useAdminAuthStatus();
  const isAdmin = Boolean(admin.data?.loggedIn);
  const [relsOpen, setRelsOpen] = useState(false);
  const person = people.find((p) => p.id === id);

  if (!person) {
    return <div className="loading-screen">Nie znaleziono osoby.</div>;
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const parents = person.parentIds.map((pid) => byId.get(pid)).filter(Boolean);
  const spouses = person.spouseIds.map((pid) => byId.get(pid)).filter(Boolean);
  const children = people.filter((p) => p.parentIds.includes(person.id));
  const siblings =
    person.parentIds.length === 0
      ? []
      : people.filter(
          (p) =>
            p.id !== person.id &&
            p.parentIds.some((pid) => person.parentIds.includes(pid)),
        );

  const meId = identity?.personId;
  const kinship =
    meId && meId !== person.id
      ? describeKinship(people, meId, person.id)
      : null;
  const conflicts = isAdmin
    ? findRelationConflicts(
        people,
        person.id,
        person.parentIds,
        person.spouseIds,
        getChildrenIds(people, person.id),
      )
    : [];

  return (
    <article className="person-detail">
      <Link href="/drzewo" className="back-link">
        ← Wróć do drzewa
      </Link>

      <header className="person-detail__header">
        <PersonPhotoControl person={person} size="lg" mode={admin.data?.loggedIn ? "admin" : "suggest"} />
        <div>
          <h1 className="person-detail__name">
            {displayName(person, people)}
            {isAdmin ? (
              <PencilButton
                label={`Edytuj powiązania: ${displayName(person)}`}
                onClick={() => setRelsOpen(true)}
              />
            ) : null}
          </h1>
          {attendingPersonIds.includes(person.id) && (
            <p className="attending-banner">Na spotkaniu rodzinnym</p>
          )}
          <AttendToggle
            personId={person.id}
            fullName={displayName(person, people)}
            attending={attendingPersonIds.includes(person.id)}
          />
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
          <div className="person-detail__cta">
            <Link
              href={`/drzewo?root=${person.id}`}
              className="btn btn-primary"
            >
              Pokaż gałąź w drzewie
            </Link>
            {meId && meId !== person.id && (
              <Link
                href={`/pokrewienstwo?a=${encodeURIComponent(meId)}&b=${encodeURIComponent(person.id)}`}
                className="btn btn-secondary"
              >
                Jak jesteśmy spokrewnieni?
              </Link>
            )}
            {isAdmin ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRelsOpen(true)}
              >
                Edytuj powiązania
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {kinship && identity?.name && (
        <section className="person-kinship" aria-label="Pokrewieństwo">
          <h2>Dla Ciebie ({identity.name})</h2>
          <p>
            <strong>{displayName(person)}</strong> to{" "}
            <em>{kinship.labelBtoA}</em>
          </p>
          <p className="person-kinship__summary">{kinship.summary}</p>
          {kinship.path.length > 1 && (
            <ol className="person-kinship__path">
              {kinship.path.map((name, i) => (
                <li key={`${name}-${i}`}>{name}</li>
              ))}
            </ol>
          )}
        </section>
      )}

      {conflicts.length > 0 && (
        <div className="admin-rels__warns" role="status">
          <p>
            Sprzeczne powiązania — stąd ×2 / ×3 na drzewie. Ołówek otwiera
            edycję.
          </p>
          <ul>
            {conflicts.map((c) => (
              <li key={`${c.personId}:${c.message}`}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="person-relations">
        <h2 className="person-relations__title">
          <span>Rodzice</span>
          {isAdmin ? (
            <PencilButton
              label="Edytuj rodziców"
              onClick={() => setRelsOpen(true)}
            />
          ) : null}
        </h2>
        <div className="relation-grid">
          {parents.length === 0 && <p className="empty-hint">Brak danych</p>}
          {parents.map(
            (p) =>
              p && <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />,
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
        <h2 className="person-relations__title">
          <span>Małżonek / partner</span>
          {isAdmin ? (
            <PencilButton
              label="Edytuj małżonka"
              onClick={() => setRelsOpen(true)}
            />
          ) : null}
        </h2>
        <div className="relation-grid">
          {spouses.length === 0 && <p className="empty-hint">Brak danych</p>}
          {spouses.map(
            (p) =>
              p && <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />,
          )}
        </div>
      </section>

      <section className="person-relations">
        <h2 className="person-relations__title">
          <span>Dzieci ({children.length})</span>
          {isAdmin ? (
            <PencilButton
              label="Edytuj dzieci"
              onClick={() => setRelsOpen(true)}
            />
          ) : null}
        </h2>
        <div className="relation-grid">
          {children.length === 0 && <p className="empty-hint">Brak danych</p>}
          {children.map((p) => (
            <PersonCard key={p.id} person={p} href={`/osoba/${p.id}`} />
          ))}
        </div>
      </section>

      {relsOpen && isAdmin && (
        <AdminPersonRelsModal
          person={person}
          people={people}
          onClose={() => setRelsOpen(false)}
        />
      )}

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
  );
}

function PencilButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="person-rel-edit"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    </button>
  );
}

export function PersonPageClient({ id }: { id: string }) {
  return (
    <AuthedPage loadingLabel="Wczytywanie osoby…">
      {({ people, family }) => (
        <PersonInner
          id={id}
          people={people}
          attendingPersonIds={family.attendingPersonIds ?? []}
        />
      )}
    </AuthedPage>
  );
}
