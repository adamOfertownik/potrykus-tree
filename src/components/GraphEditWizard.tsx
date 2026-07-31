"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/db-client";
import {
  summarizeMutationPreview,
  type GraphOp,
  type NewPersonInput,
} from "@/lib/familyMutations";
import { loadReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import type { FamilyPayload, Gender, Person } from "@/types/family";

export type GraphEditOp = GraphOp;

type Props = {
  open: boolean;
  op: GraphEditOp;
  anchor: Person;
  people: Person[];
  onClose: () => void;
  onApplied?: (payload: {
    family: FamilyPayload;
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

  const reset = () => {
    setStep("pick");
    setMode("existing");
    setQuery("");
    setRelated(null);
    setSecondParentId("");
    setNewPerson({ firstName: "", lastName: "", gender: "unknown" });
    setBusy(false);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canContinue =
    mode === "existing"
      ? Boolean(related)
      : Boolean(newPerson.firstName.trim() && newPerson.lastName.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const reporter = loadReporter();
      const res = await fetch("/api/family/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...previewInput,
          reporterName: reporter?.name || "Edycja grafu",
          reporterPersonId: reporter?.personId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");

      if (data.family) {
        qc.setQueryData(["family"], data.family);
      } else {
        await qc.invalidateQueries({ queryKey: ["family"] });
      }

      onApplied?.({
        family: data.family,
        summary: data.applyWarning
          ? `${data.summary} ${data.applyWarning}`
          : data.summary,
        createdPersonId: data.createdPersonId,
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
      <div className="graph-edit">
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
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Imię lub nazwisko…"
                    autoFocus
                  />
                </label>
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
                  <p className="empty-hint">Brak wyników — spróbuj „Nowa osoba”.</p>
                )}
              </div>
            ) : (
              <div className="form-grid graph-edit__new">
                <label>
                  Imię *
                  <input
                    required
                    value={newPerson.firstName}
                    onChange={(e) =>
                      setNewPerson((s) => ({ ...s, firstName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Nazwisko *
                  <input
                    required
                    value={newPerson.lastName}
                    onChange={(e) =>
                      setNewPerson((s) => ({ ...s, lastName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Płeć
                  <select
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
                <label>
                  Data ur. (opcjonalnie)
                  <input
                    type="date"
                    value={newPerson.birthDate || ""}
                    onChange={(e) =>
                      setNewPerson((s) => ({
                        ...s,
                        birthDate: e.target.value || undefined,
                      }))
                    }
                  />
                </label>
                <label className="field-block">
                  Nazwisko rodowe
                  <input
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
              Po potwierdzeniu graf zaktualizuje się od razu. Zapis trafi też do
              zgłoszeń (audyt).
            </p>
          </div>
        )}

        {error && (
          <p className="banner-error" role="alert">
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
                {busy ? "Zapisuję…" : "Potwierdź i zapisz"}
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
