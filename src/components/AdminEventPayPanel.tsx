"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { EventPersonField } from "@/components/EventPersonField";
import { GuestTicketSteppers } from "@/components/GuestTicketSteppers";
import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { householdSuggestions } from "@/lib/eventAttending";
import {
  ageGroupFromBirth,
  amountDuePln,
  breakdownFromAgeGroups,
  DEFAULT_PRICE_PER_PERSON_PLN,
  DEFAULT_PRICE_UNDER_7_PLN,
  formatPln,
  totalGuests,
  type GuestBreakdown,
} from "@/lib/eventPricing";

type PayRsvp = {
  id: string;
  fullName: string;
  personId?: string;
  guests: number;
  adults: number;
  children3to12: number;
  childrenUnder3: number;
  ticketLabel: string;
  amountPln: number;
  amountLabel: string;
  willTransfer: boolean;
  paid: boolean;
  coveredPersonIds: string[];
  coveredNames: string[];
  source: "form" | "admin";
};

type PayPayload = {
  event: {
    pricePerPersonPln: number;
    priceUnder7Pln: number;
  };
  stats: {
    rsvpCount: number;
    guestTotal: number;
    amountTotal: number;
    paidCount: number;
    paidTotal: number;
  };
  rsvps: PayRsvp[];
};

type Filter = "unpaid" | "paid" | "all";

const emptyTickets = (): GuestBreakdown => ({
  adults: 0,
  children3to12: 0,
  childrenUnder3: 0,
});

function ticketsFromPeople(ids: string[], people: Person[]): GuestBreakdown {
  return breakdownFromAgeGroups(
    ids.map((id) =>
      ageGroupFromBirth(people.find((p) => p.id === id)?.birthDate),
    ),
  );
}

async function fetchAdminEvent(): Promise<PayPayload> {
  const res = await fetch("/api/admin/event");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd wczytywania płatności");
  return data as PayPayload;
}

function AmountField({
  value,
  suggested,
  onChange,
}: {
  value: number;
  suggested: number;
  onChange: (n: number, touched: boolean) => void;
}) {
  return (
    <label className="field-block">
      Kwota (zł)
      <input
        type="number"
        min={0}
        step={10}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0, true)}
      />
      {value !== suggested ? (
        <span className="empty-hint">
          Z cennika: {formatPln(suggested)}.{" "}
          <button
            type="button"
            className="btn-text"
            onClick={() => onChange(suggested, false)}
          >
            Przywróć
          </button>
        </span>
      ) : (
        <span className="empty-hint">Możesz wpisać inną kwotę przy dopłacie.</span>
      )}
    </label>
  );
}

function PayCardEditor({
  rsvp,
  pricePerPersonPln,
  priceUnder7Pln,
  busy,
  onCancel,
  onSave,
}: {
  rsvp: PayRsvp;
  pricePerPersonPln: number;
  priceUnder7Pln: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (body: {
    adults: number;
    children3to12: number;
    childrenUnder3: number;
    amountPln: number;
  }) => void;
}) {
  const [tickets, setTickets] = useState<GuestBreakdown>({
    adults: rsvp.adults,
    children3to12: rsvp.children3to12,
    childrenUnder3: rsvp.childrenUnder3,
  });
  const [amount, setAmount] = useState(rsvp.amountPln);
  const [amountTouched, setAmountTouched] = useState(false);
  const suggested = amountDuePln(
    tickets,
    pricePerPersonPln,
    null,
    priceUnder7Pln,
  );

  const changeTickets = (next: GuestBreakdown) => {
    setTickets(next);
    if (!amountTouched) setAmount(amountDuePln(next, pricePerPersonPln, null, priceUnder7Pln));
  };

  return (
    <div className="admin-pay__edit">
      <GuestTicketSteppers
        value={tickets}
        onChange={changeTickets}
        pricePerPersonPln={pricePerPersonPln}
        priceUnder7Pln={priceUnder7Pln}
      />
      <AmountField
        value={amount}
        suggested={suggested}
        onChange={(n, touched) => {
          setAmount(n);
          setAmountTouched(touched);
        }}
      />
      <div className="admin-card__actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || totalGuests(tickets) < 1}
          onClick={() =>
            onSave({
              adults: tickets.adults,
              children3to12: tickets.children3to12,
              childrenUnder3: tickets.childrenUnder3,
              amountPln: amount,
            })
          }
        >
          {busy ? "Zapisuję…" : "Zapisz bilety i kwotę"}
        </button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Anuluj
        </button>
      </div>
    </div>
  );
}

