"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessGate } from "@/components/AccessGate";
import { AppShell } from "@/components/AppShell";
import { GuestTicketSteppers } from "@/components/GuestTicketSteppers";
import { useAdminAuthStatus, useAuthStatus, useFamily } from "@/lib/hooks";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { searchPeople } from "@/lib/search";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { householdSuggestions } from "@/lib/eventAttending";
import {
  ageGroupFromBirth,
  amountDuePln,
  breakdownFromAgeGroups,
  buildTransferTitle,
  DEFAULT_PRICE_PER_PERSON_PLN,
  DEFAULT_PRICE_UNDER_7_PLN,
  EARLY_ARRIVAL_OVER_7_PLN,
  EARLY_ARRIVAL_UNDER_7_PLN,
  earlyArrivalSurchargePln,
  formatPln,
  ticketSummary,
  totalGuests,
  type GuestBreakdown,
} from "@/lib/eventPricing";
import type { FamilyEvent } from "@/types/event";
import type { Person } from "@/types/family";

type EventApi = {
  storage?: string;
  event: FamilyEvent;
  stats: {
    rsvpCount: number;
    guestTotal: number;
    capacity?: number;
    spotsLeft?: number;
    amountTotal?: number;
    paidCount?: number;
    paidTotal?: number;
  };
  rsvps: {
    id: string;
    createdAt: string;
    fullName: string;
    personId?: string;
    guests: number;
    adults?: number;
    children3to12?: number;
    childrenUnder3?: number;
    amountPln?: number;
    willTransfer?: boolean;
    paid?: boolean;
    earlyArrival?: boolean;
    coveredPersonIds?: string[];
    source?: "form" | "admin";
  }[];
};

type PartyMember = {
  key: string;
  personId?: string;
  name: string;
};

async function fetchEvent(): Promise<EventApi> {
  const res = await fetch("/api/event");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd wczytywania wydarzenia");
  return data as EventApi;
}

function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "");
  if (/^\d{26}$/.test(clean)) {
    return `${clean.slice(0, 2)} ${clean
      .slice(2)
      .replace(/(.{4})/g, "$1 ")
      .trim()}`;
  }
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function memberFromPerson(person: Person, people: Person[]): PartyMember {
  return {
    key: person.id,
    personId: person.id,
    name: displayName(person, people),
  };
}

