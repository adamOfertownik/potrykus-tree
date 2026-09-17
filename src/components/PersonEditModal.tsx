"use client";

import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/db-client";
import { genderLabel } from "@/lib/submissionLabels";
import type { FamilyPayload, Person } from "@/types/family";
import type { PersonFieldPatch, SubmissionPayload } from "@/types/submissions";

type FormState = {
  firstName: string;
  lastName: string;
  maidenName: string;
  gender: Person["gender"];
  birthDate: string;
  deathDate: string;
  phone: string;
  notes: string;
};

function fromPerson(person: Person): FormState {
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

function norm(value?: string) {
  return (value ?? "").trim();
}

function correctionFromForm(
  person: Person,
  form: FormState,
): PersonFieldPatch | null {
  const patch: PersonFieldPatch = {};
  if (norm(form.firstName) !== norm(person.firstName) && form.firstName.trim()) {
    patch.firstName = form.firstName.trim();
  }
  if (norm(form.lastName) !== norm(person.lastName) && form.lastName.trim()) {
    patch.lastName = form.lastName.trim();
  }
  if (norm(form.maidenName) !== norm(person.maidenName)) {
    patch.maidenName = form.maidenName.trim();
  }
  if (form.gender !== person.gender) {
    patch.gender = form.gender;
  }
  if (norm(form.birthDate) !== norm(person.birthDate)) {
    patch.birthDate = form.birthDate.trim();
  }
  if (norm(form.deathDate) !== norm(person.deathDate)) {
    patch.deathDate = form.deathDate.trim();
  }
  if (norm(form.phone) !== norm(person.phone)) {
    patch.phone = form.phone.trim();
  }
  if (norm(form.notes) !== norm(person.notes)) {
    patch.notes = form.notes.trim();
  }
  return Object.keys(patch).length ? patch : null;
}

export function PersonEditModal({
  person,
  isAdmin,
  reporterName,
  reporterPersonId,
  onClose,
}: {
  person: Person;
  isAdmin: boolean;
  reporterName: string;
  reporterPersonId?: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => fromPerson(person));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set =
    (key: keyof FormState) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Imię i nazwisko są wymagane.");
      return;
    }
    const correction = correctionFromForm(person, form);
    if (!correction && !message.trim()) {
      setError("Nic nie zmieniono.");
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (isAdmin && correction) {
        const res = await fetch("/api/admin/family", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "update",
            personId: person.id,
            fields: {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              maidenName: form.maidenName.trim(),
              gender: form.gender,
              birthDate: form.birthDate.trim(),
              deathDate: form.deathDate.trim(),
              phone: form.phone.trim(),
              notes: form.notes.trim(),
            },
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Błąd zapisu");
        qc.setQueryData(["family"], data.family as FamilyPayload);
        setSuccess("Zapisano dane na drzewie.");
        return;
      }

      const who = reporterName.trim();
      if (!who) {
        throw new Error("Najpierw podaj, kim jesteś — kto zgłasza poprawkę.");
      }
      const payload: SubmissionPayload = {
        kind: correction ? "correction" : "other",
        reporterName: who,
        reporterPersonId,
        targetPersonId: person.id,
        targetPersonName: displayName(person),
        message:
          message.trim() ||
          `Poprawka danych z karty: ${displayName(person)}.`,
        correction: correction ?? undefined,
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      setSuccess(
        data.warning ||
          "Wysłano do zatwierdzenia. Drzewo zmieni się, gdy admin przyjmie poprawkę.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      labelledBy="person-edit-title"
      onClose={onClose}
      cardClassName="person-edit-modal"
    >
      <h2 id="person-edit-title">Popraw dane: {displayName(person)}</h2>
      <p className="empty-hint">
        {isAdmin
          ? "Zapiszesz od razu na drzewie."
          : "To sugestia. Drzewo nie zmieni się, dopóki admin nie zatwierdzi."}
      </p>
      <form
        className="change-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
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
        <div className="form-grid">
          <label>
            Imię
            <input
              required
              value={form.firstName}
              onChange={set("firstName")}
            />
          </label>
          <label>
            Nazwisko
            <input required value={form.lastName} onChange={set("lastName")} />
          </label>
          <label>
            Nazwisko rodowe
            <input value={form.maidenName} onChange={set("maidenName")} />
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
              onChange={set("birthDate")}
              placeholder="RRRR-MM-DD"
            />
          </label>
          <label>
            Data zgonu
            <input
              value={form.deathDate}
              onChange={set("deathDate")}
              placeholder="RRRR-MM-DD"
            />
          </label>
          <label>
            Telefon
            <input
              type="tel"
              value={form.phone}
              onChange={set("phone")}
            />
          </label>
        </div>
        <label className="field-block">
          Notatki
          <textarea rows={3} value={form.notes} onChange={set("notes")} />
        </label>
        {isAdmin ? null : (
          <label className="field-block">
            Co poprawić? (opcjonalnie)
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Np. data urodzenia to 12 maj 1964, a nie 1965…"
            />
          </label>
        )}
        <div className="modal-actions">
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy
              ? "Zapisuję…"
              : isAdmin
                ? "Zapisz"
                : "Wyślij do zatwierdzenia"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </form>
    </Modal>
  );
}
