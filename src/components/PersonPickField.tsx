"use client";

import { useId, useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";

type Props = {
  people: Person[];
  excludeId?: string;
  label?: string;
  placeholder?: string;
  selected: Person | null;
  onSelect: (person: Person | null) => void;
};

/** Search box that keeps its own query so parent re-renders cannot steal keystrokes. */
export function PersonPickField({
  people,
  excludeId,
  label = "Szukaj osoby",
  placeholder = "Imię lub nazwisko…",
  selected,
  onSelect,
}: Props) {
  const inputId = useId();
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    if (selected || query.trim().length < 1) return [];
    return searchPeople(people, query)
      .filter((p) => p.id !== excludeId)
      .slice(0, 10);
  }, [people, query, excludeId, selected]);

  return (
    <div className="graph-edit__pick">
      {selected ? (
        <p className="graph-edit__chosen" role="status">
          Wybrano: <strong>{displayName(selected)}</strong>
          <button
            type="button"
            className="btn btn-secondary btn-mini"
            onClick={() => {
              onSelect(null);
              setQuery("");
            }}
          >
            Zmień
          </button>
        </p>
      ) : (
        <label className="field-block" htmlFor={inputId}>
          {label}
          <input
            id={inputId}
            type="text"
            name="person-pick"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            placeholder={placeholder}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      )}
      {!selected && matches.length > 0 && (
        <ul className="who-matches">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(p)}
              >
                {displayName(p)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!selected && query.trim() && matches.length === 0 && (
        <p className="empty-hint">Brak wyników — spróbuj „Nowa osoba”.</p>
      )}
    </div>
  );
}
