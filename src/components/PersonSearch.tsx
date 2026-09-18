"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Person } from "@/types/family";
import { searchPeople } from "@/lib/search";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { personSearchMeta } from "@/lib/meetingBranches";
import { useIdentity } from "@/components/IdentityProvider";
import { MissingPersonForm } from "@/components/MissingPersonForm";

type Props = {
  people: Person[];
  placeholder?: string;
  onSelect: (person: Person) => void;
  className?: string;
  /** @deprecated identity is collected after unlock */
  requireIdentity?: boolean;
  trailing?: React.ReactNode;
};

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function useFloatingBelow(
  anchor: React.RefObject<HTMLElement | null>,
  active: boolean,
) {
  const [box, setBox] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!active) {
      setBox(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const view = window.visualViewport;
      const ox = view?.offsetLeft ?? 0;
      const oy = view?.offsetTop ?? 0;
      const top = Math.round(r.bottom + 4 - oy);
      const left = Math.round(r.left - ox);
      const viewHeight = view?.height ?? window.innerHeight;
      const maxHeight = Math.max(
        96,
        Math.min(280, Math.round(viewHeight - (r.bottom - oy) - 12)),
      );
      setBox({
        top,
        left,
        width: Math.round(r.width),
        maxHeight,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [active, anchor]);

  return box;
}

export function PersonSearch({
  people,
  placeholder = "Szukaj osoby…",
  onSelect,
  className = "",
  trailing,
}: Props) {
  const { identity, promptIdentity } = useIdentity();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [missingOpen, setMissingOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const narrow = useNarrowScreen();
  const showPanel = open && query.trim().length >= 1;
  const usePortal = narrow && showPanel;
  const floatBox = useFloatingBelow(fieldRef, usePortal);

  const matches = useMemo(
    () =>
      query.trim().length >= 1 ? searchPeople(people, query).slice(0, 14) : [],
    [people, query],
  );

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (wrapRef.current?.contains(node)) return;
      if (resultsRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const closeMissing = useCallback(() => setMissingOpen(false), []);

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

  const results =
    matches.length > 0 ? (
      <ul id={listId} role="listbox" className="person-search__results">
        {matches.map((p, i) => {
          const meta = [
            personSearchMeta(p, people),
            formatPolishDate(p.birthDate),
            formatPolishDate(p.deathDate),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <li
              key={p.id}
              id={`${listId}-opt-${p.id}`}
              role="option"
              aria-selected={i === active}
            >
              <button
                type="button"
                className={`person-search__item${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <span className="person-search__name">
                  {displayName(p, people)}
                </span>
                {meta && (
                  <span className="person-search__meta">{meta}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    ) : (
      <div className="person-search__empty">
        <p>Brak wyników dla „{query}”.</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setMissingOpen(true);
            setOpen(false);
          }}
        >
          Podaj dane — dopasujemy
        </button>
      </div>
    );

  const panel =
    usePortal && floatBox && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={resultsRef}
            className="person-search__float"
            style={{
              top: floatBox.top,
              left: floatBox.left,
              width: floatBox.width,
              maxHeight: floatBox.maxHeight,
            }}
          >
            {results}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className={`person-search ${className}`} ref={wrapRef}>
        <div className="person-search__top">
          <label className="person-search__label" htmlFor={`${listId}-input`}>
            Szukaj
          </label>
          {identity?.name ? (
            <button
              type="button"
              className="person-search__who"
              onClick={promptIdentity}
              title="Zmień, kim jesteś na tym urządzeniu"
            >
              To ty: <strong>{identity.name}</strong>
            </button>
          ) : null}
        </div>
        <div className="person-search__row">
          <div className="person-search__field" ref={fieldRef}>
            <span className="person-search__icon" aria-hidden>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.2-3.2" />
              </svg>
            </span>
            <input
              id={`${listId}-input`}
              type="text"
              inputMode="search"
              enterKeyHint="search"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                open && matches[active]
                  ? `${listId}-opt-${matches[active].id}`
                  : undefined
              }
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
            {showPanel && !usePortal ? results : null}
          </div>
          {trailing}
        </div>
      </div>

      {panel}

      <MissingPersonForm
        open={missingOpen}
        searchedQuery={query}
        reporterName={identity?.name || "Anonim"}
        reporterPersonId={identity?.personId}
        onClose={closeMissing}
        onSubmitted={() => {}}
      />
    </>
  );
}
