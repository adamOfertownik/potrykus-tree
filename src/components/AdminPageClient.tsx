"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission, SubmissionPreview } from "@/types/submissions";
import type { FamilyPayload, Person } from "@/types/family";
import { useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";
import { KIND_LABELS, STATUS_LABELS, genderLabel } from "@/lib/submissionLabels";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { searchPeople } from "@/lib/search";
import { getChildrenIds } from "@/lib/tree";
import { Modal } from "@/components/Modal";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";
import { AdminRelEditor } from "@/components/AdminRelEditor";

type AdminSubmission = ChangeSubmission & { preview?: SubmissionPreview };
type Tab = "queue" | "people";
type StatusFilter = ChangeSubmission["status"] | "all";

function AdminPanel({ email }: { email: string }) {
  const logout = useAdminLogout();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const focusPersonId = searchParams.get("osoba");
  const [people, setPeople] = useState<Person[]>([]);
  const [tab, setTab] = useState<Tab>(() => (focusPersonId ? "people" : "queue"));
  const [items, setItems] = useState<AdminSubmission[]>([]);
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

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/submissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setItems(data.submissions || []);
      const familyRes = await fetch("/api/admin/family");
      if (familyRes.ok) {
        const family = (await familyRes.json()) as FamilyPayload;
        setPeople(family.people);
        qc.setQueryData(["family"], family);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const counts = useMemo(() => {
    const next = { new: 0, reviewed: 0, accepted: 0, rejected: 0, local_only: 0 };
    for (const item of items) next[item.status] += 1;
    return next;
  }, [items]);

  const visible = items.filter(
    (s) => statusFilter === "all" || s.status === statusFilter,
  );
  const selected = items.find((s) => s.id === selectedId) ?? visible[0] ?? null;

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
      setItems((list) =>
        list.map((s) => (s.id === id ? data.submission : s)),
      );
      if (data.family) {
        qc.setQueryData(["family"], data.family);
        setPeople(data.family.people);
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
      <header className="admin-page__intro">
        <h1>Panel admina</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Sugestie rodziny są tu
          widoczne — reszta użytkowników ich nie widzi.
        </p>
        <div className="admin-page__toolbar">
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
        <div className="admin-tabs" role="tablist" aria-label="Panel admina">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "queue"}
            className={tab === "queue" ? "is-active" : undefined}
            onClick={() => setTab("queue")}
          >
            Zgłoszenia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "people"}
            className={tab === "people" ? "is-active" : undefined}
            onClick={() => setTab("people")}
          >
            Osoby
          </button>
        </div>
      </header>

      {error && (
        <div ref={errorRef} className="banner-error" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}
      {success && (
        <p className="banner-success" role="status">
          {success}
        </p>
      )}

      {tab === "queue" ? (
        <>
          <ul className="admin-metrics">
            {(
              [
                ["new", "Nowe"],
                ["reviewed", "Przejrzane"],
                ["accepted", "Zaakceptowane"],
                ["rejected", "Odrzucone"],
              ] as const
            ).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  className={statusFilter === key ? "is-active" : undefined}
                  onClick={() => setStatusFilter(key)}
                >
                  <strong>{counts[key]}</strong>
                  {label}
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className={statusFilter === "all" ? "is-active" : undefined}
                onClick={() => setStatusFilter("all")}
              >
                <strong>{items.length}</strong>
                Wszystkie
              </button>
            </li>
          </ul>

          <div className="admin-queue">
            <ul className="admin-list">
              {visible.length === 0 && (
                <li className="empty-hint">Brak zgłoszeń w tym filtrze.</li>
              )}
              {visible.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`admin-card${selected?.id === s.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(s.id)}
                  >
                    <div className="admin-card__head">
                      <strong>{s.reporterName}</strong>
                      <span>{KIND_LABELS[s.kind]}</span>
                      <span className={`admin-card__status admin-card__status--${s.status}`}>
                        {STATUS_LABELS[s.status]}
                      </span>
                    </div>
                    <p>{s.preview?.summary || s.message || "(bez opisu)"}</p>
                    {s.targetPersonName && (
                      <p className="empty-hint">Dotyczy: {s.targetPersonName}</p>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {selected && (
              <article className="admin-detail" aria-live="polite">
                <header>
                  <h2>{KIND_LABELS[selected.kind]}</h2>
                  <p>
                    {selected.reporterName}
                    {selected.reporterPhone ? ` · ${selected.reporterPhone}` : ""}
                  </p>
                </header>
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
                ) : null}
                {(selected.preview?.photoBefore || selected.preview?.photoAfter || selected.photoUrl) && (
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
                {(selected.graphEdits?.length || selected.graphEdit) && (
                  <ul className="admin-graph-edits">
                    {(selected.graphEdits?.length
                      ? selected.graphEdits
                      : selected.graphEdit
                        ? [selected.graphEdit]
                        : []
                    ).map((edit, i) => (
                      <li key={`${edit.op}-${edit.anchorPersonId}-${i}`}>
                        {i + 1}. {edit.summary || edit.op}
                        {edit.newPerson?.clientPersonId
                          ? ` (roboczo: ${edit.newPerson.firstName} ${edit.newPerson.lastName})`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}
                {selected.status === "new" || selected.status === "reviewed" ? (
                  <div className="admin-card__actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => setStatus(selected.id, "reviewed")}
                    >
                      Przejrzane
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ id: selected.id, status: "accepted" })
                      }
                    >
                      Akceptuj
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
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
            )}
          </div>
        </>
      ) : (
        <AdminPeoplePanel
          people={people}
          initialPersonId={focusPersonId}
          onFamily={(family) => {
            qc.setQueryData(["family"], family);
            setPeople(family.people);
          }}
          onError={setError}
          onSuccess={setSuccess}
        />
      )}

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
              className="btn btn-primary"
              disabled={busy}
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
  initialPersonId,
  onFamily,
  onError,
  onSuccess,
}: {
  people: Person[];
  initialPersonId?: string | null;
  onFamily: (family: FamilyPayload) => void;
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [chosenId, setChosenId] = useState<string | null>(
    () => initialPersonId ?? null,
  );
  const personId =
    (chosenId && people.some((p) => p.id === chosenId) ? chosenId : null) ??
    (initialPersonId && people.some((p) => p.id === initialPersonId)
      ? initialPersonId
      : null) ??
    people[0]?.id ??
    null;
  const person = people.find((p) => p.id === personId) ?? null;
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    maidenName: "",
    gender: "unknown" as Person["gender"],
    birthDate: "",
    deathDate: "",
    phone: "",
    notes: "",
  });
  const [parentIds, setParentIds] = useState<string[]>([]);
  const [spouseIds, setSpouseIds] = useState<string[]>([]);
  const [childIds, setChildIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const hydratedId = useRef<string | null>(null);

  const selectPerson = (id: string) => {
    setChosenId(id);
    const next = new URLSearchParams(searchParams.toString());
    next.set("osoba", id);
    router.replace(`/admin?${next.toString()}`, { scroll: false });
  };

  useEffect(() => {
    if (!person) return;
    if (hydratedId.current === person.id) return;
    hydratedId.current = person.id;
    setForm({
      firstName: person.firstName,
      lastName: person.lastName,
      maidenName: person.maidenName || "",
      gender: person.gender,
      birthDate: person.birthDate || "",
      deathDate: person.deathDate || "",
      phone: person.phone || "",
      notes: person.notes || "",
    });
    setParentIds([...person.parentIds]);
    setSpouseIds([...person.spouseIds]);
    setChildIds(getChildrenIds(people, person.id));
  }, [person, people]);

  const matches = useMemo(() => {
    const raw = query.trim() ? searchPeople(people, query) : people;
    const sliced = raw.slice(0, 12);
    if (personId && !sliced.some((p) => p.id === personId)) {
      const selected = people.find((p) => p.id === personId);
      if (selected) return [selected, ...sliced.slice(0, 11)];
    }
    return sliced;
  }, [people, query, personId]);

  const save = async () => {
    if (!person) return;
    setBusy(true);
    onError(null);
    try {
      const res = await fetch("/api/admin/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          personId: person.id,
          fields: {
            ...form,
            parentIds,
            spouseIds,
            childIds,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      onFamily(data.family);
      onSuccess("Zapisano dane i powiązania osoby.");
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!person) return;
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
      const nextId = data.family.people[0]?.id as string | undefined;
      if (nextId) selectPerson(nextId);
      else setChosenId(null);
      setDeleteOpen(false);
      onSuccess(`Usunięto osobę. Odpięto powiązania: ${(data.affectedNames || []).join(", ")}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-people">
      <div className="admin-people__search">
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
        <ul className="who-matches">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={p.id === personId ? "is-active" : undefined}
                onClick={() => selectPerson(p.id)}
              >
                {displayName(p)}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {person ? (
        <form
          className="change-form"
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
              {" · "}
              <Link href={`/drzewo?hl=${encodeURIComponent(person.id)}`}>
                Pokaż na drzewie
              </Link>
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
          <AdminRelEditor
            person={person}
            people={people}
            parentIds={parentIds}
            spouseIds={spouseIds}
            childIds={childIds}
            onParentIds={setParentIds}
            onSpouseIds={setSpouseIds}
            onChildIds={setChildIds}
            onOpenPerson={selectPerson}
          />
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
      ) : (
        <p className="empty-hint">Wybierz osobę z listy.</p>
      )}

      {deleteOpen && person && (
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

      {createOpen && (
        <CreatePersonModal
          busy={busy}
          onClose={() => setCreateOpen(false)}
          onCreate={async (payload) => {
            setBusy(true);
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
              if (typeof data.createdPersonId === "string") {
                selectPerson(data.createdPersonId);
              }
              setCreateOpen(false);
              onSuccess("Dodano osobę.");
            } catch (e) {
              onError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </div>
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

  if (auth.isLoading || !auth.data?.loggedIn || !auth.data.email) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return (
    <main className="page-shell page-shell--admin">
      <AdminPanel email={auth.data.email} />
    </main>
  );
}
