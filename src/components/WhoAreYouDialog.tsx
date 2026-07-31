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
  /** When true, no “Później” — need identity after unlock */
  compulsory?: boolean;
};

export function WhoAreYouDialog({
  people,
  open,
  onClose,
  onIdentified,
  compulsory = false,
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
    if (existing?.name) setManual(existing.name);
  }, [open]);

  const pickPerson = (p: Person) => {
    const name = displayName(p);
    saveReporter({ name, personId: p.id });
    onIdentified(name, p.id);
  };

  const confirmManual = () => {
    const name = manual.trim();
    if (!name) return;
    // Try to link to a person in the tree when name matches
    const hit =
      searchPeople(people, name).find(
        (p) => displayName(p).toLowerCase() === name.toLowerCase(),
      ) ||
      searchPeople(people, name).find(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase() === name.toLowerCase(),
      );
    if (hit) {
      pickPerson(hit);
      return;
    }
    saveReporter({ name });
    onIdentified(name);
  };

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        // Don't let clicks fall through to the chart underneath
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        className="modal-card"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-card__head">
          <h2>Kim jesteś w rodzinie?</h2>
          <p>
            Wybierz siebie z listy — otworzymy Twoje miejsce w drzewie i
            zapamiętamy Cię na tym telefonie.
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
          autoFocus
        />

        {matches.length > 0 && (
          <ul className="who-matches">
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="who-matches__pick"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pickPerson(p);
                  }}
                >
                  <span>{displayName(p)}</span>
                  <span className="who-matches__go">To ja →</span>
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmManual();
            }
          }}
        />

        <div className="modal-actions">
          {!compulsory && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={(e) => {
                e.preventDefault();
                onClose();
              }}
            >
              Anuluj
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!manual.trim()}
            onClick={(e) => {
              e.preventDefault();
              confirmManual();
            }}
          >
            To ja — zapamiętaj
          </button>
        </div>
      </div>
    </div>
  );
}
