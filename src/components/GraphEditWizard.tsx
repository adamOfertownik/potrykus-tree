"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateField } from "@/components/DateField";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/db-client";
import {
  summarizeMutationPreview,
  type GraphOp,
  type NewPersonInput,
} from "@/lib/familyMutations";
import {
  nextDraftPersonId,
  useOptionalDraftGraph,
} from "@/components/DraftGraphProvider";
import { loadReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import { useAdminAuthStatus } from "@/lib/hooks";
import type { FamilyPayload, Gender, Person } from "@/types/family";

export type GraphEditOp = GraphOp;

type Props = {
  open: boolean;
  op: GraphEditOp;
  anchor: Person;
  people: Person[];
  onClose: () => void;
  onApplied?: (payload: {
    family?: FamilyPayload;
    summary: string;
    createdPersonId?: string;
  }) => void;
};

const OP_TITLE: Record<GraphEditOp, string> = {
  add_child: "Dodaj dziecko",
  link_spouse: "Połącz z osobą",
  reparent: "Przenieś w drzewie",
};

const OP_HINT: Record<GraphEditOp, string> = {
  add_child: "Wybierz istniejące dziecko albo dodaj nową osobę pod wybranym rodzicem.",
  link_spouse: "Wybierz małżonka/partnera z drzewa albo dodaj nową osobę.",
  reparent: "Wskaż, pod kim ma znaleźć się ta osoba (nowy rodzic).",
};

type Mode = "existing" | "new";

export function GraphEditWizard({
  open,
  op,
  anchor,
  people,
  onClose,
  onApplied,
}: Props) {
  const qc = useQueryClient();
  const admin = useAdminAuthStatus();
  const draft = useOptionalDraftGraph();
  const canEditTree =
    Boolean(admin.data?.loggedIn) && admin.data?.adminRole !== "pay";
  const useDrafts = Boolean(draft) && !canEditTree;
  const [step, setStep] = useState<"pick" | "confirm">("pick");
  const [mode, setMode] = useState<Mode>("existing");
  const [query, setQuery] = useState("");
  const [related, setRelated] = useState<Person | null>(null);
  const [secondParentId, setSecondParentId] = useState<string>("");
  const [newPerson, setNewPerson] = useState<NewPersonInput>({
    firstName: "",
    lastName: "",
    gender: "unknown",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  onCloseRef.current = onClose;

  const matches = useMemo(() => {
    if (query.trim().length < 1) return [];
    return searchPeople(people, query)
      .filter((p) => p.id !== anchor.id)
      .slice(0, 10);
  }, [people, query, anchor.id]);

  const spouses = useMemo(
    () =>
      people.filter(
        (p) =>
          anchor.spouseIds.includes(p.id) || p.spouseIds.includes(anchor.id),
      ),
    [people, anchor],
  );

  const previewInput = useMemo(
    () => ({
      op,
      anchorPersonId: anchor.id,
      relatedPersonId: mode === "existing" ? related?.id : undefined,
      newPerson: mode === "new" ? newPerson : undefined,
      secondParentId: secondParentId || undefined,
      replaceParentIds: true,
    }),
    [op, anchor.id, mode, related, newPerson, secondParentId],
  );

  const preview = useMemo(
    () => summarizeMutationPreview(people, previewInput),
    [people, previewInput],
  );

  const reset = useCallback(() => {
    setStep("pick");
    setMode("existing");
    setQuery("");
    setRelated(null);
    setSecondParentId("");
    setNewPerson({ firstName: "", lastName: "", gender: "unknown" });
    setBusy(false);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onCloseRef.current();
  }, [reset]);

  useEffect(() => {
    if (!open || step !== "pick") return;
    const target =
      mode === "existing" ? searchInputRef.current : firstNameRef.current;
    target?.focus();
  }, [open, mode, step]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const canContinue =
    mode === "existing"
      ? Boolean(related)
      : Boolean(newPerson.firstName.trim() && newPerson.lastName.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const stagedInput = {
        ...previewInput,
        newPerson:
          mode === "new"
            ? {
                ...newPerson,
                clientPersonId: newPerson.clientPersonId || nextDraftPersonId(),
              }
            : undefined,
      };

      if (useDrafts && draft) {
        const result = draft.stage(stagedInput, people);
        onApplied?.({
          summary: `${result.summary} Widać na szaro — dodaj kolejne osoby albo wyślij całość.`,
          createdPersonId: result.createdPersonId,
        });
        handleClose();
        return;
      }

      const reporter = loadReporter();
      const res = await fetch("/api/family/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...stagedInput,
          reporterName: reporter?.name || "Edycja grafu",
          reporterPersonId: reporter?.personId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");

      if (data.applied && data.family) {
        qc.setQueryData(["family"], data.family);
      }

      onApplied?.({
        family: data.family,
        summary: data.applied
          ? data.summary
          : `${data.summary} Wysłano jako sugestię — zmiana pojawi się po akceptacji admina.`,
        createdPersonId: data.applied ? data.createdPersonId : undefined,
      });
      handleClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const titleId = "graph-edit-title";

  return (
    <Modal
      open={open}
      labelledBy={titleId}
      onClose={handleClose}
      cardClassName="graph-edit-modal"
    >
      <div className="graph-edit change-form">
        <header className="graph-edit__head">
          <p className="graph-edit__eyebrow">Zarządzanie grafem</p>
          <h2 id={titleId}>{OP_TITLE[op]}</h2>
          <p className="graph-edit__anchor">
            Osoba z grafu: <strong>{displayName(anchor)}</strong>
          </p>
          {step === "pick" && (
            <p className="graph-edit__hint">{OP_HINT[op]}</p>
          )}
        </header>

        {step === "pick" && (
          <div className="graph-edit__body">
            <div className="graph-edit__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "existing"}
                className={mode === "existing" ? "is-active" : undefined}
                onClick={() => {
                  setMode("existing");
                  setError(null);
                }}
              >
                Z drzewa
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "new"}
                className={mode === "new" ? "is-active" : undefined}
                onClick={() => {
                  setMode("new");
                  setRelated(null);
                  setError(null);
                }}
              >
                Nowa osoba
              </button>
            </div>

            {mode === "existing" ? (
              <div className="graph-edit__pick">
                <label className="field-block">
                  Szukaj osoby
                  <input
                    ref={searchInputRef}
                    className="field-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Imię lub nazwisko…"
                    autoComplete="off"
                  />
                </label>
                <div className="graph-edit__results">
                  {related && (
                    <p className="graph-edit__chosen" role="status">
                      Wybrano: <strong>{displayName(related)}</strong>
                      <button
                        type="button"
                        className="btn btn-secondary btn-mini"
                        onClick={() => setRelated(null)}
                      >
                        Zmień
                      </button>
                    </p>
                  )}
                  {!related && matches.length > 0 && (
                    <ul className="who-matches">
                      {matches.map((p) => (
                        <li key={p.id}>
                          <button type="button" onClick={() => setRelated(p)}>
                            {displayName(p)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!related && query.trim() && matches.length === 0 && (
                    <p className="empty-hint">
                      Brak wyników — spróbuj „Nowa osoba”.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="form-grid graph-edit__new">
                <label className="field-block">
                  Imię *
                  <input
                    ref={firstNameRef}
                    className="field-input"
                    required
                    autoComplete="given-name"
                    value={newPerson.firstName}
                    onChange={(e) =>
                      setNewPerson((s) => ({ ...s, firstName: e.target.value }))
                    }
                  />
                </label>
                <label className="field-block">
                  Nazwisko *
                  <input
                    className="field-input"
                    required
                    autoComplete="family-name"
                    value={newPerson.lastName}
                    onChange={(e) =>
                      setNewPerson((s) => ({ ...s, lastName: e.target.value }))
                    }
                  />
                </label>
                <label className="field-block">
                  Płeć
                  <select
                    className="field-input"
                    value={newPerson.gender}
                    onChange={(e) =>
                      setNewPerson((s) => ({
                        ...s,
                        gender: e.target.value as Gender,
                      }))
                    }
                  >
                    <option value="unknown">nieznana</option>
                    <option value="female">kobieta</option>
                    <option value="male">mężczyzna</option>
                  </select>
                </label>
                <label className="field-block">
                  Data ur. (opcjonalnie)
                  <DateField
                    className="field-input"
                    value={newPerson.birthDate || ""}
                    onChange={(value) =>
                      setNewPerson((s) => ({
                        ...s,
                        birthDate: value || undefined,
                      }))
                    }
                  />
                </label>
                <label className="field-block">
                  Data zgonu (opcjonalnie)
                  <DateField
                    className="field-input"
                    value={newPerson.deathDate || ""}
                    onChange={(value) =>
                      setNewPerson((s) => ({
                        ...s,
                        deathDate: value || undefined,
                      }))
                    }
                  />
                </label>
                <label className="field-block">
                  Nazwisko rodowe
                  <input
                    className="field-input"
                    value={newPerson.maidenName || ""}
                    onChange={(e) =>
                      setNewPerson((s) => ({
                        ...s,
                        maidenName: e.target.value || undefined,
                      }))
                    }
                  />
                </label>
              </div>
            )}

            {op === "add_child" && spouses.length > 0 && (
              <label className="field-block">
                Drugi rodzic (opcjonalnie)
                <select
                  className="field-input"
                  value={secondParentId}
                  onChange={(e) => setSecondParentId(e.target.value)}
                >
                  <option value="">— tylko {displayName(anchor)} —</option>
                  {spouses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displayName(s)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="graph-edit__confirm" role="status">
            <p className="graph-edit__summary">{preview}</p>
            <ul className="graph-edit__facts">
              <li>
                <span>Operacja</span>
                <strong>{OP_TITLE[op]}</strong>
              </li>
              <li>
                <span>
                  {op === "reparent" ? "Przenoszona" : "Osoba z grafu"}
                </span>
                <strong>{displayName(anchor)}</strong>
              </li>
              <li>
                <span>
                  {op === "add_child"
                    ? "Dziecko"
                    : op === "link_spouse"
                      ? "Partner"
                      : "Nowy rodzic"}
                </span>
                <strong>
                  {mode === "existing" && related
                    ? displayName(related)
                    : `${newPerson.firstName} ${newPerson.lastName}`}
                </strong>
              </li>
              {op === "add_child" && secondParentId && (
                <li>
                  <span>Drugi rodzic</span>
                  <strong>
                    {displayName(
                      people.find((p) => p.id === secondParentId) || {
                        firstName: "?",
                        lastName: "",
                      },
                    )}
                  </strong>
                </li>
              )}
              {mode === "new" && newPerson.birthDate && (
                <li>
                  <span>Data urodzenia</span>
                  <strong>{newPerson.birthDate}</strong>
                </li>
              )}
              {mode === "new" && newPerson.deathDate && (
                <li>
                  <span>Data zgonu</span>
                  <strong>{newPerson.deathDate}</strong>
                </li>
              )}
              {op === "reparent" && anchor.parentIds.length > 0 && (
                <li>
                  <span>Obecni rodzice</span>
                  <strong>
                    {anchor.parentIds
                      .map((id) => {
                        const p = people.find((x) => x.id === id);
                        return p ? displayName(p) : id;
                      })
                      .join(", ")}
                  </strong>
                </li>
              )}
            </ul>
            <p className="graph-edit__note">
              {canEditTree
                ? "Jesteś adminem — zmiana zapisze się od razu w drzewie."
                : "Osoba pojawi się od razu na szaro. Możesz dodać dzieci i wnuki, a potem wysłać wszystko razem do admina."}
            </p>
          </div>
        )}

        {error && (
          <p
            ref={errorRef}
            className="banner-error"
            role="alert"
            tabIndex={-1}
          >
            {error}
          </p>
        )}

        <div className="modal-actions modal-actions--stack">
          {step === "pick" ? (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canContinue}
                onClick={() => setStep("confirm")}
              >
                Dalej — potwierdzenie
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleClose}
              >
                Anuluj
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={submit}
              >
                {busy
                  ? "Zapisuję…"
                  : canEditTree
                    ? "Potwierdź i zapisz"
                    : "Dodaj roboczo"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => setStep("pick")}
              >
                Wstecz
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={handleClose}
              >
                Anuluj
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
