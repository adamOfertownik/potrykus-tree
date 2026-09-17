"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AdminRelEditor } from "@/components/AdminRelEditor";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/db-client";
import { getChildrenIds } from "@/lib/tree";
import type { FamilyPayload, Person } from "@/types/family";

type Props = {
  person: Person;
  people: Person[];
  onClose: () => void;
};

export function AdminPersonRelsModal({ person, people, onClose }: Props) {
  const [editId, setEditId] = useState(person.id);
  const editing = people.find((p) => p.id === editId) ?? person;

  return (
    <Modal
      open
      labelledBy="admin-person-rels-title"
      onClose={onClose}
      cardClassName="admin-person-rels-modal"
    >
      <h2 id="admin-person-rels-title">Powiązania: {displayName(editing)}</h2>
      <p className="empty-hint">
        Odepnij zbędnego małżonka, rodzica albo dziecko — zapis podmienia
        listę, nie dokleja kolejnej.
      </p>
      <RelSaveForm
        key={editing.id}
        person={editing}
        people={people}
        onSwitchPerson={setEditId}
        onClose={onClose}
      />
    </Modal>
  );
}

function RelSaveForm({
  person,
  people,
  onSwitchPerson,
  onClose,
}: {
  person: Person;
  people: Person[];
  onSwitchPerson: (id: string) => void;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [parentIds, setParentIds] = useState(() => [...person.parentIds]);
  const [spouseIds, setSpouseIds] = useState(() => [...person.spouseIds]);
  const [childIds, setChildIds] = useState(() =>
    getChildrenIds(people, person.id),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          personId: person.id,
          fields: { parentIds, spouseIds, childIds },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      const family = data.family as FamilyPayload;
      qc.setQueryData(["family"], family);
      setSuccess("Zapisano powiązania.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="change-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <AdminRelEditor
        person={person}
        people={people}
        parentIds={parentIds}
        spouseIds={spouseIds}
        childIds={childIds}
        onParentIds={setParentIds}
        onSpouseIds={setSpouseIds}
        onChildIds={setChildIds}
        onOpenPerson={onSwitchPerson}
      />
      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="banner-success" role="status">
          {success}
        </p>
      )}
      <p className="empty-hint">
        <Link href={`/admin?osoba=${encodeURIComponent(person.id)}`}>
          Pełny panel admina
        </Link>
      </p>
      <div className="modal-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Zapisuję…" : "Zapisz powiązania"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Zamknij
        </button>
      </div>
    </form>
  );
}
