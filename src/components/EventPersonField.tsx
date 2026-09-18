"use client";

import { useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { searchPeople } from "@/lib/search";

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
