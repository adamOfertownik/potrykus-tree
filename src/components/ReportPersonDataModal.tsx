"use client";

import { useEffect, useState } from "react";
import type { Person } from "@/types/family";
import type { ChangeKind, SubmissionPayload } from "@/types/submissions";
import { displayName } from "@/lib/db-client";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { useIdentity } from "@/components/IdentityProvider";
import { Modal } from "@/components/Modal";

type Props = {
  open: boolean;
  person: Person;
  onClose: () => void;
};

const KINDS: { id: ChangeKind; label: string }[] = [
  { id: "correction", label: "Poprawka danych" },
  { id: "dates", label: "Daty urodzenia / zgonu" },
  { id: "photo", label: "Zdjęcie" },
  { id: "relatives", label: "Powiązania / bliscy" },
  { id: "other", label: "Inne" },
];

export function ReportPersonDataModal({ open, person, onClose }: Props) {
  const { identity } = useIdentity();
  const [kind, setKind] = useState<ChangeKind>("correction");
  const [reporterName, setReporterName] = useState("");
  const [reporterPersonId, setReporterPersonId] = useState<string | undefined>();
  const [reporterPhone, setReporterPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const r = identity || loadReporter();
    setKind("correction");
    setReporterName(r?.name || "");
    setReporterPersonId(r?.personId);
    setReporterPhone("");
    setMessage("");
    setBusy(false);
    setError(null);
    setSuccess(null);
  }, [open, person.id, identity]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const name = reporterName.trim();
      saveReporter({ name, personId: reporterPersonId });
      const payload: SubmissionPayload = {
        kind,
        reporterName: name,
        reporterPersonId,
        reporterPhone: reporterPhone.trim() || undefined,
        targetPersonId: person.id,
        targetPersonName: displayName(person),
        message: message.trim(),
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
          (data.storage === "neon"
            ? "Zapisano w bazie. Dziękujemy!"
            : "Zapisano lokalnie. Dziękujemy!"),
      );
      setMessage("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="report-person-title"
      cardClassName="modal-card--wide"
    >
      <header className="modal-card__head">
        <h2 id="report-person-title">Zgłoś błędne dane</h2>
        <p>
          Dotyczy: <strong>{displayName(person)}</strong>. Napisz, co jest
          nie tak — poprawimy po sprawdzeniu.
        </p>
      </header>

      {success ? (
        <div className="modal-success">
          <p>{success}</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      ) : (
        <form className="change-form" onSubmit={submit}>
          <label className="field-block">
            Rodzaj zgłoszenia
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as ChangeKind)}
            >
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <div className="form-grid">
            <label>
              Kto zgłasza *
              <input
                required
                value={reporterName}
                onChange={(e) => {
                  setReporterName(e.target.value);
                  setReporterPersonId(undefined);
                }}
                placeholder="Imię i nazwisko"
              />
            </label>
            <label>
              Telefon (opcjonalnie)
              <input
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
              />
            </label>
          </div>

          <label className="field-block">
            Co jest błędne? *
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Np. data urodzenia to 12 maj 1964, a nie 1965…"
            />
          </label>

          {error && (
            <p className="banner-error" role="alert">
              {error}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Anuluj
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Zapisuję…" : "Wyślij zgłoszenie"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
