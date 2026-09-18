"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { personPickerSubline } from "@/lib/personPickerMeta";
import { searchPeople } from "@/lib/search";
import { wouldCreateCycle } from "@/lib/familyMutations";
import { findRelationConflicts } from "@/lib/relationConflicts";

type Props = {
  person: Person;
  people: Person[];
  parentIds: string[];
  spouseIds: string[];
  childIds: string[];
  onParentIds: (ids: string[]) => void;
  onSpouseIds: (ids: string[]) => void;
  onChildIds: (ids: string[]) => void;
  onOpenPerson: (id: string) => void;
};

export function AdminRelEditor({
  person,
  people,
  parentIds,
  spouseIds,
  childIds,
  onParentIds,
  onSpouseIds,
  onChildIds,
  onOpenPerson,
}: Props) {
  const conflicts = useMemo(
    () =>
      findRelationConflicts(people, person.id, parentIds, spouseIds, childIds),
    [people, person.id, parentIds, spouseIds, childIds],
  );
  const conflictIds = useMemo(
    () => new Set(conflicts.map((c) => c.personId)),
    [conflicts],
  );

  return (
    <section className="admin-rels" aria-labelledby="admin-rels-title">
      <h3 id="admin-rels-title">Powiązania na drzewie</h3>
      <p className="empty-hint">
        Znacznik ×2 / ×3 na karcie znaczy, że ta sama osoba jest rysowana
        kilka razy — zwykle zostają stare, złe powiązania. Tu możesz je
        odpiąć albo podmienić. Zapisz na dole formularza.
      </p>
      {conflicts.length > 0 && (
        <ul className="admin-rels__warns">
          {conflicts.map((c) => (
            <li key={`${c.personId}:${c.message}`}>{c.message}</li>
          ))}
        </ul>
      )}
      <RelGroup
        label="Rodzice"
        ids={parentIds}
        people={people}
        selfId={person.id}
        max={4}
        conflictIds={conflictIds}
        onChange={onParentIds}
        onOpenPerson={onOpenPerson}
        cycleError={(id) =>
          wouldCreateCycle(people, person.id, id)
            ? "Ten rodzic jest już potomkiem tej osoby — pętla w drzewie."
            : null
        }
      />
      <RelGroup
        label="Małżonkowie / partnerzy"
        ids={spouseIds}
        people={people}
        selfId={person.id}
        max={8}
        conflictIds={conflictIds}
        onChange={onSpouseIds}
        onOpenPerson={onOpenPerson}
      />
      <RelGroup
        label="Dzieci"
        ids={childIds}
        people={people}
        selfId={person.id}
        max={40}
        conflictIds={conflictIds}
        onChange={onChildIds}
        onOpenPerson={onOpenPerson}
        cycleError={(id) =>
          wouldCreateCycle(people, id, person.id)
            ? "To dziecko jest już przodkiem tej osoby — pętla w drzewie."
            : null
        }
      />
    </section>
  );
}

function RelGroup({
  label,
  ids,
  people,
  selfId,
  max,
  conflictIds,
  onChange,
  onOpenPerson,
  cycleError,
}: {
  label: string;
  ids: string[];
  people: Person[];
  selfId: string;
  max: number;
  conflictIds: Set<string>;
  onChange: (ids: string[]) => void;
  onOpenPerson: (id: string) => void;
  cycleError?: (candidateId: string) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(
    () => ids.map((id) => people.find((p) => p.id === id)).filter(Boolean) as Person[],
    [ids, people],
  );
  const matches = useMemo(() => {
    if (query.trim().length < 1) return [];
    const taken = new Set([...ids, selfId]);
    return searchPeople(people, query)
      .filter((p) => !taken.has(p.id))
      .slice(0, 8);
  }, [people, query, ids, selfId]);

  const add = (id: string) => {
    const cycle = cycleError?.(id);
    if (cycle) {
      setError(cycle);
      return;
    }
    if (ids.length >= max) {
      setError(`Można dodać najwyżej ${max}.`);
      return;
    }
    setError(null);
    setQuery("");
    onChange([...ids, id]);
  };

  return (
    <fieldset className="admin-rel-group">
      <legend>{label}</legend>
      {selected.length === 0 ? (
        <p className="empty-hint">Brak — dodaj z wyszukiwarki.</p>
      ) : (
        <ul className="admin-rel-chips">
          {selected.map((p) => (
            <li
              key={p.id}
              className={`admin-rel-chip${conflictIds.has(p.id) ? " is-conflict" : ""}`}
            >
              <button
                type="button"
                className="admin-rel-chip__name"
                onClick={() => onOpenPerson(p.id)}
              >
                {displayName(p)}
                {p.birthDate ? (
                  <span> · {formatPolishDate(p.birthDate)}</span>
                ) : null}
              </button>
              <button
                type="button"
                aria-label={`Odepnij: ${displayName(p)}`}
                onClick={() => {
                  setError(null);
                  onChange(ids.filter((id) => id !== p.id));
                }}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <label className="admin-rel-add">
        Dodaj
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setError(null);
          }}
          placeholder="Imię albo nazwisko"
          disabled={ids.length >= max}
        />
      </label>
      {query.trim() && matches.length > 0 && (
        <ul className="who-matches admin-rel-matches">
          {matches.map((p) => {
            const subline = personPickerSubline(p, people);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => add(p.id)}>
                  <span className="who-matches__text">
                    <span>{displayName(p, people)}</span>
                    {subline ? (
                      <span className="who-matches__dates">{subline}</span>
                    ) : null}
                  </span>
                  <span className="who-matches__go">Dodaj</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {query.trim() && matches.length === 0 && (
        <p className="empty-hint">Brak osób do dodania.</p>
      )}
      {error && (
        <p className="banner-error" role="status">
          {error}
        </p>
      )}
    </fieldset>
  );
}
