"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { personPickerSubline } from "@/lib/personPickerMeta";
import { searchPeople } from "@/lib/search";

function sameNameCount(person: Person, people: Person[]): number {
  const target = displayName(person, people).trim().toLowerCase();
  return people.filter(
    (p) => displayName(p, people).trim().toLowerCase() === target,
  ).length;
}

export function EventPersonField({
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
  const [pending, setPending] = useState<Person | null>(null);
  const matches = useMemo(() => {
    if (!query.trim()) return [];
    return searchPeople(people, query)
      .filter((p) => !excludeIds.has(p.id))
      .slice(0, 8);
  }, [people, query, excludeIds]);

  const confirmPick = (person: Person) => {
    onPick(person);
    setPending(null);
    setQuery("");
  };

  const requestPick = (person: Person) => {
    if (sameNameCount(person, people) > 1) {
      setPending(person);
      return;
    }
    confirmPick(person);
  };

  if (pending) {
    const subline = personPickerSubline(pending, people);
    return (
      <div className="field-block event-person-field">
        <p className="field-label">Potwierdź wybór</p>
        <div className="who-confirm">
          <p className="who-confirm__name">{displayName(pending, people)}</p>
          {subline ? <p className="who-confirm__meta">{subline}</p> : null}
          <p className="empty-hint">
            To samo imię i nazwisko ma kilka osób w drzewie — upewnij się, że
            wybierasz właściwą (np. po linii „od Heleny” albo dacie urodzenia).
          </p>
        </div>
        <div className="modal-actions modal-actions--stack">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => confirmPick(pending)}
          >
            Tak, ta osoba
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setPending(null)}
          >
            To ktoś inny
          </button>
        </div>
      </div>
    );
  }

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
            const subline = personPickerSubline(p, people);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => requestPick(p)}>
                  <span className="who-matches__text">
                    <span>{displayName(p, people)}</span>
                    {subline ? (
                      <span className="who-matches__dates">{subline}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
