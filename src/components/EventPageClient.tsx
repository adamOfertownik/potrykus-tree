"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";
import type { FamilyEvent } from "@/types/event";

type EventApi = {
  prototype: boolean;
  warning: string;
  event: FamilyEvent;
  stats: { rsvpCount: number; guestTotal: number };
  rsvps: {
    id: string;
    createdAt: string;
    fullName: string;
    guests: number;
    willTransfer: boolean;
  }[];
};

async function fetchEvent(): Promise<EventApi> {
  const res = await fetch("/api/event");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd wczytywania wydarzenia");
  return data as EventApi;
}

function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

export function EventPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const qc = useQueryClient();
  const eventQ = useQuery({
    queryKey: ["event"],
    queryFn: fetchEvent,
    enabled: unlocked,
  });

  const [fullName, setFullName] = useState("");
  const [personId, setPersonId] = useState<string | undefined>();
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(1);
  const [notes, setNotes] = useState("");
  const [willTransfer, setWillTransfer] = useState(true);
  const [nameQuery, setNameQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const r = loadReporter();
    if (r?.name) {
      setFullName(r.name);
      setPersonId(r.personId);
    }
  }, []);

  const people = family.data?.people ?? [];
  const matches = useMemo(
    () =>
      nameQuery.trim()
        ? searchPeople(people, nameQuery).slice(0, 6)
        : [],
    [people, nameQuery],
  );

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || eventQ.isLoading || !family.data || !eventQ.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie spotkania…</div>
      </AppShell>
    );
  }

  const { event, stats, rsvps, warning } = eventQ.data;
  const iban = event.transfer.iban?.trim();

  const copyIban = async () => {
    if (!iban) return;
    try {
      await navigator.clipboard.writeText(iban.replace(/\s/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      saveReporter({ name: fullName.trim(), personId });
      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          personId,
          phone: phone.trim() || undefined,
          guests,
          notes: notes.trim() || undefined,
          willTransfer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      setSuccess(data.warning || "Zapisano.");
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["event"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell peopleCount={family.data.people.length}>
      <article className="event-page">
        <header className="event-hero">
          <p className="event-hero__eyebrow">Wydarzenie rodzinne</p>
          <h1>{event.title}</h1>
          <p className="event-hero__lead">{event.description}</p>
          <ul className="event-meta">
            <li>
              <span>Kiedy</span>
              <strong>{event.dateLabel}</strong>
            </li>
            <li>
              <span>Gdzie</span>
              <strong>
                {event.place}
                {event.city ? `, ${event.city}` : ""}
              </strong>
            </li>
            <li>
              <span>Zapisy (prototyp)</span>
              <strong>
                {stats.rsvpCount} zgłoszeń · {stats.guestTotal} osób
              </strong>
            </li>
          </ul>
          {event.organizers?.length > 0 && (
            <p className="event-organizers">
              Organizacja: {event.organizers.join(" · ")}
            </p>
          )}
        </header>

        <section className="event-section event-transfer">
          <h2>Przelew / wpłata</h2>
          <p className="event-section__lead">{event.transfer.notes}</p>

          <dl className="transfer-grid">
            <div>
              <dt>Odbiorca</dt>
              <dd>{event.transfer.recipient || "—"}</dd>
            </div>
            <div>
              <dt>Numer konta</dt>
              <dd className="transfer-iban">
                {iban ? formatIban(iban) : "Numer konta — wkrótce"}
              </dd>
              {iban && (
                <button
                  type="button"
                  className="btn btn-secondary transfer-copy"
                  onClick={copyIban}
                >
                  {copied ? "Skopiowano" : "Kopiuj numer"}
                </button>
              )}
            </div>
            {event.transfer.bank && (
              <div>
                <dt>Bank</dt>
                <dd>{event.transfer.bank}</dd>
              </div>
            )}
            <div>
              <dt>Tytuł przelewu</dt>
              <dd>{event.transfer.titleTemplate}</dd>
            </div>
            <div>
              <dt>Kwota</dt>
              <dd>{event.transfer.amountHint}</dd>
            </div>
          </dl>
        </section>

        <section className="event-section">
          <h2>Zapisz się</h2>
          <p className="event-section__lead">
            Podaj kto przyjdzie i ile osób.{" "}
            <strong>Prototyp:</strong> zapisy nie trafiają jeszcze do trwałej
            bazy.
          </p>

          <form className="change-form" onSubmit={submit}>
            <label className="field-block">
              Znajdź siebie w drzewie (opcjonalnie)
              <input
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
                placeholder="Szukaj…"
              />
            </label>
            {matches.length > 0 && (
              <ul className="who-matches">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setFullName(displayName(p));
                        setPersonId(p.id);
                        setNameQuery("");
                      }}
                    >
                      {displayName(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="form-grid">
              <label>
                Imię i nazwisko *
                <input
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    setPersonId(undefined);
                  }}
                />
              </label>
              <label>
                Telefon
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="opcjonalnie"
                />
              </label>
              <label>
                Liczba osób *
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="field-block">
              Uwagi (np. alergie, dojazd)
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={willTransfer}
                onChange={(e) => setWillTransfer(e.target.checked)}
              />
              Planuję przelew / wpłatę według danych powyżej
            </label>

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
              {busy ? "Zapisuję…" : "Zapisz na spotkanie"}
            </button>
          </form>
        </section>

        <section className="event-section">
          <h2>Lista zapisanych ({rsvps.length})</h2>
          {rsvps.length === 0 ? (
            <p className="empty-hint">Nikt jeszcze się nie zapisał.</p>
          ) : (
            <ul className="rsvp-list">
              {rsvps.map((r) => (
                <li key={r.id}>
                  <strong>{r.fullName}</strong>
                  <span>
                    {r.guests} {r.guests === 1 ? "osoba" : "osób"}
                    {r.willTransfer ? " · przelew" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="event-footnote">{warning}</p>
          {event.contactNote && (
            <p className="event-footnote">{event.contactNote}</p>
          )}
        </section>
      </article>
    </AppShell>
  );
}
