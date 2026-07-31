"use client";

import { useEffect, useState } from "react";
import type { Person } from "@/types/family";
import type { ChangeKind, SubmissionPayload } from "@/types/submissions";
import { displayName } from "@/lib/db-client";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";

type Props = {
  people: Person[];
};

const KINDS: { id: ChangeKind; label: string }[] = [
  { id: "correction", label: "Poprawka danych" },
  { id: "dates", label: "Daty urodzenia / zgonu" },
  { id: "photo", label: "Zdjęcie" },
  { id: "relatives", label: "Powiązania / bliscy" },
  { id: "missing_person", label: "Brakująca osoba" },
  { id: "other", label: "Inne" },
];

export function ChangeRequestPanel({ people }: Props) {
  const [kind, setKind] = useState<ChangeKind>("correction");
  const [reporterName, setReporterName] = useState("");
  const [reporterPersonId, setReporterPersonId] = useState<string | undefined>();
  const [reporterPhone, setReporterPhone] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [targetPersonId, setTargetPersonId] = useState<string | undefined>();
  const [targetPersonName, setTargetPersonName] = useState("");
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const r = loadReporter();
    if (r) {
      setReporterName(r.name);
      setReporterPersonId(r.personId);
    }
  }, []);

  const targetMatches =
    targetQuery.trim().length >= 1
      ? searchPeople(people, targetQuery).slice(0, 6)
      : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      saveReporter({
        name: reporterName.trim(),
        personId: reporterPersonId,
      });
      const payload: SubmissionPayload = {
        kind,
        reporterName: reporterName.trim(),
        reporterPersonId,
        reporterPhone: reporterPhone.trim() || undefined,
        targetPersonId,
        targetPersonName: targetPersonName.trim() || undefined,
        message: [
          message.trim(),
          photoUrl ? `Zdjęcie: ${photoUrl}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
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
            : "Zapisano lokalnie (brak DATABASE_URL)."),
      );
      setMessage("");
      setPhotoUrl(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="change-panel">
      <header className="change-panel__head">
        <h1>Zgłoś zmianę</h1>
        <p>
          Poprawka, brakująca osoba, zdjęcie, daty — napisz, co zmienić i kto
          zgłasza.
        </p>
      </header>

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
          Kogo dotyczy zmiana?
          <input
            value={targetQuery || targetPersonName}
            onChange={(e) => {
              setTargetQuery(e.target.value);
              setTargetPersonName(e.target.value);
              setTargetPersonId(undefined);
            }}
            placeholder="Szukaj osoby w drzewie…"
          />
        </label>
        {targetMatches.length > 0 && (
          <ul className="who-matches">
            {targetMatches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setTargetPersonId(p.id);
                    setTargetPersonName(displayName(p));
                    setTargetQuery("");
                  }}
                >
                  {displayName(p)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {targetPersonId && (
          <p className="selected-chip">
            Wybrano: <strong>{targetPersonName}</strong>
          </p>
        )}

        <label className="field-block">
          Opis zmiany *
          <textarea
            required
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Np. data urodzenia to 12 maj 1964, a nie 1965…"
          />
        </label>

        {(kind === "photo" || kind === "missing_person") && (
          <label className="field-block">
            Zdjęcie (opcjonalnie)
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setError(null);
                try {
                  const body = new FormData();
                  body.append("file", file);
                  const res = await fetch("/api/photos/upload", {
                    method: "POST",
                    body,
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "Upload nieudany");
                  setPhotoUrl(data.url);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            {photoUrl && (
              <span className="selected-chip">
                Wgrano: <a href={photoUrl}>{photoUrl}</a>
              </span>
            )}
          </label>
        )}

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

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Zapisuję…" : "Wyślij zgłoszenie"}
        </button>
      </form>
    </section>
  );
}
