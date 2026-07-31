"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { useAuthStatus, useFamily } from "@/lib/hooks";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";
import {
  amountDuePln,
  buildTransferTitle,
  formatPln,
  payingGuests,
  totalGuests,
} from "@/lib/eventPricing";
import type { FamilyEvent } from "@/types/event";

type EventApi = {
  storage?: string;
  event: FamilyEvent;
  stats: { rsvpCount: number; guestTotal: number; amountTotal?: number };
  rsvps: {
    id: string;
    createdAt: string;
    fullName: string;
    guests: number;
    adults?: number;
    children3to12?: number;
    childrenUnder3?: number;
    amountPln?: number;
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

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="guest-stepper">
      <div className="guest-stepper__text">
        <span className="guest-stepper__label">{label}</span>
        {hint ? <span className="guest-stepper__hint">{hint}</span> : null}
      </div>
      <div className="guest-stepper__controls">
        <button
          type="button"
          className="guest-stepper__btn"
          aria-label={`Mniej: ${label}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </button>
        <strong aria-live="polite">{value}</strong>
        <button
          type="button"
          className="guest-stepper__btn"
          aria-label={`Więcej: ${label}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </button>
      </div>
    </div>
  );
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
  const [adults, setAdults] = useState(1);
  const [children3to12, setChildren3to12] = useState(0);
  const [childrenUnder3, setChildrenUnder3] = useState(0);
  const [notes, setNotes] = useState("");
  const [willTransfer, setWillTransfer] = useState(true);
  const [nameQuery, setNameQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
      nameQuery.trim() ? searchPeople(people, nameQuery).slice(0, 6) : [],
    [people, nameQuery],
  );

  const price = eventQ.data?.event.pricePerPersonPln ?? 250;
  const breakdown = useMemo(
    () => ({ adults, children3to12, childrenUnder3 }),
    [adults, children3to12, childrenUnder3],
  );
  const guests = totalGuests(breakdown);
  const paying = payingGuests(breakdown);
  const amount = amountDuePln(breakdown, price);

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || eventQ.isLoading || !family.data || !eventQ.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie spotkania…</div>
      </AppShell>
    );
  }

  const { event, stats, rsvps } = eventQ.data;
  const iban = event.transfer.iban?.trim();
  const transferTitle = buildTransferTitle(
    event.transfer.titleTemplate,
    fullName,
    guests,
    amount,
  );

  const flashCopy = (key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      flashCopy(key);
    } catch {
      setCopied(null);
    }
  };

  const copyPaymentBundle = async () => {
    const lines = [
      `Przelew — ${event.title}`,
      `Odbiorca: ${event.transfer.recipient || "—"}`,
      iban ? `Konto: ${iban.replace(/\s/g, "")}` : "Konto: (uzupełnimy wkrótce)",
      event.transfer.bank ? `Bank: ${event.transfer.bank}` : null,
      `Tytuł: ${transferTitle}`,
      `Kwota: ${amount} PLN`,
    ].filter(Boolean);
    await copyText("bundle", lines.join("\n"));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (guests < 1) {
      setError("Wybierz co najmniej jedną osobę.");
      return;
    }
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
          adults,
          children3to12,
          childrenUnder3,
          notes: notes.trim() || undefined,
          willTransfer,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      const paid = formatPln(data.amountPln ?? amount);
      setSuccess(
        data.warning
          ? `${data.warning} Kwota: ${paid}.`
          : `Zapisano. Do zapłaty: ${paid}. Skopiuj dane przelewu poniżej.`,
      );
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
              <span>Cena</span>
              <strong>{formatPln(price)} / osoba</strong>
            </li>
            <li>
              <span>Zapisy</span>
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

        {event.amenities?.length > 0 && (
          <section className="event-section">
            <h2>Na miejscu</h2>
            <p className="event-section__lead">
              Co warto wiedzieć przed przyjazdem do Jastrzębiej Góry.
            </p>
            <ul className="event-amenities">
              {event.amenities.map((a) => (
                <li key={a.id}>
                  <strong>{a.title}</strong>
                  <span>{a.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {event.schedule?.length > 0 && (
          <section className="event-section">
            <h2>Harmonogram imprezy</h2>
            <p className="event-section__lead">
              Plan dnia {event.dateLabel} — godziny orientacyjne.
            </p>
            <ol className="event-schedule">
              {event.schedule.map((item) => (
                <li key={`${item.time}-${item.title}`}>
                  <time dateTime={item.time}>{item.time}</time>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="event-section" id="zapisz">
          <h2>Zapisz się i policz opłatę</h2>
          <p className="event-section__lead">
            {formatPln(price)} od osoby dorosłej i dziecka 3–12 lat. Dzieci do
            lat 3 — bez opłaty.
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
            </div>

            <div className="guest-steppers" role="group" aria-label="Liczba osób">
              <Stepper
                label="Osoby (13+)"
                hint={`${formatPln(price)} / os.`}
                value={adults}
                min={0}
                max={20}
                onChange={setAdults}
              />
              <Stepper
                label="Dzieci 3–12 lat"
                hint={`${formatPln(price)} / os.`}
                value={children3to12}
                min={0}
                max={20}
                onChange={setChildren3to12}
              />
              <Stepper
                label="Dzieci do lat 3"
                hint="bez opłaty"
                value={childrenUnder3}
                min={0}
                max={20}
                onChange={setChildrenUnder3}
              />
            </div>

            <label className="field-block">
              Uwagi (alergie, dojazd, preferencje)
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
              Zapłacę przelewem według danych poniżej
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

            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || guests < 1}
            >
              {busy ? "Zapisuję…" : "Zapisz na spotkanie"}
            </button>
          </form>
        </section>

        <section className="event-section event-pay" id="platnosc">
          <h2>Szybka płatność</h2>
          <p className="event-section__lead">{event.transfer.notes}</p>

          <div className="pay-summary">
            <div>
              <span>Razem osób</span>
              <strong>{guests}</strong>
            </div>
            <div>
              <span>Płatne miejsca</span>
              <strong>{paying}</strong>
            </div>
            <div className="pay-summary__total">
              <span>Do zapłaty</span>
              <strong>{formatPln(amount)}</strong>
            </div>
          </div>

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
                  onClick={() => copyText("iban", iban.replace(/\s/g, ""))}
                >
                  {copied === "iban" ? "Skopiowano" : "Kopiuj numer"}
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
              <dd>{transferTitle}</dd>
              <button
                type="button"
                className="btn btn-secondary transfer-copy"
                onClick={() => copyText("title", transferTitle)}
              >
                {copied === "title" ? "Skopiowano" : "Kopiuj tytuł"}
              </button>
            </div>
            <div>
              <dt>Kwota</dt>
              <dd>{formatPln(amount)}</dd>
              <button
                type="button"
                className="btn btn-secondary transfer-copy"
                onClick={() => copyText("amount", String(amount))}
              >
                {copied === "amount" ? "Skopiowano" : "Kopiuj kwotę"}
              </button>
            </div>
          </dl>

          <div className="pay-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={copyPaymentBundle}
              disabled={amount < 1 && !iban}
            >
              {copied === "bundle"
                ? "Skopiowano dane przelewu"
                : "Kopiuj wszystko do przelewu"}
            </button>
            <a className="btn btn-secondary" href="#zapisz">
              Wróć do zapisu
            </a>
          </div>
          <p className="event-footnote">
            {event.transfer.amountHint} Po uzupełnieniu numeru konta wystarczy
            wkleić skopiowane dane w aplikacji bankowej.
          </p>
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
                    {typeof r.amountPln === "number" && r.amountPln > 0
                      ? ` · ${formatPln(r.amountPln)}`
                      : ""}
                    {r.willTransfer ? " · przelew" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {event.contactNote && (
            <p className="event-footnote">{event.contactNote}</p>
          )}
        </section>
      </article>
    </AppShell>
  );
}
