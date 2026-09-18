"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission, SubmissionPreview } from "@/types/submissions";
import type { FamilyPayload, Person } from "@/types/family";
import { useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";
import {
  GRAPH_OP_LABELS,
  KIND_LABELS,
  PERSON_FIELD_LABELS,
  STATUS_LABELS,
  genderLabel,
} from "@/lib/submissionLabels";
import { displayName, formatPolishDate, formatPolishDateTime } from "@/lib/db-client";
import { searchPeople } from "@/lib/search";
import { describeSubmissionKinship } from "@/lib/submissionKinship";
import { meetingLineHint } from "@/lib/meetingBranches";
import { getChildrenIds } from "@/lib/tree";
import { DateField } from "@/components/DateField";
import { Modal } from "@/components/Modal";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";
import { AdminRelEditor } from "@/components/AdminRelEditor";
import { AdminEventPayPanel } from "@/components/AdminEventPayPanel";
import { AdminUsersPanel } from "@/components/AdminUsersPanel";
import type { AdminUserRole } from "@/types/admin";

type AdminSubmission = ChangeSubmission & {
  preview?: SubmissionPreview;
  reviewedByEmail?: string;
};
type Tab = "queue" | "people" | "pay" | "users";
type StatusFilter = ChangeSubmission["status"] | "all";

function graphEditsOf(s: ChangeSubmission) {
  if (s.graphEdits?.length) return s.graphEdits;
  return s.graphEdit ? [s.graphEdit] : [];
}

function personLabel(people: Person[], id?: string, fallback?: string) {
  if (!id) return fallback || "—";
  const person = people.find((p) => p.id === id);
  return person ? displayName(person, people) : fallback || id;
}

function AdminKnownFacts({
  submission,
  people,
}: {
  submission: AdminSubmission;
  people: Person[];
}) {
  const reporter = submission.reporterPersonId
    ? people.find((p) => p.id === submission.reporterPersonId)
    : null;
  const edits = graphEditsOf(submission);
  const snapshots = submission.before ?? [];
  return (
    <section className="admin-known" data-testid="admin-submission-known">
      <h3>Znane szczegóły</h3>
      <dl>
        <dt>Zgłoszono</dt>
        <dd>{formatPolishDateTime(submission.createdAt) || "—"}</dd>
        <dt>Rozpatrzono</dt>
        <dd>
          {formatPolishDateTime(submission.reviewedAt) || "jeszcze nie"}
          {submission.reviewedByEmail ? ` · ${submission.reviewedByEmail}` : ""}
        </dd>
        <dt>Zgłaszający</dt>
        <dd>
          {reporter ? (
            <Link href={`/osoba/${encodeURIComponent(reporter.id)}`}>
              {displayName(reporter, people)}
            </Link>
          ) : (
            submission.reporterName
          )}
          {submission.reporterPhone ? ` · ${submission.reporterPhone}` : ""}
          {submission.reporterEmail
            ? ` · ${submission.reporterEmail} (tylko potwierdzenie)`
            : ""}
        </dd>
        {submission.targetPersonId ? (
          <>
            <dt>Dotyczy</dt>
            <dd>
              <Link href={`/osoba/${encodeURIComponent(submission.targetPersonId)}`}>
                {submission.targetPersonName ||
                  personLabel(people, submission.targetPersonId)}
              </Link>
            </dd>
          </>
        ) : null}
      </dl>
      {submission.self && (
        <p>
          Osoba z formularza: {submission.self.firstName} {submission.self.lastName}
          {submission.self.maidenName ? ` (z d. ${submission.self.maidenName})` : ""}
          {submission.self.birthDate
            ? ` · ur. ${formatPolishDate(submission.self.birthDate)}`
            : ""}
          {submission.self.gender ? ` · ${genderLabel(submission.self.gender)}` : ""}
        </p>
      )}
      {submission.relatives && submission.relatives.length > 0 && (
        <ul className="admin-known__list">
          {submission.relatives.map((relative, index) => (
            <li key={`${relative.firstName}-${relative.lastName}-${index}`}>
              {relative.relation}: {relative.firstName} {relative.lastName}
              {relative.birthDate
                ? ` · ur. ${formatPolishDate(relative.birthDate)}`
                : ""}
              {relative.notes ? ` · ${relative.notes}` : ""}
            </li>
          ))}
        </ul>
      )}
      {edits.length > 0 && (
        <ul className="admin-known__list" data-testid="admin-known-edits">
          {edits.map((edit, index) => (
            <li key={`${edit.op}-${edit.anchorPersonId}-${index}`}>
              <strong>{GRAPH_OP_LABELS[edit.op] || edit.op}</strong>
              {edit.summary ? ` — ${edit.summary}` : ""}
              <span>
                {" "}
                Kotwica: {personLabel(people, edit.anchorPersonId)}
                {edit.relatedPersonId
                  ? ` · druga osoba: ${personLabel(people, edit.relatedPersonId)}`
                  : ""}
                {edit.secondParentId
                  ? ` · drugi rodzic: ${personLabel(people, edit.secondParentId)}`
                  : ""}
              </span>
              {edit.newPerson && (
                <span>
                  {" "}
                  Nowa osoba: {edit.newPerson.firstName} {edit.newPerson.lastName}
                  {edit.newPerson.birthDate
                    ? ` · ur. ${formatPolishDate(edit.newPerson.birthDate)}`
                    : ""}
                  {edit.newPerson.clientPersonId
                    ? ` (roboczo: ${edit.newPerson.clientPersonId})`
                    : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {snapshots.length > 0 && (
        <details className="admin-known__snap">
          <summary>Stan przed zmianą ({snapshots.length})</summary>
          <ul className="admin-known__list">
            {snapshots.map((snap) => (
              <li key={snap.id}>
                {displayName(snap, people)}
                {snap.birthDate ? ` · ur. ${formatPolishDate(snap.birthDate)}` : ""}
                {snap.parentIds.length
                  ? ` · rodzice: ${snap.parentIds
                      .map((id) => personLabel(people, id))
                      .join(", ")}`
                  : ""}
                {snap.spouseIds.length
                  ? ` · partnerzy: ${snap.spouseIds
                      .map((id) => personLabel(people, id))
                      .join(", ")}`
                  : ""}
              </li>
            ))}
          </ul>
        </details>
      )}
      {submission.correction && (
        <p>
          Poprawka:{" "}
          {Object.keys(submission.correction)
            .map((field) => PERSON_FIELD_LABELS[field] || field)
            .join(", ")}
        </p>
      )}
    </section>
  );
}

function SubmissionKinship({
  people,
  submission,
  detail = false,
}: {
  people: Person[];
  submission: ChangeSubmission;
  detail?: boolean;
}) {
  const kin = describeSubmissionKinship(people, submission);
  if (!kin) return null;
  const soft = kin.kind === "none" || kin.kind.startsWith("missing");
  return (
    <p
      className={`admin-kinship${detail ? " admin-kinship--detail" : ""}${soft ? " admin-kinship--soft" : ""}`}
      data-testid={detail ? "admin-submission-kinship-detail" : "admin-submission-kinship"}
    >
      {kin.sentence}
      {detail && kin.reverse ? ` ${kin.reverse}` : ""}
    </p>
  );
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
  const searchParams = useSearchParams();
  const focusPersonId = searchParams.get("osoba");
  const startTab = searchParams.get("tab");
  const [people, setPeople] = useState<Person[]>([]);
  const [tab, setTab] = useState<Tab>(() =>
    focusPersonId
      ? "people"
      : startTab === "platnosci"
        ? "pay"
        : startTab === "uzytkownicy" && role === "admin"
          ? "users"
          : "queue",
  );
  const activeTab: Tab = role !== "admin" && tab === "users" ? "queue" : tab;
  const [items, setItems] = useState<AdminSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    id: string;
    status: "accepted" | "rejected";
    partial?: boolean;
  } | null>(null);
  const [pickedEdits, setPickedEdits] = useState<number[]>([]);
  const [pickedFields, setPickedFields] = useState<string[]>([]);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
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
    }, 0);
    return () => window.clearTimeout(timer);
  }, [qc]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const counts = useMemo(() => {
    const next = {
      new: 0,
      reviewed: 0,
      accepted: 0,
      rejected: 0,
      local_only: 0,
      sketch: 0,
    };
    for (const item of items) next[item.status] += 1;
    return next;
  }, [items]);

  const visible = items.filter(
    (s) => statusFilter === "all" || s.status === statusFilter,
  );
  const selected = items.find((s) => s.id === selectedId) ?? visible[0] ?? null;
  const selectedEdits = selected ? graphEditsOf(selected) : [];
  const selectedFieldDiffs =
    selected && !selectedEdits.length ? (selected.preview?.diffs ?? []) : [];

  const setStatus = async (
    id: string,
    status: ChangeSubmission["status"],
    partial?: { graphEditIndexes?: number[]; correctionFields?: string[] },
  ) => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, ...partial }),
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
      if (data.partial) {
        setPickedEdits([]);
        setPickedFields([]);
      }
      setSuccess(
        data.partial
          ? status === "accepted"
            ? "Zapisano zaznaczone. Reszta zostaje w kolejce."
            : "Odrzucono zaznaczone. Reszta zostaje w kolejce."
          : status === "accepted"
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
              Zalogowany jako <strong>{email}</strong>. Sugestie rodziny są
              widoczne tylko tutaj.
            </p>
          </div>
          <div className="admin-chrome__actions">
            <Link href="/drzewo" className="btn btn-secondary">
              ← Do drzewa
            </Link>
            <Link href="/spotkanie" className="btn btn-secondary">
              Spotkanie
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
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pay"}
            className={activeTab === "pay" ? "is-active" : undefined}
            onClick={() => setTab("pay")}
          >
            Płatności
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

      {activeTab === "pay" ? (
        <AdminEventPayPanel
          people={people}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : activeTab === "users" ? (
        <AdminUsersPanel
          currentUserId={adminId}
          onError={setError}
          onSuccess={setSuccess}
        />
      ) : activeTab === "queue" ? (
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
                  ["sketch", "Szkice", counts.sketch],
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
                    onClick={() => {
                      setSelectedId(s.id);
                      setPickedEdits([]);
                      setPickedFields([]);
                    }}
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
                    <SubmissionKinship people={people} submission={s} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

            {selected && (
              <article className="admin-detail" aria-live="polite">
                <header className="admin-detail__head">
                  <h2>{KIND_LABELS[selected.kind]}</h2>
                  <span
                    className={`admin-role-badge admin-status-badge--${selected.status}`}
                  >
                    {STATUS_LABELS[selected.status]}
                  </span>
                </header>
                {selected.status === "sketch" ? (
                  <p className="banner-error" role="status">
                    To szkic — ktoś edytował drzewo i jeszcze nie kliknął
                    „Wyślij do admina”. Nie wgrywaj tego jako gotowego zgłoszenia.
                  </p>
                ) : null}
                <p>
                  {selected.reporterName}
                  {selected.reporterPhone ? ` · ${selected.reporterPhone}` : ""}
                  {selected.reporterEmail
                    ? ` · ${selected.reporterEmail} (tylko potwierdzenie)`
                    : ""}
                </p>
                {selected.targetPersonId && (
                  <p>
                    Dotyczy:{" "}
                    <Link href={`/osoba/${selected.targetPersonId}`}>
                      {selected.targetPersonName || selected.targetPersonId}
                    </Link>
                  </p>
                )}
                <SubmissionKinship people={people} submission={selected} detail />
                <AdminKnownFacts submission={selected} people={people} />
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
                        {selectedFieldDiffs.length > 1 ? <th>Wybierz</th> : null}
                        <th>Pole</th>
                        <th>Teraz</th>
                        <th>Propozycja</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.preview.diffs.map((d) => (
                        <tr key={d.field}>
                          {selectedFieldDiffs.length > 1 ? (
                            <td>
                              <input
                                type="checkbox"
                                checked={pickedFields.includes(d.field)}
                                onChange={() =>
                                  setPickedFields((cur) =>
                                    cur.includes(d.field)
                                      ? cur.filter((f) => f !== d.field)
                                      : [...cur, d.field],
                                  )
                                }
                                aria-label={`Zaznacz: ${d.label}`}
                              />
                            </td>
                          ) : null}
                          <th scope="row">{d.label}</th>
                          <td>{d.before}</td>
                          <td>{d.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
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
                {selectedEdits.length > 0 &&
                  (selected.status === "new" || selected.status === "reviewed") && (
                  <ul className="admin-graph-edits">
                    {selectedEdits.map((edit, i) => (
                      <li key={`${edit.op}-${edit.anchorPersonId}-${i}`}>
                        <label className="check-row">
                          <input
                            type="checkbox"
                            checked={pickedEdits.includes(i)}
                            onChange={() =>
                              setPickedEdits((cur) =>
                                cur.includes(i)
                                  ? cur.filter((n) => n !== i)
                                  : [...cur, i],
                              )
                            }
                          />
                          {i + 1}. {edit.summary || GRAPH_OP_LABELS[edit.op] || edit.op}
                          {edit.newPerson?.clientPersonId
                            ? ` (roboczo: ${edit.newPerson.firstName} ${edit.newPerson.lastName})`
                            : ""}
                        </label>
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
                    {(pickedEdits.length > 0 || pickedFields.length > 0) && (
                      <>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              id: selected.id,
                              status: "accepted",
                              partial: true,
                            })
                          }
                        >
                          Akceptuj zaznaczone
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() =>
                            setConfirm({
                              id: selected.id,
                              status: "rejected",
                              partial: true,
                            })
                          }
                        >
                          Odrzuć zaznaczone
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ id: selected.id, status: "accepted" })
                      }
                    >
                      Akceptuj wszystko
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({ id: selected.id, status: "rejected" })
                      }
                    >
                      Odrzuć wszystko
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
            {confirm.partial
              ? confirm.status === "accepted"
                ? "Zaakceptować zaznaczone?"
                : "Odrzucić zaznaczone?"
              : confirm.status === "accepted"
                ? "Zaakceptować wszystko?"
                : "Odrzucić wszystko?"}
          </h2>
          <p>
            {confirm.partial
              ? confirm.status === "accepted"
                ? "Tylko zaznaczone zmiany trafią na drzewo. Reszta zostanie w kolejce."
                : "Zaznaczone zmiany znikną. Reszta zostanie w kolejce."
              : selected.preview?.summary || selected.message}
          </p>
          {!selected.preview?.autoApply && confirm.status === "accepted" && !confirm.partial && (
            <p>
              To zgłoszenie nie zmieni drzewa automatycznie — tylko oznaczy
              status.
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className={
                confirm.status === "accepted"
                  ? "btn btn-primary"
                  : "btn btn-danger"
              }
              disabled={busy}
              onClick={() =>
                setStatus(
                  confirm.id,
                  confirm.status,
                  confirm.partial
                    ? {
                        graphEditIndexes: pickedEdits.length
                          ? pickedEdits
                          : undefined,
                        correctionFields: pickedFields.length
                          ? pickedFields
                          : undefined,
                      }
                    : undefined,
                )
              }
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
      : null);
  const person = personId
    ? people.find((p) => p.id === personId) ?? null
    : null;
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    maidenName: "",
    gender: "unknown" as Person["gender"],
    birthDate: "",
    deathDate: "",
    weddingDate: "",
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

  const clearPerson = () => {
    setChosenId(null);
    hydratedId.current = null;
    const next = new URLSearchParams(searchParams.toString());
    next.delete("osoba");
    const qs = next.toString();
    router.replace(qs ? `/admin?${qs}` : "/admin", { scroll: false });
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
      weddingDate: person.weddingDate || "",
      phone: person.phone || "",
      notes: person.notes || "",
    });
    setParentIds([...person.parentIds]);
    setSpouseIds([...person.spouseIds]);
    setChildIds(getChildrenIds(people, person.id));
  }, [person, people]);

  const matches = useMemo(() => {
    const raw = query.trim() ? searchPeople(people, query) : people;
    return raw.slice(0, 12);
  }, [people, query]);

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
      clearPerson();
      setDeleteOpen(false);
      onSuccess(`Usunięto osobę. Odpięto powiązania: ${(data.affectedNames || []).join(", ")}`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

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
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className={`admin-row${p.id === personId ? " is-selected" : ""}`}
                aria-current={p.id === personId ? "true" : undefined}
                onClick={() => selectPerson(p.id)}
              >
                <span className="admin-row__title">{displayName(p)}</span>
                <span className="admin-row__meta">
                  {meetingLineHint(p.id, people)} · {genderLabel(p.gender)} · ur.{" "}
                  {formatPolishDate(p.birthDate) || "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {person ? (
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
              <DateField
                value={form.birthDate}
                onChange={(value) =>
                  setForm((s) => ({ ...s, birthDate: value }))
                }
              />
            </label>
            <label>
              Data zgonu
              <DateField
                value={form.deathDate}
                onChange={(value) =>
                  setForm((s) => ({ ...s, deathDate: value }))
                }
              />
            </label>
            <label>
              Data ślubu
              <DateField
                value={form.weddingDate}
                onChange={(value) =>
                  setForm((s) => ({ ...s, weddingDate: value }))
                }
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
        <p className="admin-card-box admin-list-empty">
          Wybierz osobę z listy.
        </p>
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
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!auth.isLoading && !auth.data?.loggedIn) {
      const tab = searchParams.get("tab");
      const next = tab ? `/admin?tab=${encodeURIComponent(tab)}` : "/admin";
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [auth.isLoading, auth.data?.loggedIn, router, searchParams]);

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
