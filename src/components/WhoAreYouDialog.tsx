"use client";

import { useEffect, useMemo, useState } from "react";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { personPickerSubline } from "@/lib/personPickerMeta";
import { loadReporter, saveReporter } from "@/lib/reporter";
import { Modal } from "@/components/Modal";

type Props = {
  people: Person[];
  open: boolean;
  onClose: () => void;
  onIdentified: (name: string, personId?: string) => void;
  compulsory?: boolean;
};

function personDates(person: Person): string {
  const birth = formatPolishDate(person.birthDate);
  const death = formatPolishDate(person.deathDate);
  if (birth && death) return `ur. ${birth} · zm. ${death}`;
  if (birth) return `ur. ${birth}`;
  if (death) return `zm. ${death}`;
  return "";
}

export function WhoAreYouDialog({
  people,
  open,
  onClose,
  onIdentified,
  compulsory = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState("");
  const [pending, setPending] = useState<Person | null>(null);

  const matches = useMemo(
    () => (query.trim() ? searchPeople(people, query).slice(0, 8) : []),
    [people, query],
  );

  useEffect(() => {
    if (!open) {
      setPending(null);
      return;
    }
    const existing = loadReporter();
    if (existing?.name) setManual(existing.name);
  }, [open]);

  const pickPerson = (p: Person) => {
    const name = displayName(p, people);
    saveReporter({ name, personId: p.id });
    onIdentified(name, p.id);
  };

  const confirmManual = () => {
    const name = manual.trim();
    if (!name) return;
    const hit =
      searchPeople(people, name).find(
        (p) => displayName(p, people).toLowerCase() === name.toLowerCase(),
      ) ||
      searchPeople(people, name).find(
        (p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase() === name.toLowerCase(),
      );
    if (hit) {
      setPending(hit);
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
      className="modal-backdrop--who"
      cardClassName="modal-card--who"
    >
      {pending ? (
        <>
          <header className="modal-card__head">
            <h2 id="who-are-you-title">Czy to na pewno Ty?</h2>
            <p>
              To samo nazwisko może mieć kilka osób — potwierdź, zanim
              zapamiętamy Cię na tym telefonie.
            </p>
          </header>
          <div className="who-confirm">
            <p className="who-confirm__name">{displayName(pending, people)}</p>
            {personPickerSubline(pending, people) ? (
              <p className="who-confirm__meta">
                {personPickerSubline(pending, people)}
              </p>
            ) : personDates(pending) ? (
              <p className="who-confirm__meta">{personDates(pending)}</p>
            ) : null}
          </div>
          <div className="modal-actions modal-actions--stack">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => pickPerson(pending)}
            >
              Tak, to ja
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPending(null)}
            >
              To ktoś inny
            </button>
          </div>
        </>
      ) : (
        <>
          <header className="modal-card__head">
            <h2 id="who-are-you-title">Kim jesteś w rodzinie?</h2>
            <p>Wpisz siebie i potwierdź — w drzewie bywają te same nazwiska.</p>
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
            autoComplete="off"
          />

          {matches.length > 0 && (
            <ul className="who-matches">
              {matches.map((p) => {
                const subline = personPickerSubline(p, people);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="who-matches__pick"
                      onClick={(e) => {
                        e.preventDefault();
                        setPending(p);
                      }}
                    >
                      <span className="who-matches__text">
                        <span>{displayName(p, people)}</span>
                        {subline ? (
                          <span className="who-matches__dates">{subline}</span>
                        ) : null}
                      </span>
                      <span className="who-matches__go">Wybierz</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="field-divider">albo wpisz imię i nazwisko</div>

          <label className="field-label" htmlFor="who-manual">
            Twoje imię i nazwisko
          </label>
          <input
            id="who-manual"
            className="field-input"
            placeholder="Imię i nazwisko"
            autoComplete="name"
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
              Zapamiętaj
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
