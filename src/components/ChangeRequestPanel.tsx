"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person } from "@/types/family";
import type {
  ChangeKind,
  PersonFieldPatch,
  SubmissionPayload,
} from "@/types/submissions";
import { DateField } from "@/components/DateField";
import { displayName } from "@/lib/db-client";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import { uploadPersonPhoto } from "@/lib/upload-photo";

type Props = {
  people: Person[];
};

const KINDS: { id: ChangeKind; label: string }[] = [
  { id: "correction", label: "Poprawka danych" },
  { id: "dates", label: "Daty urodzenia / zgonu / ślubu" },
  { id: "photo", label: "Zdjęcie" },
  { id: "relatives", label: "Powiązania / bliscy" },
  { id: "missing_person", label: "Brakująca osoba" },
  { id: "other", label: "Inne" },
];

const emptyPatch = (): PersonFieldPatch => ({});

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
  const [patch, setPatch] = useState<PersonFieldPatch>(emptyPatch);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const r = loadReporter();
    if (r) {
      setReporterName(r.name);
      setReporterPersonId(r.personId);
    }
  }, []);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const target = useMemo(
    () => people.find((p) => p.id === targetPersonId),
    [people, targetPersonId],
  );

  const targetMatches =
    targetQuery.trim().length >= 1
      ? searchPeople(people, targetQuery).slice(0, 6)
      : [];

  const pickTarget = (p: Person) => {
    setTargetPersonId(p.id);
    setTargetPersonName(displayName(p));
    setTargetQuery("");
    setPatch({
      firstName: p.firstName,
      lastName: p.lastName,
      maidenName: p.maidenName,
      birthDate: p.birthDate,
      deathDate: p.deathDate,
      weddingDate: p.weddingDate,
      phone: p.phone,
      notes: p.notes,
    });
  };

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
      const correction =
        (kind === "correction" || kind === "dates") && target
          ? {
              ...(kind === "correction"
                ? {
                    firstName: patch.firstName,
                    lastName: patch.lastName,
                    maidenName: patch.maidenName,
                    phone: patch.phone,
                    notes: patch.notes,
                  }
                : {}),
              birthDate: patch.birthDate,
              deathDate: patch.deathDate,
              weddingDate: patch.weddingDate,
            }
          : undefined;
      const payload: SubmissionPayload = {
        kind,
        reporterName: reporterName.trim(),
        reporterPersonId,
        reporterPhone: reporterPhone.trim() || undefined,
        targetPersonId,
        targetPersonName: targetPersonName.trim() || undefined,
        message: message.trim(),
        correction,
        photoUrl: photoUrl || undefined,
        photoAction: kind === "photo" && photoUrl ? "set" : undefined,
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
          "Wysłano sugestię. Admin zobaczy podgląd i może ją zaakceptować albo odrzucić.",
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
          To jest sugestia dla admina. Drzewo nie zmieni się, dopóki zgłoszenie
          nie zostanie zaakceptowane.
        </p>
      </header>

      <form className="change-form" onSubmit={submit} noValidate>
        {error && (
          <div
            ref={errorRef}
            className="banner-error"
            role="alert"
            tabIndex={-1}
          >
            <strong>Nie udało się wysłać.</strong> {error}
          </div>
        )}
        {success && (
          <p className="banner-success" role="status">
            {success}
          </p>
        )}

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
                <button type="button" onClick={() => pickTarget(p)}>
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

        {(kind === "correction" || kind === "dates") && target && (
          <div className="form-grid">
            {kind === "correction" && (
              <>
                <label>
                  Imię
                  <input
                    value={patch.firstName || ""}
                    onChange={(e) =>
                      setPatch((s) => ({ ...s, firstName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Nazwisko
                  <input
                    value={patch.lastName || ""}
                    onChange={(e) =>
                      setPatch((s) => ({ ...s, lastName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Nazwisko rodowe
                  <input
                    value={patch.maidenName || ""}
                    onChange={(e) =>
                      setPatch((s) => ({ ...s, maidenName: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Telefon
                  <input
                    value={patch.phone || ""}
                    onChange={(e) =>
                      setPatch((s) => ({ ...s, phone: e.target.value }))
                    }
                  />
                </label>
              </>
            )}
            <label>
              Data urodzenia
              <DateField
                value={patch.birthDate || ""}
                onChange={(value) =>
                  setPatch((s) => ({ ...s, birthDate: value || undefined }))
                }
              />
            </label>
            <label>
              Data zgonu
              <DateField
                value={patch.deathDate || ""}
                onChange={(value) =>
                  setPatch((s) => ({ ...s, deathDate: value || undefined }))
                }
              />
            </label>
            <label>
              Data ślubu
              <DateField
                value={patch.weddingDate || ""}
                onChange={(value) =>
                  setPatch((s) => ({ ...s, weddingDate: value || undefined }))
                }
              />
            </label>
          </div>
        )}

        <label className="field-block">
          Opis zmiany {kind === "photo" && photoUrl ? "" : "*"}
          <textarea
            required={!(kind === "photo" && photoUrl)}
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
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setBusy(true);
                setError(null);
                try {
                  const data = await uploadPersonPhoto(file, undefined, {
                    skipSubmission: true,
                  });
                  setPhotoUrl(data.url);
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            {photoUrl && (
              <span className="photo-upload-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoUrl} alt="Wgrane zdjęcie" />
                <span>Zdjęcie w kolejce (jeszcze nie w drzewie)</span>
              </span>
            )}
          </label>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Zapisuję…" : "Wyślij sugestię"}
        </button>
      </form>
    </section>
  );
}
