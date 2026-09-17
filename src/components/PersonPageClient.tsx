"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AttendToggle } from "@/components/AttendToggle";
import { AuthedPage } from "@/components/AuthedPage";
import { AdminPersonRelsModal } from "@/components/AdminPersonRelsModal";
import { Modal } from "@/components/Modal";
import { PersonCard } from "@/components/PersonCard";
import { PersonEditForm } from "@/components/PersonEditModal";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";
import { useIdentity } from "@/components/IdentityProvider";
import { useAdminAuthStatus } from "@/lib/hooks";
import { describeKinship } from "@/lib/kinship";
import { displayName, formatPolishDate, lifespan } from "@/lib/db-client";
import { resolveWeddingDate } from "@/lib/weddingDate";
import { findRelationConflicts } from "@/lib/relationConflicts";
import { comparePeopleByBirth, getChildrenIds } from "@/lib/tree";
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
  const { identity, promptIdentity } = useIdentity();
  const admin = useAdminAuthStatus();
  const adminReady = !admin.isPending;
  const isAdmin = Boolean(admin.data?.loggedIn);
  const router = useRouter();
  const qc = useQueryClient();
  const [relsOpen, setRelsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const person = people.find((p) => p.id === id);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    document.getElementById("person-heading")?.focus({ preventScroll: true });
  }, [id]);

  const scrollToEdit = () => {
    if (!isAdmin && !identity?.name) promptIdentity();
    document.getElementById("person-edit")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!person) {
    return <div className="loading-screen">Nie znaleziono osoby.</div>;
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  const parents = person.parentIds.map((pid) => byId.get(pid)).filter(Boolean);
  const spouses = person.spouseIds.map((pid) => byId.get(pid)).filter(Boolean);
  const children = people
    .filter((p) => p.parentIds.includes(person.id))
    .sort(comparePeopleByBirth);
  const siblingLine =
    person.parentIds.length === 0
      ? [person]
      : people
          .filter((p) =>
            p.parentIds.some((pid) => person.parentIds.includes(pid)),
          )
          .sort(comparePeopleByBirth);
  const siblings = siblingLine.filter((p) => p.id !== person.id);
  const siblingIndex = siblingLine.findIndex((p) => p.id === person.id);
  const prevSibling = siblingIndex > 0 ? siblingLine[siblingIndex - 1] : null;
  const nextSibling =
    siblingIndex >= 0 && siblingIndex < siblingLine.length - 1
      ? siblingLine[siblingIndex + 1]
      : null;

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

  const removePerson = async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/admin/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", personId: person.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Nie udało się usunąć.");
      if (data.family) qc.setQueryData(["family"], data.family);
      setDeleteOpen(false);
      router.replace("/drzewo");
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <article className="person-detail">
      <Link href="/drzewo" className="back-link">
        ← Wróć do drzewa
      </Link>

      {siblingLine.length > 1 && siblingIndex >= 0 ? (
        <nav className="person-hop" aria-label="Rodzeństwo">
          {prevSibling ? (
            <Link
              href={`/osoba/${encodeURIComponent(prevSibling.id)}`}
              className="person-hop__btn"
            >
              ← {displayName(prevSibling)}
            </Link>
          ) : (
            <span className="person-hop__btn is-disabled" aria-hidden />
          )}
          <span className="person-hop__pos">
            Rodzeństwo {siblingIndex + 1} / {siblingLine.length}
          </span>
          {nextSibling ? (
            <Link
              href={`/osoba/${encodeURIComponent(nextSibling.id)}`}
              className="person-hop__btn person-hop__btn--next"
            >
              {displayName(nextSibling)} →
            </Link>
          ) : (
            <span className="person-hop__btn is-disabled" aria-hidden />
          )}
        </nav>
      ) : null}

      <header className="person-detail__header">
        <PersonPhotoControl person={person} size="lg" mode={admin.data?.loggedIn ? "admin" : "suggest"} />
        <div>
          <h1 id="person-heading" tabIndex={-1}>
            {displayName(person, people)}
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
          {resolveWeddingDate(person) && (
            <p className="person-detail__dates">
              Ślub: {formatPolishDate(resolveWeddingDate(person))}
            </p>
          )}
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
            <button
              type="button"
              className="btn btn-secondary"
              onClick={scrollToEdit}
            >
              {meId && meId === person.id ? "Popraw moje dane" : "Popraw dane"}
            </button>
            {isAdmin ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRelsOpen(true)}
                >
                  Edytuj powiązania
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  data-testid="admin-delete-person"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteOpen(true);
                  }}
                >
                  Usuń osobę
                </button>
              </>
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
              p && (
                <PersonCard
                  key={p.id}
                  person={p}
                  href={`/osoba/${encodeURIComponent(p.id)}`}
                />
              ),
          )}
        </div>
      </section>

      <section className="person-relations">
        <h2>Rodzeństwo ({siblings.length})</h2>
        <div className="relation-grid">
          {siblings.length === 0 && <p className="empty-hint">Brak danych</p>}
          {siblings.map((p) => (
            <PersonCard
              key={p.id}
              person={p}
              href={`/osoba/${encodeURIComponent(p.id)}`}
            />
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
              p && (
                <PersonCard
                  key={p.id}
                  person={p}
                  href={`/osoba/${encodeURIComponent(p.id)}`}
                />
              ),
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
            <PersonCard
              key={p.id}
              person={p}
              href={`/osoba/${encodeURIComponent(p.id)}`}
            />
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

      {deleteOpen && isAdmin && (
        <Modal
          open
          labelledBy="person-delete-title"
          onClose={() => !deleteBusy && setDeleteOpen(false)}
        >
          <h2 id="person-delete-title">Usunąć {displayName(person)}?</h2>
          <p>
            Osoba zniknie z drzewa i z listy. Powiązania rodzic / partner /
            dziecko zostaną odpięte. Tego nie da się cofnąć z tego okna.
          </p>
          {deleteError && (
            <p className="gate-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-danger"
              disabled={deleteBusy}
              onClick={() => void removePerson()}
            >
              {deleteBusy ? "Usuwam…" : "Usuń na stałe"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={deleteBusy}
              onClick={() => setDeleteOpen(false)}
            >
              Anuluj
            </button>
          </div>
        </Modal>
      )}

      <section className="person-relations person-detail__edit" aria-labelledby="person-edit-heading">
        <h2 id="person-edit-heading" className="person-relations__title">
          Imię, nazwisko i dane
        </h2>
        <PersonEditForm
          key={person.id}
          person={person}
          isAdmin={isAdmin}
          adminReady={adminReady}
          reporterName={identity?.name || ""}
          reporterPersonId={identity?.personId}
          onNeedIdentity={promptIdentity}
        />
      </section>
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
          key={id}
          id={id}
          people={people}
          attendingPersonIds={family.attendingPersonIds ?? []}
        />
      )}
    </AuthedPage>
  );
}
