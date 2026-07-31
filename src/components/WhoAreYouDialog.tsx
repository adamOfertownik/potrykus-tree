"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName } from "@/lib/db-client";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { Modal } from "@/components/Modal";

type Props = {
  people: Person[];
  open: boolean;
  onClose: () => void;
  onIdentified: (name: string, personId?: string) => void;
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      compulsory={compulsory}
      labelledBy="who-are-you-title"
    >
      <header className="modal-card__head">
        <h2 id="who-are-you-title">Kim jesteś w rodzinie?</h2>
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
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Anuluj
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!manual.trim()}
          onClick={confirmManual}
        >
          To ja — zapamiętaj
        </button>
      </div>
    </Modal>
  );
}
