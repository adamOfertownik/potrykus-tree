"use client";

import { useState, type ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { DateField } from "@/components/DateField";
import { ConfirmEmailField } from "@/components/ConfirmEmailField";
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
  weddingDate: string;
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
    weddingDate: person.weddingDate || "",
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
  if (norm(form.weddingDate) !== norm(person.weddingDate)) {
    patch.weddingDate = form.weddingDate.trim();
  }
  if (norm(form.phone) !== norm(person.phone)) {
    patch.phone = form.phone.trim();
  }
  if (norm(form.notes) !== norm(person.notes)) {
    patch.notes = form.notes.trim();
  }
  return Object.keys(patch).length ? patch : null;
}

export function PersonEditForm({
  person,
  isAdmin,
  adminReady,
  reporterName,
  reporterPersonId,
  onNeedIdentity,
}: {
  person: Person;
  isAdmin: boolean;
  adminReady: boolean;
  reporterName: string;
  reporterPersonId?: string;
  onNeedIdentity?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => fromPerson(person));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

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
    if (!adminReady) {
      setError("Chwilę — sprawdzam, czy jesteś adminem.");
      return;
    }
    if (!isAdmin && !reporterName.trim()) {
      onNeedIdentity?.();
      setError("Najpierw podaj, kim jesteś — kto zgłasza poprawkę.");
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
              weddingDate: form.weddingDate.trim(),
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

      const payload: SubmissionPayload = {
        kind: correction ? "correction" : "other",
        reporterName: reporterName.trim(),
        reporterPersonId,
        reporterEmail: confirmEmail.trim() || undefined,
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
          (confirmEmail.trim()
            ? "Wysłano do zatwierdzenia. Kopia zmian idzie na podany adres — tylko jako potwierdzenie."
            : "Wysłano do zatwierdzenia. Drzewo zmieni się, gdy admin przyjmie poprawkę."),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      id="person-edit"
      className="change-form person-edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="empty-hint">
        {isAdmin
          ? "Jesteś adminem — zapis trafi od razu na drzewo."
          : "Zmiana imienia, nazwiska i reszty pól idzie do zatwierdzenia."}
      </p>
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
            autoComplete="given-name"
            value={form.firstName}
            onChange={set("firstName")}
          />
        </label>
        <label>
          Nazwisko
          <input
            required
            autoComplete="family-name"
            value={form.lastName}
            onChange={set("lastName")}
          />
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
          <DateField
            value={form.birthDate}
            onChange={(value) => setForm((s) => ({ ...s, birthDate: value }))}
          />
        </label>
        <label>
          Data zgonu
          <DateField
            value={form.deathDate}
            onChange={(value) => setForm((s) => ({ ...s, deathDate: value }))}
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
          <input type="tel" value={form.phone} onChange={set("phone")} />
        </label>
      </div>
      <label className="field-block">
        Notatki
        <textarea rows={3} value={form.notes} onChange={set("notes")} />
      </label>
      {isAdmin ? null : (
        <>
          <label className="field-block">
            Co poprawić? (opcjonalnie)
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Np. data urodzenia to 12 maj 1964, a nie 1965…"
            />
          </label>
          <ConfirmEmailField
            id={`person-confirm-email-${person.id}`}
            value={confirmEmail}
            onChange={setConfirmEmail}
          />
        </>
      )}
      <div className="modal-actions">
        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy || !adminReady}
        >
          {busy
            ? "Zapisuję…"
            : isAdmin
              ? "Zapisz na drzewie"
              : "Wyślij do zatwierdzenia"}
        </button>
      </div>
    </form>
  );
}

export function PersonEditModal({
  person,
  isAdmin,
  adminReady,
  reporterName,
  reporterPersonId,
  onNeedIdentity,
  onClose,
}: {
  person: Person;
  isAdmin: boolean;
  adminReady: boolean;
  reporterName: string;
  reporterPersonId?: string;
  onNeedIdentity?: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      labelledBy="person-edit-title"
      onClose={onClose}
      cardClassName="person-edit-modal"
    >
      <h2 id="person-edit-title">Popraw dane: {displayName(person)}</h2>
      <PersonEditForm
        person={person}
        isAdmin={isAdmin}
        adminReady={adminReady}
        reporterName={reporterName}
        reporterPersonId={reporterPersonId}
        onNeedIdentity={onNeedIdentity}
      />
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Zamknij
        </button>
      </div>
    </Modal>
  );
}
