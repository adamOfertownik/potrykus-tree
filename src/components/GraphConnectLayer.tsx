"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/db-client";
import { postGraphMutation } from "@/lib/graphClient";
import type { GraphMutationInput, NewPersonInput } from "@/lib/familyMutations";
import type { FamilyPayload, Gender, Person } from "@/types/family";

export type LinkFrom =
  | { kind: "person"; id: string }
  | { kind: "draft"; person: NewPersonInput };

export type LinkRelation = "from_is_child" | "from_is_parent" | "spouses";

type Point = { x: number; y: number };

type Props = {
  people: Person[];
  wrapEl: HTMLElement | null;
  dragFrom: LinkFrom | null;
  dragStart: Point | null;
  dragPoint: Point | null;
  pendingDraft: NewPersonInput | null;
  onCancelDrag: () => void;
  onStartDraftDrag: (person: NewPersonInput, point: Point) => void;
  confirm: { from: LinkFrom; toId: string } | null;
  onCancelConfirm: () => void;
  onApplied: (payload: {
    family?: FamilyPayload;
    summary: string;
    createdPersonId?: string;
  }) => void;
};

function fromLabel(from: LinkFrom, people: Person[]): string {
  if (from.kind === "draft") {
    return `${from.person.firstName} ${from.person.lastName} (nowa)`.trim();
  }
  const p = people.find((x) => x.id === from.id);
  return p ? displayName(p) : from.id;
}

function buildMutation(
  from: LinkFrom,
  toId: string,
  relation: LinkRelation,
): GraphMutationInput {
  const newPerson = from.kind === "draft" ? from.person : undefined;
  const relatedPersonId = from.kind === "person" ? from.id : undefined;

  if (relation === "spouses") {
    return {
      op: "link_spouse",
      anchorPersonId: toId,
      relatedPersonId,
      newPerson,
    };
  }
  if (relation === "from_is_child") {
    return {
      op: "add_child",
      anchorPersonId: toId,
      relatedPersonId,
      newPerson,
    };
  }
  return {
    op: "reparent",
    anchorPersonId: toId,
    relatedPersonId,
    newPerson,
    replaceParentIds: true,
  };
}

