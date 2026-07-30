"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";
import { loadReporter, saveReporter } from "@/lib/reporter";

type Props = {
  people: Person[];
  open: boolean;
  onClose: () => void;
  onIdentified: (name: string, personId?: string) => void;
};

export function WhoAreYouDialog({
  people,
  open,
  onClose,
  onIdentified,
}: Props) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");

  const matches = useMemo(
    () => (query.trim() ? searchPeople(people, query).slice(0, 8) : []),
    [people, query],
  );

  useEffect(() => {
    if (!open) return;
    const existing = loadReporter();
    if (existing?.name) {
      setManual(existing.name);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card">
        <header className="modal-card__head">
          <h2>Kim jesteś?</h2>
          <p>
            Zanim wyszukasz — powiedz nam, kto korzysta z drzewa. Dzięki temu
            wiemy, kto proponuje zmiany.
          </p>
        </header>

        <label className="field-label" htmlFor="who-search">
          Znajdź siebie w drzewie
        </label>
        <input
          id="who-search"
          className="field-input"
          placeholder="Np. Adam Lieske…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {matches.length > 0 && (
          <ul className="who-matches">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    const name = displayName(p);
                    saveReporter({ name, personId: p.id });
                    onIdentified(name, p.id);
                  }}
                >
                  {displayName(p)}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="field-divider">albo wpisz imię i nazwisko</div>

        <input
          className="field-input"
          placeholder="Imię i nazwisko"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Później
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!manual.trim()}
            onClick={() => {
              const name = manual.trim();
              saveReporter({ name });
              onIdentified(name);
            }}
          >
            To ja
          </button>
        </div>
      </div>
    </div>
  );
}
