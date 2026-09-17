"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission, SubmissionPreview } from "@/types/submissions";
import type { FamilyPayload, Person } from "@/types/family";
import { useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";
import { KIND_LABELS, STATUS_LABELS, genderLabel } from "@/lib/submissionLabels";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { searchPeople } from "@/lib/search";
import { Modal } from "@/components/Modal";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import type { AdminUserRole } from "@/types/admin";

type AdminSubmission = ChangeSubmission & { preview?: SubmissionPreview };
type Tab = "queue" | "people" | "users";
type StatusFilter = ChangeSubmission["status"] | "all";
type PersonFormState = {
  firstName: string;
  lastName: string;
  maidenName: string;
  gender: Person["gender"];
  birthDate: string;
  deathDate: string;
  phone: string;
  notes: string;
};

function personToForm(person: Person): PersonFormState {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    maidenName: person.maidenName || "",
    gender: person.gender,
    birthDate: person.birthDate || "",
    deathDate: person.deathDate || "",
    phone: person.phone || "",
    notes: person.notes || "",
  };
}

function AdminPanel({
  email,
  role,
  adminId,
}: {
  email: string;
  role: AdminUserRole;
  adminId: string;
}) {
  const logout = useAdminLogout();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    status: "accepted" | "rejected";
  } | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  const submissionsQuery = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/submissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      return (data.submissions ?? []) as AdminSubmission[];
    },
  });
  const familyQuery = useQuery({
    queryKey: ["admin-family"],
    queryFn: async (): Promise<FamilyPayload | null> => {
      const res = await fetch("/api/admin/family");
      if (!res.ok) return null;
      const family = (await res.json()) as FamilyPayload;
      qc.setQueryData(["family"], family);
      return family;
    },
  });

  const items = submissionsQuery.data ?? [];
  const people = familyQuery.data?.people ?? [];
  const displayError =
    error ??
    (submissionsQuery.error instanceof Error
      ? submissionsQuery.error.message
      : null);
  const loading = busy || submissionsQuery.isPending;

  useEffect(() => {
    if (displayError) errorRef.current?.focus();
  }, [displayError]);

  const counts = useMemo(() => {
    const next = { new: 0, reviewed: 0, accepted: 0, rejected: 0, local_only: 0 };
    for (const item of submissionsQuery.data ?? []) next[item.status] += 1;
    return next;
  }, [submissionsQuery.data]);

  const visible = items.filter(
    (s) => statusFilter === "all" || s.status === statusFilter,
  );
  const selected = items.find((s) => s.id === selectedId) ?? visible[0] ?? null;
  const activeTab: Tab = role !== "admin" && tab === "users" ? "queue" : tab;

  const setStatus = async (
    id: string,
    status: ChangeSubmission["status"],
  ) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      qc.setQueryData<AdminSubmission[]>(["admin-submissions"], (list) =>
        (list ?? []).map((s) => (s.id === id ? data.submission : s)),
      );
      if (data.family) {
        qc.setQueryData(["family"], data.family);
        qc.setQueryData(["admin-family"], data.family);
      }
      setSuccess(
        status === "accepted"
          ? "Zaakceptowano i zapisano w drzewie."
          : status === "rejected"
            ? "Odrzucono zgłoszenie."
            : "Oznaczono jako przejrzane.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <section className="admin-page">
      <header className="admin-chrome">
        <div className="admin-chrome__top">
          <div>
            <h1>Panel admina</h1>
            <p>
              Zalogowany jako <strong>{email}</strong>
            </p>
          </div>
          <div className="admin-chrome__actions">
            <Link href="/drzewo" className="btn btn-secondary">
              ← Do drzewa
            </Link>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={logout.isPending}
              onClick={() => {
                logout.mutate();
              }}
            >
              Wyloguj
            </button>
          </div>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Panel admina">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "queue"}
            className={activeTab === "queue" ? "is-active" : undefined}
            onClick={() => setTab("queue")}
          >
            Zgłoszenia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "people"}
            className={activeTab === "people" ? "is-active" : undefined}
            onClick={() => setTab("people")}
          >
            Osoby
          </button>
          {role === "admin" && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "users"}
              className={activeTab === "users" ? "is-active" : undefined}
              onClick={() => setTab("users")}
            >
              Użytkownicy
            </button>
          )}
        </div>
      </header>

      {displayError && (
        <div ref={errorRef} className="banner-error" role="alert" tabIndex={-1}>
          {displayError}
        </div>
      )}
      {success && (
        <p className="banner-success" role="status">
          {success}
        </p>
      )}

      {activeTab === "queue" ? (
        <div className="admin-workspace">
          <div className="admin-card-box">
            <div
              className="admin-filters"
              role="group"
              aria-label="Status zgłoszeń"
            >
              {(
                [
                  ["new", "Nowe", counts.new],
                  ["reviewed", "Przejrzane", counts.reviewed],
                  ["accepted", "Zaakceptowane", counts.accepted],
                  ["rejected", "Odrzucone", counts.rejected],
                  ["all", "Wszystkie", items.length],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={statusFilter === key}
                  onClick={() => setStatusFilter(key)}
                >
                  {label} ({count})
                </button>
              ))}
            </div>
            <ul className="admin-list-box">
              {visible.length === 0 && (
                <li className="admin-list-empty">
                  Brak zgłoszeń w tym widoku.
                  {statusFilter !== "all" && (
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => setStatusFilter("all")}
                    >
                      Pokaż wszystkie
                    </button>
                  )}
                </li>
              )}
              {visible.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`admin-row${selected?.id === s.id ? " is-selected" : ""}`}
                    aria-current={selected?.id === s.id ? "true" : undefined}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <span className="admin-row__title">
                      {s.reporterName}
                      <span
                        className={`admin-role-badge admin-status-badge--${s.status}`}
                      >
                        {STATUS_LABELS[s.status]}
                      </span>
                    </span>
                    <span className="admin-row__meta">
                      {KIND_LABELS[s.kind]}
                      {s.targetPersonName ? ` · ${s.targetPersonName}` : ""}
                    </span>
                    <span className="admin-row__summary">
                      {s.preview?.summary || s.message || "(bez opisu)"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {selected ? (
            <article className="admin-detail" aria-live="polite">
              <header className="admin-detail__head">
                <h2>{KIND_LABELS[selected.kind]}</h2>
                <span
                  className={`admin-role-badge admin-status-badge--${selected.status}`}
                >
                  {STATUS_LABELS[selected.status]}
                </span>
              </header>
              <p>
                {selected.reporterName}
                {selected.reporterPhone ? ` · ${selected.reporterPhone}` : ""}
              </p>
              {selected.targetPersonId && (
                <p>
                  Dotyczy:{" "}
                  <Link href={`/osoba/${selected.targetPersonId}`}>
                    {selected.targetPersonName || selected.targetPersonId}
                  </Link>
                </p>
              )}
              {selected.message && <p>{selected.message}</p>}
              {selected.preview?.warnings.map((w) => (
                <p key={w} className="banner-error" role="status">
                  {w}
                </p>
              ))}
              {selected.preview?.diffs.length ? (
                <div className="admin-diff-wrap">
                  <table className="admin-diff">
                    <caption>Podgląd zmian</caption>
                    <thead>
                      <tr>
                        <th>Pole</th>
                        <th>Teraz</th>
                        <th>Propozycja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.preview.diffs.map((d) => (
                        <tr key={d.field}>
                          <th scope="row">{d.label}</th>
                          <td>{d.before}</td>
                          <td>{d.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
              {(selected.preview?.photoBefore ||
                selected.preview?.photoAfter ||
                selected.photoUrl) && (
                <div className="admin-photo-diff">
                  <figure>
                    <figcaption>Teraz</figcaption>
                    {selected.preview?.photoBefore ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={selected.preview.photoBefore} alt="" />
                    ) : (
                      <span>brak</span>
                    )}
                  </figure>
                  <figure>
                    <figcaption>Propozycja</figcaption>
                    {selected.preview?.photoAfter || selected.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.preview?.photoAfter || selected.photoUrl}
                        alt=""
                      />
                    ) : (
                      <span>usunąć</span>
                    )}
                  </figure>
                </div>
              )}
              {selected.graphEdit && (
                <p className="empty-hint">
                  Operacja: {selected.graphEdit.op}
                  {selected.graphEdit.summary
                    ? ` — ${selected.graphEdit.summary}`
                    : ""}
                </p>
              )}
              {selected.status === "new" || selected.status === "reviewed" ? (
                <div className="admin-card__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={loading}
                    onClick={() => setStatus(selected.id, "reviewed")}
                  >
                    Przejrzane
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={loading}
                    onClick={() =>
                      setConfirm({ id: selected.id, status: "accepted" })
                    }
                  >
                    Akceptuj
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger"
                    disabled={loading}
                    onClick={() =>
                      setConfirm({ id: selected.id, status: "rejected" })
                    }
                  >
                    Odrzuć
                  </button>
                </div>
              ) : (
                <p className="empty-hint">
                  Status: {STATUS_LABELS[selected.status]}
                </p>
              )}
            </article>
          ) : (
            <p className="admin-card-box admin-list-empty">
              Wybierz zgłoszenie z listy.
            </p>
          )}
        </div>
      ) : activeTab === "people" ? (
        <AdminPeoplePanel
          people={people}
          onFamily={(family) => {
            qc.setQueryData(["family"], family);
            qc.setQueryData(["admin-family"], family);
          }}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : role === "admin" ? (
        <AdminUsersPanel
          currentUserId={adminId}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : null}

      {confirm && selected && confirm.id === selected.id && (
        <Modal
          open
          labelledBy="admin-confirm-title"
          onClose={() => setConfirm(null)}
        >
          <h2 id="admin-confirm-title">
            {confirm.status === "accepted" ? "Zaakceptować?" : "Odrzucić?"}
          </h2>
          <p>{selected.preview?.summary || selected.message}</p>
          {!selected.preview?.autoApply && confirm.status === "accepted" && (
            <p>
              To zgłoszenie nie zmieni drzewa automatycznie — tylko oznaczy
              status.
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className={
                confirm.status === "accepted" ? "btn btn-primary" : "btn btn-danger"
              }
              disabled={loading}
              onClick={() => setStatus(confirm.id, confirm.status)}
            >
              {confirm.status === "accepted" ? "Akceptuj i zapisz" : "Odrzuć"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirm(null)}
            >
              Anuluj
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function AdminPeoplePanel({
  people,
  onFamily,
  onError,
  onSuccess,
}: {
  people: Person[];
  onFamily: (family: FamilyPayload) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [personId, setPersonId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const resolvedPersonId =
    personId && people.some((p) => p.id === personId)
      ? personId
      : (people[0]?.id ?? null);
  const person = people.find((p) => p.id === resolvedPersonId) ?? null;
  const matches = query.trim() ? searchPeople(people, query) : people;

  return (
    <div className="admin-workspace">
      <div className="admin-card-box">
        <div className="admin-toolbar">
          <label className="field-block">
            Szukaj osoby
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Imię lub nazwisko"
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setCreateOpen(true)}
          >
            Nowa osoba
          </button>
        </div>
        <ul className="admin-list-box">
          {matches.length === 0 && (
            <li className="admin-list-empty">
              {query.trim()
                ? `Brak osób dla „${query.trim()}”.`
                : "Brak osób w drzewie."}
              {query.trim() ? (
                <button
                  type="button"
                  className="btn-text"
                  onClick={() => setQuery("")}
                >
                  Pokaż wszystkie
                </button>
              ) : null}
            </li>
          )}
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`admin-row${p.id === resolvedPersonId ? " is-selected" : ""}`}
                aria-current={p.id === resolvedPersonId ? "true" : undefined}
                onClick={() => setPersonId(p.id)}
              >
                <span className="admin-row__title">{displayName(p)}</span>
                <span className="admin-row__meta">
                  {genderLabel(p.gender)}
                  {` · ur. ${formatPolishDate(p.birthDate) || "—"}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {person ? (
        <PersonEditor
          key={person.id}
          person={person}
          onFamily={onFamily}
          onError={onError}
          onSuccess={onSuccess}
          onDeleted={(nextId) => setPersonId(nextId)}
        />
      ) : (
        <p className="admin-card-box admin-list-empty">Wybierz osobę z listy.</p>
      )}

      {createOpen && (
        <CreatePersonModal
          busy={createBusy}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            setCreateBusy(true);
            onError(null);
            try {
              const res = await fetch("/api/admin/family", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create", newPerson: payload }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error || "Błąd");
              onFamily(data.family);
              setPersonId(data.createdPersonId);
              setCreateOpen(false);
              onSuccess("Dodano osobę.");
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setCreateBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function PersonEditor({
  person,
  onFamily,
  onError,
  onSuccess,
  onDeleted,
}: {
  person: Person;
  onFamily: (family: FamilyPayload) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
  onDeleted: (nextId: string | null) => void;
}) {
  const [form, setForm] = useState(() => personToForm(person));
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = async () => {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          personId: person.id,
          fields: form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      onFamily(data.family);
      onSuccess("Zapisano dane osoby.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", personId: person.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd usuwania");
      onFamily(data.family);
      setDeleteOpen(false);
      onDeleted(data.family.people[0]?.id ?? null);
      onSuccess(
        `Usunięto osobę. Odpięto powiązania: ${(data.affectedNames || []).join(", ")}`,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form
        className="admin-detail change-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="admin-people__identity">
          <PersonPhotoControl
            person={person}
            size="lg"
            mode="admin"
            onFamily={onFamily}
          />
          <p>
            <Link href={`/osoba/${person.id}`}>Otwórz kartę osoby</Link>
          </p>
        </div>
        <div className="form-grid">
          <label>
            Imię
            <input
              required
              value={form.firstName}
              onChange={(e) =>
                setForm((s) => ({ ...s, firstName: e.target.value }))
              }
            />
          </label>
          <label>
            Nazwisko
            <input
              required
              value={form.lastName}
              onChange={(e) =>
                setForm((s) => ({ ...s, lastName: e.target.value }))
              }
            />
          </label>
          <label>
            Nazwisko rodowe
            <input
              value={form.maidenName}
              onChange={(e) =>
                setForm((s) => ({ ...s, maidenName: e.target.value }))
              }
            />
          </label>
          <label>
            Płeć
            <select
              value={form.gender}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  gender: e.target.value as Person["gender"],
                }))
              }
            >
              <option value="unknown">{genderLabel("unknown")}</option>
              <option value="female">{genderLabel("female")}</option>
              <option value="male">{genderLabel("male")}</option>
            </select>
          </label>
          <label>
            Data urodzenia
            <input
              value={form.birthDate}
              onChange={(e) =>
                setForm((s) => ({ ...s, birthDate: e.target.value }))
              }
              placeholder="RRRR-MM-DD"
            />
          </label>
          <label>
            Data zgonu
            <input
              value={form.deathDate}
              onChange={(e) =>
                setForm((s) => ({ ...s, deathDate: e.target.value }))
              }
              placeholder="RRRR-MM-DD"
            />
          </label>
          <label>
            Telefon
            <input
              value={form.phone}
              onChange={(e) =>
                setForm((s) => ({ ...s, phone: e.target.value }))
              }
            />
          </label>
        </div>
        <label className="field-block">
          Notatki
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
          />
        </label>
        <p className="empty-hint">
          Ur. {formatPolishDate(person.birthDate) || "—"} · id: {person.id}
        </p>
        <div className="admin-card__actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Zapisuję…" : "Zapisz"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setDeleteOpen(true)}
          >
            Usuń osobę
          </button>
        </div>
      </form>

      {deleteOpen && (
        <Modal
          open
          labelledBy="admin-delete-title"
          onClose={() => setDeleteOpen(false)}
        >
          <h2 id="admin-delete-title">Usunąć {displayName(person)}?</h2>
          <p>
            Osoba zniknie z drzewa, a powiązania rodzic/partner zostaną
            odpięte. Tego nie da się cofnąć z tego okna.
          </p>
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void remove()}
            >
              Usuń na stałe
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDeleteOpen(false)}
            >
              Anuluj
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CreatePersonModal({
  busy,
  onClose,
  onCreate,
}: {
  busy: boolean;
  onClose: () => void;
  onCreate: (payload: {
    firstName: string;
    lastName: string;
    gender: Person["gender"];
    maidenName?: string;
    birthDate?: string;
  }) => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Person["gender"]>("unknown");
  return (
    <Modal open labelledBy="admin-create-title" onClose={onClose}>
      <form
        className="change-form"
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate({ firstName, lastName, gender });
        }}
      >
        <h2 id="admin-create-title">Nowa osoba</h2>
        <label>
          Imię
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </label>
        <label>
          Nazwisko
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </label>
        <label>
          Płeć
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value as Person["gender"])}
          >
            <option value="unknown">nieznana</option>
            <option value="female">kobieta</option>
            <option value="male">mężczyzna</option>
          </select>
        </label>
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            Dodaj
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Anuluj
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AdminPageClient() {
  const auth = useAdminAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.data?.loggedIn) {
      router.replace("/login?next=/admin");
    }
  }, [auth.isLoading, auth.data?.loggedIn, router]);

  if (
    auth.isLoading ||
    !auth.data?.loggedIn ||
    !auth.data.email ||
    !auth.data.role ||
    !auth.data.adminId
  ) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return (
    <main className="page-shell page-shell--admin">
      <AdminPanel
        email={auth.data.email}
        role={auth.data.role}
        adminId={auth.data.adminId}
      />
    </main>
  );
}