function ticketsFromParty(
  members: PartyMember[],
  people: Person[],
): GuestBreakdown {
  if (!members.length) {
    return { adults: 0, children3to12: 0, childrenUnder3: 0 };
  }
  return breakdownFromAgeGroups(
    members.map((m) =>
      ageGroupFromBirth(people.find((p) => p.id === m.personId)?.birthDate),
    ),
  );
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

function EventPersonField({
  people,
  label,
  placeholder,
  excludeIds,
  onPick,
}: {
  people: Person[];
  label: string;
  placeholder: string;
  excludeIds: Set<string>;
  onPick: (person: Person) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return searchPeople(people, query)
      .filter((p) => !excludeIds.has(p.id))
      .slice(0, 8);
  }, [people, query, excludeIds]);

  return (
    <div className="field-block event-person-field">
      <label>
        {label}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
      </label>
      {matches.length > 0 && (
        <ul className="who-matches">
          {matches.map((p) => {
            const dates = formatPolishDate(p.birthDate);
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(p);
                    setQuery("");
                  }}
                >
                  {displayName(p, people)}
                  {dates ? ` · ur. ${dates}` : ""}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function EventPageClient() {
  const auth = useAuthStatus();
  const unlocked = Boolean(auth.data?.unlocked);
  const family = useFamily(unlocked);
  const admin = useAdminAuthStatus();
  const qc = useQueryClient();
  const eventQ = useQuery({
    queryKey: ["event"],
    queryFn: fetchEvent,
    enabled: unlocked,
  });

  const [fullName, setFullName] = useState("");
  const [personId, setPersonId] = useState<string | undefined>();
  const [party, setParty] = useState<PartyMember[]>([]);
  const [tickets, setTickets] = useState<GuestBreakdown>({
    adults: 0,
    children3to12: 0,
    childrenUnder3: 0,
  });
  const [ticketsTouched, setTicketsTouched] = useState(false);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [willTransfer, setWillTransfer] = useState(true);
  const [earlyArrival, setEarlyArrival] = useState(false);
  const [earlyArrivalOver7, setEarlyArrivalOver7] = useState(0);
  const [earlyArrivalUnder7, setEarlyArrivalUnder7] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [paidBusyId, setPaidBusyId] = useState<string | null>(null);

  const people = family.data?.people ?? [];

  useEffect(() => {
    const r = loadReporter();
    if (!r?.name) return;
    setFullName(r.name);
    setPersonId(r.personId);
  }, []);

  useEffect(() => {
    if (!personId || party.length > 0 || !people.length) return;
    const found = people.find((p) => p.id === personId);
    if (found) setParty([memberFromPerson(found, people)]);
  }, [people, personId, party.length]);

  const excludeIds = useMemo(
    () => new Set(party.map((m) => m.personId).filter(Boolean) as string[]),
    [party],
  );

  const suggestions = useMemo(
    () => (personId ? householdSuggestions(personId, people) : []),
    [personId, people],
  );

  const price =
    eventQ.data?.event.pricePerPersonPln ?? DEFAULT_PRICE_PER_PERSON_PLN;
  const priceUnder7 =
    eventQ.data?.event.priceUnder7Pln ?? DEFAULT_PRICE_UNDER_7_PLN;

  const suggestedTickets = useMemo(
    () => ticketsFromParty(party, people),
    [party, people],
  );
  const breakdown = tickets;
  const ticketsMismatch =
    party.length > 0 &&
    (tickets.adults !== suggestedTickets.adults ||
      tickets.children3to12 !== suggestedTickets.children3to12 ||
      tickets.childrenUnder3 !== suggestedTickets.childrenUnder3);
  const early = useMemo(
    () => ({ earlyArrival, earlyArrivalOver7, earlyArrivalUnder7 }),
    [earlyArrival, earlyArrivalOver7, earlyArrivalUnder7],
  );
  const guests = totalGuests(breakdown);
  const amount = amountDuePln(breakdown, price, early, priceUnder7);
  const earlyFee = earlyArrivalSurchargePln(early);
  const titleNames =
    party.map((m) => m.name).filter(Boolean).join(", ") || fullName;
  const transferTitle = buildTransferTitle(
    breakdown.adults,
    breakdown.children3to12,
    titleNames,
  );

  useEffect(() => {
    if (ticketsTouched) return;
    const next = ticketsFromParty(party, people);
    if (totalGuests(next) < 1 && fullName.trim()) {
      setTickets({ adults: 1, children3to12: 0, childrenUnder3: 0 });
      return;
    }
    setTickets(next);
  }, [party, people, ticketsTouched, fullName]);

  const setPayer = (person: Person) => {
    const next = memberFromPerson(person, people);
    setFullName(next.name);
    setPersonId(person.id);
    setParty([next]);
    setTicketsTouched(false);
  };

  const addMember = (person: Person) => {
    setParty((cur) => {
      if (cur.some((m) => m.personId === person.id)) return cur;
      const next = memberFromPerson(person, people);
      if (cur.length === 0) {
        setFullName(next.name);
        setPersonId(person.id);
        return [next];
      }
      return [...cur, next];
    });
  };

  const removeMember = (key: string) => {
    setParty((cur) => {
      const next = cur.filter((m) => m.key !== key);
      if (cur[0]?.key === key) {
        const head = next[0];
        setFullName(head?.name ?? "");
        setPersonId(head?.personId);
      }
      return next;
    });
  };

  if (auth.isLoading) return <div className="loading-screen">Ładowanie…</div>;
  if (!auth.data?.unlocked) return <AccessGate />;
  if (family.isLoading || eventQ.isLoading || !family.data || !eventQ.data) {
    return (
      <AppShell>
        <div className="loading-screen">Wczytywanie spotkania…</div>
      </AppShell>
    );
  }

  const { event, stats, rsvps, storage } = eventQ.data;
  const photos = event.photos;
  const spotsLeft =
    stats.spotsLeft ??
    Math.max(0, (stats.capacity ?? event.capacity) - stats.guestTotal);
  const iban = event.transfer.iban?.trim();
  const isAdmin = Boolean(admin.data?.loggedIn);
  const byId = new Map(people.map((p) => [p.id, p]));

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
    const members =
      party.length > 0
        ? party
        : fullName.trim()
          ? [
              {
                key: "payer",
                personId,
                name: fullName.trim(),
              },
            ]
          : [];
    const payerName = (members[0]?.name || fullName).trim();
    if (!payerName) {
      setError("Wybierz osobę z drzewa albo wpisz imię i nazwisko.");
      return;
    }
    if (totalGuests(tickets) < 1) {
      setError("Wybierz bilety: ile osób 7+ i ile dzieci.");
      return;
    }
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const payerId = party[0]?.personId ?? personId;
      saveReporter({ name: payerName, personId: payerId });
      const res = await fetch("/api/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: payerName,
          personId: payerId,
          phone: phone.trim() || undefined,
          adults: tickets.adults,
          children3to12: tickets.children3to12,
          childrenUnder3: tickets.childrenUnder3,
          notes: notes.trim() || undefined,
          willTransfer,
          earlyArrival,
          earlyArrivalOver7: earlyArrival ? earlyArrivalOver7 : 0,
          earlyArrivalUnder7: earlyArrival ? earlyArrivalUnder7 : 0,
          coveredPersonIds: members
            .map((m) => m.personId)
            .filter((id): id is string => Boolean(id)),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd zapisu");
      const paid = formatPln(data.amountPln ?? amount);
      setSuccess(
        data.warning
          ? `${data.warning} Kwota: ${paid}.`
          : willTransfer
            ? `Zapisano. Do zapłaty: ${paid}. W tytule przelewu koniecznie „IMPREZA RODZINNA”.`
            : `Zapisano. Do zapłaty gotówką na miejscu: ${paid}.`,
      );
      setNotes("");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["event"] }),
        qc.invalidateQueries({ queryKey: ["family"] }),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (id: string, paid: boolean) => {
    setPaidBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/event/paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvpId: id, paid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      await qc.invalidateQueries({ queryKey: ["event"] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPaidBusyId(null);
    }
  };

  const cancelRsvp = async (id: string) => {
    setCancelId(id);
    try {
      const res = await fetch("/api/event/attend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rsvpId: id, attending: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["event"] }),
        qc.invalidateQueries({ queryKey: ["family"] }),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCancelId(null);
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
              <strong>
                {formatPln(price)} / {formatPln(priceUnder7)} / 0 zł
              </strong>
            </li>
            <li>
              <span>Zapisy</span>
              <strong>
                {stats.guestTotal} / {stats.capacity ?? event.capacity} miejsc
                {typeof stats.spotsLeft === "number"
                  ? ` · wolne ${stats.spotsLeft}`
                  : ""}
              </strong>
            </li>
          </ul>
          {event.organizers?.length > 0 && (
            <p className="event-organizers">
              Organizacja: {event.organizers.join(" · ")}
            </p>
          )}
          <p className="event-organizers">
            {storage === "neon"
              ? "Liczba zapisanych jest liczona na żywo z bazy (200 miejsc)."
              : "Lokalny zapis — na produkcji zapisy idą do bazy Neon."}
          </p>
        </header>

        {event.amenities?.length > 0 && (
          <section className="event-section">
            <h2>Na miejscu</h2>
            <p className="event-section__lead">
              W cenie: sala, jedzenie, DJ, a dodatkowo bez dopłaty nocleg ze
              śniadaniem.
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

        {photos && (photos.email || photos.driveUrl) ? (
          <section className="event-section" id="zdjecia">
            <h2>Zdjęcia rodziców</h2>
            <p className="event-section__lead">
              Proszę przysyłać zdjęcia swoich rodziców z dokładnym opisem,{" "}
              <strong>kto jest na zdjęciu</strong> i <strong>od kogo</strong>{" "}
              pochodzi. Pokażemy je na imprezie.
            </p>
            <ul className="event-photos">
              {photos.email ? (
                <li>
                  <strong>E-mail</strong>
                  <a href={`mailto:${photos.email}`}>{photos.email}</a>
                  <button
                    type="button"
                    className="btn btn-secondary transfer-copy"
                    onClick={() => copyText("email", photos.email)}
                  >
                    {copied === "email" ? "Skopiowano" : "Kopiuj adres"}
                  </button>
                </li>
              ) : null}
              {photos.driveUrl ? (
                <li>
                  <strong>Folder Google Drive</strong>
                  <a
                    href={photos.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Wstaw zdjęcia tutaj
                  </a>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

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
            Wybierz siebie z drzewa (np. Adam Lieske), zaznacz za kogo płacisz,
            a potem ile biletów: 7+ — {formatPln(price)}, do lat 7 —{" "}
            {formatPln(priceUnder7)}, do lat 3 — 0 zł. Daty z drzewa
            podpowiadają, ale nie blokują zapisu.
          </p>

          <form className="change-form" onSubmit={submit}>
            <EventPersonField
              people={people}
              label="Kto się zgłasza / kto płaci"
              placeholder="Szukaj, np. Adam Lieske…"
              excludeIds={new Set()}
              onPick={setPayer}
            />

            <label className="field-block">
              Imię i nazwisko *
              <input
                required
                value={fullName}
                onChange={(e) => {
                  const value = e.target.value;
                  setFullName(value);
                  setPersonId(undefined);
                  setParty((cur) => {
                    if (!cur.length) {
                      return value.trim()
                        ? [
                            {
                              key: "payer",
                              name: value,
                            },
                          ]
                        : [];
                    }
                    const [head, ...rest] = cur;
                    if (head.personId) {
                      return [
                        { key: "payer", name: value },
                        ...rest,
                      ];
                    }
                    return [{ ...head, name: value }, ...rest];
                  });
                }}
              />
            </label>

            {party.length > 0 && (
              <div className="event-party" role="group" aria-label="Za kogo płacisz">
                <p className="event-party__lead">Za kogo płacisz</p>
                {party.map((member, index) => (
                  <div key={member.key} className="event-party__member">
                    <div className="event-party__head">
                      <strong>
                        {index === 0 ? "Płatnik: " : ""}
                        {member.name}
                      </strong>
                      {party.length > 1 || member.personId ? (
                        <button
                          type="button"
                          className="btn btn-secondary event-party__remove"
                          onClick={() => removeMember(member.key)}
                        >
                          Usuń
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="event-suggest">
                <p className="event-party__lead">
                  Za kogo jeszcze płacisz? Rodzina {fullName || "tej osoby"}:
                </p>
                {suggestions.map((p) => {
                  const checked = excludeIds.has(p.id);
                  const dates = formatPolishDate(p.birthDate);
                  return (
                    <label key={p.id}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          if (checked) removeMember(p.id);
                          else addMember(p);
                        }}
                      />
                      <span>
                        {displayName(p, people)}
                        {dates ? ` · ur. ${dates}` : ""}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}

            <EventPersonField
              people={people}
              label="Dodaj kolejną osobę z drzewa"
              placeholder="Szukaj kolejnej osoby…"
              excludeIds={excludeIds}
              onPick={addMember}
            />

            <fieldset className="event-tickets">
              <legend>Bilety</legend>
              <p className="empty-hint">
                Ile dorosłych i ile dzieci — zbiorczo, nie przy każdej osobie.
              </p>
              <GuestTicketSteppers
                value={tickets}
                onChange={(next) => {
                  setTickets(next);
                  setTicketsTouched(true);
                }}
                pricePerPersonPln={price}
                priceUnder7Pln={priceUnder7}
              />
              {ticketsMismatch ? (
                <p className="event-ticket-warn" role="status">
                  Z dat urodzenia wychodzi {ticketSummary(suggestedTickets)}.
                  Zgłoszenie i tak przejdzie — sprawdzimy ręcznie.
                </p>
              ) : party.length > 0 && totalGuests(suggestedTickets) > 0 ? (
                <p className="empty-hint">
                  Z dat urodzenia: {ticketSummary(suggestedTickets)}.
                </p>
              ) : null}
            </fieldset>

            <div className="form-grid">
              <label>
                Telefon
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="opcjonalnie"
                />
              </label>
            </div>

            <label className="check-row">
              <input
                type="checkbox"
                checked={earlyArrival}
                onChange={(e) => {
                  const on = e.target.checked;
                  setEarlyArrival(on);
                  if (on) {
                    setEarlyArrivalOver7((n) =>
                      n > 0 ? n : breakdown.adults,
                    );
                  } else {
                    setEarlyArrivalOver7(0);
                    setEarlyArrivalUnder7(0);
                  }
                }}
              />
              Przyjazd dzień wcześniej (+{EARLY_ARRIVAL_OVER_7_PLN} zł / os.,
              do 7 lat {EARLY_ARRIVAL_UNDER_7_PLN} zł, do 3 lat za darmo)
            </label>
            {earlyArrival ? (
              <div
                className="guest-steppers"
                role="group"
                aria-label="Wcześniejszy przyjazd"
              >
                <Stepper
                  label="Osoby 7 lat i więcej"
                  hint={`+${formatPln(EARLY_ARRIVAL_OVER_7_PLN)} / os.`}
                  value={earlyArrivalOver7}
                  min={0}
                  max={20}
                  onChange={setEarlyArrivalOver7}
                />
                <Stepper
                  label="Dzieci do 7 lat"
                  hint={`+${formatPln(EARLY_ARRIVAL_UNDER_7_PLN)} / os.`}
                  value={earlyArrivalUnder7}
                  min={0}
                  max={20}
                  onChange={setEarlyArrivalUnder7}
                />
              </div>
            ) : null}

            <label className="field-block">
              Uwagi (alergie, dojazd, preferencje)
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            <fieldset className="event-pay-method">
              <legend>Jak zapłacisz?</legend>
              <p className="empty-hint">
                To tylko informacja dla organizatorów — zapis i tak przejdzie.
              </p>
              <label className="check-row">
                <input
                  type="radio"
                  name="pay-method"
                  checked={willTransfer}
                  onChange={() => setWillTransfer(true)}
                />
                Przelewem
              </label>
              <label className="check-row">
                <input
                  type="radio"
                  name="pay-method"
                  checked={!willTransfer}
                  onChange={() => setWillTransfer(false)}
                />
                Gotówką na miejscu
              </label>
            </fieldset>

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
              disabled={
                busy || guests < 1 || guests > spotsLeft || spotsLeft < 1
              }
            >
              {busy
                ? "Zapisuję…"
                : spotsLeft < 1
                  ? "Brak wolnych miejsc"
                  : "Zapisz na spotkanie"}
            </button>
          </form>
        </section>

        <section className="event-section event-pay" id="platnosc">
          <h2>Szybka płatność</h2>
          <p className="event-transfer-must">
            KONIECZNIE opisz w tytule, na co te pieniądze:{" "}
            <strong>IMPREZA RODZINNA</strong>, liczba dorosłych i dzieci do lat
            7 oraz za kogo.
          </p>
          <p className="event-section__lead">{event.transfer.notes}</p>

          <div className="pay-summary">
            <div>
              <span>Razem osób</span>
              <strong>{guests}</strong>
            </div>
            <div>
              <span>7+ / do 7 / do 3</span>
              <strong>
                {breakdown.adults} / {breakdown.children3to12} /{" "}
                {breakdown.childrenUnder3}
              </strong>
            </div>
            {earlyArrival ? (
              <div>
                <span>Dopłata wcześniej</span>
                <strong>{formatPln(earlyFee)}</strong>
              </div>
            ) : null}
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
          <p className="event-footnote">{event.transfer.amountHint}</p>
        </section>

        <section className="event-section">
          <h2>Lista zapisanych ({rsvps.length})</h2>
          {isAdmin && (
            <p className="event-section__lead">
              Jesteś administratorem — widać sposób płatności i możesz
              oznaczyć, kto już zapłacił.
              {typeof stats.paidCount === "number"
                ? ` Zapłacono: ${stats.paidCount} / ${rsvps.length}${
                    typeof stats.paidTotal === "number"
                      ? ` (${formatPln(stats.paidTotal)})`
                      : ""
                  }.`
                : ""}
            </p>
          )}
          {rsvps.length === 0 ? (
            <p className="empty-hint">Nikt jeszcze się nie zapisał.</p>
          ) : (
            <ul className="rsvp-list">
              {rsvps.map((r) => {
                const covered = (r.coveredPersonIds ?? [])
                  .map((id) => {
                    const p = byId.get(id);
                    return p ? displayName(p, people) : null;
                  })
                  .filter(Boolean);
                return (
                  <li key={r.id}>
                    <div>
                      <strong>{r.fullName}</strong>
                      <span>
                        {r.guests} {r.guests === 1 ? "osoba" : "osób"}
                        {typeof r.amountPln === "number" && r.amountPln > 0
                          ? ` · ${formatPln(r.amountPln)}`
                          : ""}
                        {r.earlyArrival ? " · dzień wcześniej" : ""}
                        {r.source === "admin" ? " · admin" : ""}
                      </span>
                      {isAdmin && (
                        <span>
                          {r.willTransfer ? "przelew" : "gotówka"}
                          {r.paid ? " · zapłacono" : " · niezapłacone"}
                        </span>
                      )}
                      {covered.length > 0 && (
                        <span>Za: {covered.join(", ")}</span>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="rsvp-list__admin">
                        <button
                          type="button"
                          className={`btn ${r.paid ? "btn-secondary" : "btn-primary"}`}
                          disabled={paidBusyId === r.id}
                          onClick={() => markPaid(r.id, !r.paid)}
                        >
                          {paidBusyId === r.id
                            ? "Zapisuję…"
                            : r.paid
                              ? "Cofnij zapłatę"
                              : "Oznacz zapłatę"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={cancelId === r.id}
                          onClick={() => cancelRsvp(r.id)}
                        >
                          {cancelId === r.id ? "Usuwam…" : "Usuń zapis"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
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
