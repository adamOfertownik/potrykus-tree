"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { householdSuggestions } from "@/lib/eventAttending";
import { searchPeople } from "@/lib/search";

type PayRsvp = {
  id: string;
  fullName: string;
  personId?: string;
  guests: number;
  amountPln: number;
  amountLabel: string;
  willTransfer: boolean;
  paid: boolean;
  coveredPersonIds: string[];
  coveredNames: string[];
  source: "form" | "admin";
};

type PayPayload = {
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

async function fetchAdminEvent(): Promise<PayPayload> {
  const res = await fetch("/api/admin/event");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd wczytywania płatności");
  return data as PayPayload;
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
  const [willTransfer, setWillTransfer] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const payer = people.find((p) => p.id === payerId) ?? null;
  const household = payer ? householdSuggestions(payer.id, people) : [];
  const addMatches = addQuery.trim()
    ? searchPeople(people, addQuery).slice(0, 8)
    : [];

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

  const pickPayer = (person: Person) => {
    setPayerId(person.id);
    setCoveredIds([person.id]);
    setAddQuery("");
  };

  const toggleCovered = (id: string) => {
    setCoveredIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
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
      });
      onSuccess(
        paid
          ? `Dodano wpłatę: ${displayName(payer)}.`
          : `Dodano zapis do zapłaty: ${displayName(payer)}.`,
      );
      setPayerId(null);
      setCoveredIds([]);
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
    <div className="admin-pay">
      <section className="admin-pay__add">
        <h2>Dodaj kto zapłacił</h2>
        <p className="empty-hint">
          Wybierz płatnika i osoby, za które wpłata. Potem od razu oznacz
          zapłatę.
        </p>
        <label className="field-block">
          Szukaj osoby
          <input
            value={addQuery}
            onChange={(e) => setAddQuery(e.target.value)}
            placeholder="Nazwisko albo imię"
          />
        </label>
        {addMatches.length > 0 && (
          <ul className="who-matches">
            {addMatches.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => pickPayer(p)}>
                  {displayName(p)}
                </button>
              </li>
            ))}
          </ul>
        )}
        {payer && (
          <div className="admin-pay__draft">
            <p>
              Płatnik: <strong>{displayName(payer)}</strong>
            </p>
            <fieldset className="admin-pay__cover">
              <legend>Za kogo</legend>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={coveredIds.includes(payer.id)}
                  onChange={() => toggleCovered(payer.id)}
                />
                {displayName(payer)} (płatnik)
              </label>
              {household.map((p) => (
                <label key={p.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={coveredIds.includes(p.id)}
                    onChange={() => toggleCovered(p.id)}
                  />
                  {displayName(p)}
                </label>
              ))}
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
                disabled={creating || coveredIds.length === 0}
                onClick={() => void addPayment(true)}
              >
                {creating ? "Zapisuję…" : "Dodaj jako zapłacone"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={creating || coveredIds.length === 0}
                onClick={() => void addPayment(false)}
              >
                Dodaj do zapłaty
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="admin-pay__list">
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
        <div className="admin-pay__filters" role="tablist" aria-label="Filtr wpłat">
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
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? "is-active" : undefined}
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
                    {r.amountLabel} · {r.guests}{" "}
                    {r.guests === 1 ? "osoba" : "osób"} ·{" "}
                    {r.willTransfer ? "przelew" : "gotówka"}
                    {r.source === "admin" ? " · wpis admina" : ""}
                  </p>
                </div>
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
