"use client";

import type { ReactNode } from "react";
import type { Person } from "@/types/family";
import { displayName, lifespan } from "@/lib/db-client";
import type { GraphEditOp } from "@/components/GraphEditWizard";
import { Modal } from "@/components/Modal";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";

type Props = {
  person: Person;
  onClose: () => void;
  onEdit: (op: GraphEditOp) => void;
  onViewPerson: () => void;
  onFocusBranch: () => void;
};

function TileSvg({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </svg>
  );
}

const ACTIONS: {
  op: GraphEditOp;
  label: string;
  hint: string;
  icon: ReactNode;
}[] = [
  {
    op: "add_child",
    label: "Dziecko",
    hint: "Dodaj pod tą osobą",
    icon: (
      <TileSvg>
        <circle cx="10" cy="8" r="3" />
        <path d="M4 19c0-3 2.5-5 6-5s6 2 6 5" />
        <path d="M19 6v6M16 9h6" />
      </TileSvg>
    ),
  },
  {
    op: "link_spouse",
    label: "Partner",
    hint: "Połącz małżeństwo",
    icon: (
      <TileSvg>
        <circle cx="8" cy="8" r="2.5" />
        <circle cx="16" cy="8" r="2.5" />
        <path d="M3.5 19c0-2.6 2-4.5 4.5-4.5S12.5 16.4 12.5 19" />
        <path d="M11.5 19c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5" />
      </TileSvg>
    ),
  },
  {
    op: "reparent",
    label: "Przenieś",
    hint: "Zmień rodzica",
    icon: (
      <TileSvg>
        <path d="M12 4v16" />
        <path d="M8 8l4-4 4 4" />
        <path d="M16 16l-4 4-4-4" />
      </TileSvg>
    ),
  },
];

export function PersonTreeActionsModal({
  person,
  onClose,
  onEdit,
  onViewPerson,
  onFocusBranch,
}: Props) {
  return (
    <Modal
      open
      labelledBy="graph-person-title"
      onClose={onClose}
      className="graph-person-backdrop"
      cardClassName="graph-person-modal graph-person-modal--actions"
    >
      <header className="graph-person-modal__head">
        <div className="graph-person-modal__identity">
          <PersonPhotoControl person={person} size="md" />
          <div>
            <p className="graph-person-modal__label">Buduj drzewo</p>
            <h2 id="graph-person-title">{displayName(person)}</h2>
            <p className="graph-person-modal__sub">
              {lifespan(person) || "Wybierz, co dodać lub zmienić"}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="modal-close"
          aria-label="Zamknij"
          onClick={onClose}
        >
          ×
        </button>
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
        <button type="button" className="btn btn-secondary" onClick={onViewPerson}>
          Szczegóły osoby
        </button>
        <button type="button" className="btn btn-secondary" onClick={onFocusBranch}>
          Pokaż gałąź
        </button>
      </div>
    </Modal>
  );
}