export function AdminEventPayPanel({
  people,
  onError,
  onSuccess,
}: {
  people: Person[];
  onError: (message: string | null) => void;
  onSuccess: (message: string | null) => void;
}) {
  const qc = useQueryClient();
  const eventQ = useQuery({
    queryKey: ["admin-event"],
    queryFn: fetchAdminEvent,
  });
  const [filter, setFilter] = useState<Filter>("unpaid");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [coveredIds, setCoveredIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<GuestBreakdown>(emptyTickets);
  const [amountPln, setAmountPln] = useState(0);
  const [amountTouched, setAmountTouched] = useState(false);
  const [willTransfer, setWillTransfer] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pricePerPersonPln =
    eventQ.data?.event.pricePerPersonPln ?? DEFAULT_PRICE_PER_PERSON_PLN;
  const priceUnder7Pln =
    eventQ.data?.event.priceUnder7Pln ?? DEFAULT_PRICE_UNDER_7_PLN;
  const suggestedAmount = amountDuePln(
    tickets,
    pricePerPersonPln,
    null,
    priceUnder7Pln,
  );

  const payer = people.find((p) => p.id === payerId) ?? null;
  const household = payer ? householdSuggestions(payer.id, people) : [];
  const householdIds = new Set(household.map((p) => p.id));
  const extraCovered = coveredIds.flatMap((id) => {
    const person = people.find((p) => p.id === id);
    if (!person || person.id === payer?.id || householdIds.has(person.id)) {
      return [];
    }
    return [person];
  });
  const coveredExclude = useMemo(() => new Set(coveredIds), [coveredIds]);

  const visible = useMemo(() => {
    const rows = eventQ.data?.rsvps ?? [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "paid" && !r.paid) return false;
      if (filter === "unpaid" && r.paid) return false;
      if (!q) return true;
      const hay = [r.fullName, ...r.coveredNames].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [eventQ.data?.rsvps, filter, query]);

  const stats = eventQ.data?.stats;

  const applyCovered = (ids: string[], resetAmount = false) => {
    const next = ticketsFromPeople(ids, people);
    setCoveredIds(ids);
    setTickets(next);
    if (resetAmount || !amountTouched) {
      setAmountPln(amountDuePln(next, pricePerPersonPln, null, priceUnder7Pln));
      if (resetAmount) setAmountTouched(false);
    }
  };

  const changeTickets = (next: GuestBreakdown) => {
    setTickets(next);
    if (!amountTouched) {
      setAmountPln(amountDuePln(next, pricePerPersonPln, null, priceUnder7Pln));
    }
  };

  const post = async (body: unknown) => {
    const res = await fetch("/api/admin/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Błąd zapisu");
    qc.setQueryData(["admin-event"], data);
    await qc.invalidateQueries({ queryKey: ["event"] });
    await qc.invalidateQueries({ queryKey: ["family"] });
  };

  const togglePaid = async (rsvp: PayRsvp) => {
    setBusyId(rsvp.id);
    onError(null);
    try {
      await post({ action: "paid", rsvpId: rsvp.id, paid: !rsvp.paid });
      onSuccess(
        rsvp.paid
          ? `Cofnięto zapłatę: ${rsvp.fullName}.`
          : `Oznaczono zapłatę: ${rsvp.fullName} za ${rsvp.coveredNames.join(", ") || "siebie"}.`,
      );
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async (
    rsvp: PayRsvp,
    body: {
      adults: number;
      children3to12: number;
      childrenUnder3: number;
      amountPln: number;
    },
  ) => {
    setBusyId(rsvp.id);
    onError(null);
    try {
      await post({ action: "update", rsvpId: rsvp.id, ...body });
      setEditingId(null);
      onSuccess(`Zaktualizowano bilety i kwotę: ${rsvp.fullName}.`);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const pickPayer = (person: Person) => {
    setPayerId(person.id);
    applyCovered([person.id], true);
  };

  const toggleCovered = (id: string) => {
    const next = coveredIds.includes(id)
      ? coveredIds.filter((x) => x !== id)
      : [...coveredIds, id];
    applyCovered(next);
  };

  const addPayment = async (paid: boolean) => {
    if (!payer) return;
    setCreating(true);
    onError(null);
    try {
      await post({
        action: "create",
        personId: payer.id,
        coveredPersonIds: coveredIds.length ? coveredIds : [payer.id],
        willTransfer,
        paid,
        adults: tickets.adults,
        children3to12: tickets.children3to12,
        childrenUnder3: tickets.childrenUnder3,
        amountPln,
      });
      onSuccess(
        paid
          ? `Dodano wpłatę: ${displayName(payer, people)}.`
          : `Dodano zapis do zapłaty: ${displayName(payer, people)}.`,
      );
      setPayerId(null);
      setCoveredIds([]);
      setTickets(emptyTickets());
      setAmountPln(0);
      setAmountTouched(false);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  if (eventQ.isLoading) {
    return <p className="empty-hint">Wczytuję zapisy na spotkanie…</p>;
  }
  if (eventQ.isError) {
    return (
      <p className="banner-error" role="alert">
        {(eventQ.error as Error).message}
      </p>
    );
  }

  return (
    <div className="admin-workspace admin-pay">
      <section className="admin-card-box admin-pay__add">
        <h2>Dodaj kto zapłacił</h2>
        <p className="empty-hint">
          Wybierz płatnika, a potem dowolne osoby z drzewa — nie tylko najbliższą
          rodzinę. Bilety są zbiorcze: dorośli i dzieci nie muszą iść 1:1 z listą.
        </p>
        <EventPersonField
          people={people}
          label="Kto płaci"
          placeholder="Nazwisko albo imię"
          excludeIds={new Set()}
          onPick={pickPayer}
        />
        {payer && (
          <div className="admin-pay__draft">
            <p>
              Płatnik: <strong>{displayName(payer, people)}</strong>
            </p>
            <fieldset className="admin-pay__cover">
              <legend>Za kogo</legend>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={coveredIds.includes(payer.id)}
                  onChange={() => toggleCovered(payer.id)}
                />
                {displayName(payer, people)} (płatnik)
              </label>
              {household.map((p) => {
                const dates = formatPolishDate(p.birthDate);
                return (
                  <label key={p.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={coveredIds.includes(p.id)}
                      onChange={() => toggleCovered(p.id)}
                    />
                    {displayName(p, people)}
                    {dates ? ` · ur. ${dates}` : ""}
                  </label>
                );
              })}
              {extraCovered.map((p) => {
                const dates = formatPolishDate(p.birthDate);
                return (
                  <label key={p.id} className="check-row">
                    <input
                      type="checkbox"
                      checked={coveredIds.includes(p.id)}
                      onChange={() => toggleCovered(p.id)}
                    />
                    {displayName(p, people)}
                    {dates ? ` · ur. ${dates}` : ""}
                  </label>
                );
              })}
              <EventPersonField
                people={people}
                label="Dodaj kolejną osobę z drzewa"
                placeholder="Szukaj kolejnej osoby…"
                excludeIds={coveredExclude}
                onPick={(person) => applyCovered([...coveredIds, person.id])}
              />
            </fieldset>
            <fieldset className="admin-pay__tickets">
              <legend>Bilety</legend>
              <GuestTicketSteppers
                value={tickets}
                onChange={changeTickets}
                pricePerPersonPln={pricePerPersonPln}
                priceUnder7Pln={priceUnder7Pln}
              />
              <AmountField
                value={amountPln}
                suggested={suggestedAmount}
                onChange={(n, touched) => {
                  setAmountPln(n);
                  setAmountTouched(touched);
                }}
              />
            </fieldset>
            <fieldset className="event-pay-method">
              <legend>Sposób</legend>
              <label className="check-row">
                <input
                  type="radio"
                  name="admin-pay-method"
                  checked={willTransfer}
                  onChange={() => setWillTransfer(true)}
                />
                Przelew
              </label>
              <label className="check-row">
                <input
                  type="radio"
                  name="admin-pay-method"
                  checked={!willTransfer}
                  onChange={() => setWillTransfer(false)}
                />
                Gotówka
              </label>
            </fieldset>
            <div className="admin-card__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  creating ||
                  coveredIds.length === 0 ||
                  totalGuests(tickets) < 1
                }
                onClick={() => void addPayment(true)}
              >
                {creating ? "Zapisuję…" : "Dodaj jako zapłacone"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={
                  creating ||
                  coveredIds.length === 0 ||
                  totalGuests(tickets) < 1
                }
                onClick={() => void addPayment(false)}
              >
                Dodaj do zapłaty
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-card-box admin-pay__list">
        <h2>Wpłaty na spotkanie</h2>
        {stats && (
          <p className="empty-hint">
            Zapłacono {stats.paidCount} / {stats.rsvpCount} zgłoszeń
            {stats.paidTotal
              ? ` · ${new Intl.NumberFormat("pl-PL", {
                  style: "currency",
                  currency: "PLN",
                  maximumFractionDigits: 0,
                }).format(stats.paidTotal)}`
              : ""}
            .
          </p>
        )}
        <label className="field-block">
          Szukaj na liście
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kto zapłacił albo za kogo"
          />
        </label>
        <div className="admin-filters" role="group" aria-label="Filtr wpłat">
          {(
            [
              ["unpaid", "Do zapłaty"],
              ["paid", "Zapłacone"],
              ["all", "Wszystkie"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <p className="empty-hint">Brak zgłoszeń w tym filtrze.</p>
        ) : (
          <ul className="admin-pay-cards">
            {visible.map((r) => (
              <li key={r.id} className={r.paid ? "is-paid" : undefined}>
                <div>
                  <strong>{r.fullName}</strong>
                  <p>
                    Za:{" "}
                    {r.coveredNames.length
                      ? r.coveredNames.join(", ")
                      : r.fullName}
                  </p>
                  <p>
                    {r.amountLabel} · {r.ticketLabel} ·{" "}
                    {r.willTransfer ? "przelew" : "gotówka"}
                    {r.source === "admin" ? " · wpis admina" : ""}
                  </p>
                  {editingId === r.id ? (
                    <PayCardEditor
                      rsvp={r}
                      pricePerPersonPln={pricePerPersonPln}
                      priceUnder7Pln={priceUnder7Pln}
                      busy={busyId === r.id}
                      onCancel={() => setEditingId(null)}
                      onSave={(body) => void saveEdit(r, body)}
                    />
                  ) : null}
                </div>
                <div className="admin-pay-cards__actions">
                  {editingId === r.id ? null : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEditingId(r.id)}
                    >
                      Edytuj bilety
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn ${r.paid ? "btn-secondary" : "btn-primary"}`}
                    disabled={busyId === r.id}
                    onClick={() => void togglePaid(r)}
                  >
                    {busyId === r.id
                      ? "Zapisuję…"
                      : r.paid
                        ? "Cofnij zapłatę"
                        : "Zapłacono"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
