"use client";

import { createPortal } from "react-dom";
import type { Person } from "@/types/family";
import { displayName, lifespan } from "@/lib/db-client";
import type { GraphEditOp } from "@/components/GraphEditWizard";

type Props = {
  person: Person;
  onClose: () => void;
  onEdit: (op: GraphEditOp) => void;
  onViewPerson: () => void;
  onFocusBranch: () => void;
};

const ACTIONS: {
  op: GraphEditOp;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    op: "add_child",
    label: "Dziecko",
    hint: "Dodaj pod tą osobą",
    icon: "+",
  },
  {
    op: "link_spouse",
    label: "Partner",
    hint: "Połącz małżeństwo",
    icon: "+",
  },
  {
    op: "reparent",
    label: "Przenieś",
    hint: "Zmień rodzica",
    icon: "↕",
  },
];

export function PersonTreeActionsModal({
  person,
  onClose,
  onEdit,
  onViewPerson,
  onFocusBranch,
}: Props) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="modal-backdrop graph-person-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="graph-person-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-card graph-person-modal graph-person-modal--actions"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <header className="graph-person-modal__head">
          <p className="graph-person-modal__label">Buduj drzewo</p>
          <h2 id="graph-person-title">{displayName(person)}</h2>
          <p className="graph-person-modal__sub">
            {lifespan(person) || "Wybierz, co dodać lub zmienić"}
          </p>
        </header>

        <div className="graph-plus-grid" role="group" aria-label="Akcje drzewa">
          {ACTIONS.map((action) => (
            <button
              key={action.op}
              type="button"
              className="graph-plus-tile"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(action.op);
              }}
            >
              <span className="graph-plus-tile__icon" aria-hidden>
                {action.icon}
              </span>
              <span className="graph-plus-tile__label">{action.label}</span>
              <span className="graph-plus-tile__hint">{action.hint}</span>
            </button>
          ))}
        </div>

        <div className="graph-person-modal__links">
          <button type="button" className="btn-text" onClick={onViewPerson}>
            Szczegóły osoby
          </button>
          <button type="button" className="btn-text" onClick={onFocusBranch}>
            Pokaż gałąź
          </button>
          <button type="button" className="btn-text" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
