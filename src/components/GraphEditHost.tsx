"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GraphEditWizard,
  type GraphEditOp,
} from "@/components/GraphEditWizard";
import { PersonTreeActionsModal } from "@/components/PersonTreeActionsModal";
import type { Person } from "@/types/family";

type Applied = {
  summary: string;
  createdPersonId?: string;
};

type Props = {
  people: Person[];
  person: Person | null;
  onClose: () => void;
  onViewPerson: (person: Person) => void;
  onFocusBranch: (person: Person) => void;
  onApplied?: (payload: Applied) => void;
  toastClassName?: string;
};

export function GraphEditHost({
  people,
  person,
  onClose,
  onViewPerson,
  onFocusBranch,
  onApplied,
  toastClassName = "family-chart-toast",
}: Props) {
  const [editOp, setEditOp] = useState<GraphEditOp | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!person) setEditOp(null);
  }, [person]);

  const handleWizardClose = useCallback(() => {
    setEditOp(null);
  }, []);

  const handleApplied = useCallback(
    (payload: Applied) => {
      setEditOp(null);
      onCloseRef.current();
      setNotice(payload.summary);
      onApplied?.(payload);
      window.setTimeout(() => setNotice(null), 6000);
    },
    [onApplied],
  );

  return (
    <>
      {person && !editOp && (
        <PersonTreeActionsModal
          person={person}
          onClose={onClose}
          onEdit={setEditOp}
          onViewPerson={() => onViewPerson(person)}
          onFocusBranch={() => onFocusBranch(person)}
        />
      )}
      {person && editOp && (
        <GraphEditWizard
          open
          op={editOp}
          anchor={person}
          people={people}
          onClose={handleWizardClose}
          onApplied={handleApplied}
        />
      )}
      {notice && (
        <p className={toastClassName} role="status">
          {notice}
        </p>
      )}
    </>
  );
}
