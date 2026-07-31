"use client";

import { useState } from "react";
import type { RelativeDraft, SubmissionPayload } from "@/types/submissions";
import { Modal } from "@/components/Modal";

type Props = {
  open: boolean;
  searchedQuery: string;
  reporterName: string;
  reporterPersonId?: string;
  onClose: () => void;
  onSubmitted: () => void;
};

const emptyRelative = (): RelativeDraft => ({
  relation: "rodzic",
  firstName: "",
  lastName: "",
});

export function MissingPersonForm({
  open,
  searchedQuery,
  reporterName,
  reporterPersonId,
  onClose,
  onSubmitted,
}: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [maidenName, setMaidenName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "unknown">("unknown");
  const [message, setMessage] = useState(
    searchedQuery
      ? `Szukałem/am: „${searchedQuery}” — nie ma w drzewie.`
      : "",
  );
  const [relatives, setRelatives] = useState<RelativeDraft[]>([emptyRelative()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!open) return null;

  const updateRelative = (index: number, patch: Partial<RelativeDraft>) => {
    setRelatives((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload: SubmissionPayload = {
        kind: "missing_person",
        reporterName,
        reporterPersonId,
        reporterPhone: phone || undefined,
        message,
        self: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          maidenName: maidenName.trim() || undefined,
          birthDate: birthDate || undefined,
          gender,
          phone: phone || undefined,
        },
        relatives: relatives.filter((r) => r.firstName.trim()),
      };
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      setDone(true);
      onSubmitted();
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
      labelledBy="missing-person-title"
      cardClassName="modal-card--wide"
    >
      <header className="modal-card__head">
        <h2 id="missing-person-title">Nie ma Cię w drzewie?</h2>
        <p>
          Podaj swoje dane i bliskich (rodzice, rodzeństwo, dzieci) — dopasujemy
          gałąź.
        </p>
      </header>

      {done ? (
        <div className="modal-success">
          <p>Dzięki! Zapisaliśmy zgłoszenie.</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Zamknij
          </button>
        </div>
      ) : (
        <form className="change-form" onSubmit={submit}>
          <fieldset>
            <legend>Twoje dane</legend>
            <div className="form-grid">
              <label>
                Imię *
                <input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label>
                Nazwisko *
                <input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
              <label>
                Nazwisko rodowe
                <input
                  value={maidenName}
                  onChange={(e) => setMaidenName(e.target.value)}
                />
              </label>
              <label>
                Data urodzenia
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                />
              </label>
              <label>
                Płeć
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as typeof gender)}
                >
                  <option value="unknown">—</option>
                  <option value="female">kobieta</option>
                  <option value="male">mężczyzna</option>
                </select>
              </label>
              <label>
                Telefon (opcjonalnie)
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend>Bliscy (żeby przypasować)</legend>
            {relatives.map((rel, i) => (
              <div key={i} className="relative-row">
                <label>
                  Pokrewieństwo
                  <select
                    value={rel.relation}
                    onChange={(e) =>
                      updateRelative(i, { relation: e.target.value })
                    }
                  >
                    <option value="rodzic">rodzic</option>
                    <option value="małżonek">małżonek/partner</option>
                    <option value="dziecko">dziecko</option>
                    <option value="rodzeństwo">rodzeństwo</option>
                    <option value="dziadek/babcia">dziadek/babcia</option>
                    <option value="inne">inne</option>
                  </select>
                </label>
                <label>
                  Imię
                  <input
                    value={rel.firstName}
                    onChange={(e) =>
                      updateRelative(i, { firstName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Nazwisko
                  <input
                    value={rel.lastName}
                    onChange={(e) =>
                      updateRelative(i, { lastName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Data ur.
                  <input
                    type="date"
                    value={rel.birthDate || ""}
                    onChange={(e) =>
                      updateRelative(i, { birthDate: e.target.value })
                    }
                  />
                </label>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRelatives((r) => [...r, emptyRelative()])}
            >
              + Dodaj bliskiego
            </button>
          </fieldset>

          <label className="field-block">
            Dodatkowy opis
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Np. jestem dzieckiem Marii Lieske…"
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