export function NewBlockModal({
  open,
  onClose,
  onReady,
}: {
  open: boolean;
  onClose: () => void;
  onReady: (person: NewPersonInput) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState<Gender>("unknown");
  const [birthDate, setBirthDate] = useState("");

  const reset = () => {
    setFirstName("");
    setLastName("");
    setGender("unknown");
    setBirthDate("");
  };

  const canSave = Boolean(firstName.trim() && lastName.trim());

  return (
    <Modal
      open={open}
      labelledBy="new-block-title"
      onClose={() => {
        reset();
        onClose();
      }}
      cardClassName="graph-edit-modal"
    >
      <div className="graph-edit">
        <header className="graph-edit__head">
          <p className="graph-edit__eyebrow">Nowy klocek</p>
          <h2 id="new-block-title">Dodaj osobę, potem połącz strzałką</h2>
          <p className="graph-edit__hint">
            Wpisz dane. Potem przeciągnij strzałkę z klocka na kartę w drzewie i
            potwierdź, kim ta osoba jest (dziecko, rodzic albo partner).
          </p>
        </header>
        <div className="form-grid graph-edit__new">
          <label>
            Imię *
            <input
              type="text"
              autoComplete="off"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </label>
          <label>
            Nazwisko *
            <input
              type="text"
              autoComplete="off"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </label>
          <label>
            Płeć
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender)}
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
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </label>
        </div>
        <div className="modal-actions modal-actions--stack">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSave}
            onClick={() => {
              onReady({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                gender,
                birthDate: birthDate || undefined,
              });
              reset();
            }}
          >
            Dalej — połącz strzałką
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Anuluj
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LinkConfirmForm({
  confirm,
  toPerson,
  people,
  onCancel,
  onApplied,
}: {
  confirm: { from: LinkFrom; toId: string };
  toPerson: Person;
  people: Person[];
  onCancel: () => void;
  onApplied: Props["onApplied"];
}) {
  const [relation, setRelation] = useState<LinkRelation>("from_is_child");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromName = fromLabel(confirm.from, people);
  const toName = displayName(toPerson);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const input = buildMutation(confirm.from, confirm.toId, relation);
      const data = await postGraphMutation(input);
      onApplied({
        family: data.family,
        summary: data.applyWarning
          ? `${data.summary} ${data.applyWarning}`
          : data.summary,
        createdPersonId: data.createdPersonId,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="graph-edit">
      <header className="graph-edit__head">
        <p className="graph-edit__eyebrow">Potwierdź połączenie</p>
        <h2 id="link-confirm-title">Jak połączyć te osoby?</h2>
        <p className="graph-edit__hint">
          {fromName} → {toName}. Nic się nie zapisze, dopóki nie potwierdzisz.
        </p>
      </header>
      <div className="graph-plus-grid" role="radiogroup">
        {(
          [
            [
              "from_is_child",
              "Jest dzieckiem",
              `${fromName} to dziecko ${toName}`,
            ],
            [
              "from_is_parent",
              "Jest rodzicem",
              `${fromName} to rodzic ${toName}`,
            ],
            [
              "spouses",
              "Partnerzy",
              `${fromName} i ${toName} to małżeństwo / para`,
            ],
          ] as const
        ).map(([value, label, hint]) => (
          <button
            key={value}
            type="button"
            className={`graph-plus-tile${relation === value ? " is-active" : ""}`}
            onClick={() => setRelation(value)}
          >
            <span className="graph-plus-tile__label">{label}</span>
            <span className="graph-plus-tile__hint">{hint}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions modal-actions--stack">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          {busy ? "Zapisuję…" : "Potwierdź i zapisz"}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={busy}
          onClick={onCancel}
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

export function GraphConnectLayer({
  people,
  wrapEl,
  dragFrom,
  dragStart,
  dragPoint,
  pendingDraft,
  onCancelDrag,
  onStartDraftDrag,
  confirm,
  onCancelConfirm,
  onApplied,
}: Props) {

  const line =
    dragFrom && dragStart && dragPoint
      ? {
          x1: dragStart.x,
          y1: dragStart.y,
          x2: dragPoint.x,
          y2: dragPoint.y,
        }
      : null;

  const toPerson = confirm
    ? people.find((p) => p.id === confirm.toId)
    : null;

  return (
    <>
      {pendingDraft && !dragFrom && (
        <div className="chart-draft-chip">
          <p>
            Nowy klocek:{" "}
            <strong>
              {pendingDraft.firstName} {pendingDraft.lastName}
            </strong>
          </p>
          <p className="empty-hint">
            Chwyć strzałkę i puść na osobę w drzewie.
          </p>
          <button
            type="button"
            className="chart-draft-chip__handle"
            aria-label="Przeciągnij, aby połączyć"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const rect = wrapEl?.getBoundingClientRect();
              const point = {
                x: e.clientX - (rect?.left ?? 0),
                y: e.clientY - (rect?.top ?? 0),
              };
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              onStartDraftDrag(pendingDraft, point);
            }}
          >
            ↗ Połącz
          </button>
          <button type="button" className="btn-text" onClick={onCancelDrag}>
            Anuluj klocek
          </button>
        </div>
      )}

      {dragFrom && line && (
        <svg className="chart-link-svg" aria-hidden>
          <defs>
            <marker
              id="chart-link-arrow"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="var(--accent-strong)" />
            </marker>
          </defs>
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--accent-strong)"
            strokeWidth="3"
            markerEnd="url(#chart-link-arrow)"
          />
        </svg>
      )}

      {dragFrom && (
        <p className="family-chart-toast" role="status">
          Puść na kartę osoby. Esc = anuluj.
        </p>
      )}

      <Modal
        open={Boolean(confirm && toPerson)}
        labelledBy="link-confirm-title"
        onClose={onCancelConfirm}
        cardClassName="graph-edit-modal"
      >
        {confirm && toPerson ? (
          <LinkConfirmForm
            key={`${confirm.toId}-${fromLabel(confirm.from, people)}`}
            confirm={confirm}
            toPerson={toPerson}
            people={people}
            onCancel={onCancelConfirm}
            onApplied={onApplied}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function personIdFromChartNode(node: Element | null): string | null {
  let el: Element | null = node;
  while (el) {
    if (el.classList?.contains("card_cont")) {
      const datum = (el as Element & { __data__?: { data?: { id?: string } } })
        .__data__;
      return datum?.data?.id ?? null;
    }
    el = el.parentElement;
  }
  return null;
}
