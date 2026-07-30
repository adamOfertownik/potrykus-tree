"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName, formatPolishDate } from "@/lib/db-client";

type Props = {
  people: Person[];
  placeholder?: string;
  onSelect: (person: Person) => void;
  className?: string;
};

export function PersonSearch({
  people,
  placeholder = "Szukaj osoby…",
  onSelect,
  className = "",
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const matches = useMemo(
    () => (query.trim().length >= 1 ? searchPeople(people, query).slice(0, 14) : []),
    [people, query],
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (person: Person) => {
    onSelect(person);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open && matches.length) setOpen(true);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(matches.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className={`person-search ${className}`} ref={wrapRef}>
      <label className="person-search__label" htmlFor={`${listId}-input`}>
        Szukaj
      </label>
      <div className="person-search__field">
        <span className="person-search__icon" aria-hidden>
          ⌕
        </span>
        <input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="person-search__input"
        />
        {query && (
          <button
            type="button"
            className="person-search__clear"
            aria-label="Wyczyść"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && matches.length > 0 && (
        <ul id={listId} role="listbox" className="person-search__results">
          {matches.map((p, i) => {
            const dates = [
              formatPolishDate(p.birthDate),
              formatPolishDate(p.deathDate),
            ]
              .filter(Boolean)
              .join(" – ");
            return (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`person-search__item${i === active ? " is-active" : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p)}
                >
                  <span className="person-search__name">{displayName(p)}</span>
                  {dates && (
                    <span className="person-search__meta">{dates}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && query.trim() && matches.length === 0 && (
        <div className="person-search__empty">Brak wyników dla „{query}”</div>
      )}
    </div>
  );
}
