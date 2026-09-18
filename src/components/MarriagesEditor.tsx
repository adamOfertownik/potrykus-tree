"use client";

import { useState } from "react";
import { DateField } from "@/components/DateField";
import { displayName } from "@/lib/db-client";
import type { Marriage, Person } from "@/types/family";
import { hydrateMarriages, mergeMarriagesWithSpouseIds } from "@/lib/marriages";
import { searchPeople } from "@/lib/search";

type Props = {
  person: Person;
  people: Person[];
  marriages: Marriage[];
  onChange: (next: Marriage[]) => void;
};

export function MarriagesEditor({ person, people, marriages, onChange }: Props) {
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [queryByRow, setQueryByRow] = useState<Record<number, string>>({});

  const rows =
    marriages.length > 0
      ? marriages
      : person.spouseIds.length
        ? mergeMarriagesWithSpouseIds(
            hydrateMarriages(person),
            person.spouseIds,
            person.weddingDate,
          )
        : [];

  const setRow = (index: number, next: Marriage) => {
    const copy = [...rows];
    copy[index] = next;
    onChange(copy);
  };

  const addWedding = (afterIndex?: number) => {
    const next = [...rows];
    const insertAt = afterIndex == null ? next.length : afterIndex + 1;
    next.splice(insertAt, 0, { spouseId: "" });
    onChange(next);
    setMenuFor(null);
  };

  const markDivorced = (index: number) => {
    const row = rows[index];
    if (!row?.spouseId) return;
    setRow(index, { ...row, divorced: true });
    setMenuFor(null);
  };

  const used = new Set(
    rows.map((m) => m.spouseId).filter((id) => id && id !== person.id),
  );

  return (
    <div className="marriages-editor">
      <div className="marriages-editor__head">
        <h3>Śluby</h3>
        {rows.length === 0 ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => addWedding()}
          >
            + dodaj
          </button>
        ) : null}
      </div>
      <p className="empty-hint">
        Data ślubu należy do konkretnego małżeństwa. Przy dwóch ślubach
        oznacz pierwszy jako rozwód przyciskiem „+ dodaj” — bez osobnej daty
        rozwodu.
      </p>
      {rows.map((row, index) => {
        const spouse = people.find((p) => p.id === row.spouseId);
        const q = queryByRow[index] ?? "";
        const matches =
          q.trim().length >= 1
            ? searchPeople(people, q)
                .filter((p) => p.id !== person.id && !used.has(p.id))
                .slice(0, 6)
            : [];
        return (
          <div
            key={`${row.spouseId || "new"}-${index}`}
            className="marriage-row"
          >
            <label>
              Z kim ślub
              {spouse ? (
                <span className="marriage-row__spouse">
                  {displayName(spouse, people)}
                </span>
              ) : (
                <>
                  <input
                    value={q}
                    onChange={(e) =>
                      setQueryByRow((s) => ({ ...s, [index]: e.target.value }))
                    }
                    placeholder="Szukaj małżonka"
                  />
                  {matches.length > 0 ? (
                    <ul className="admin-list-box">
                      {matches.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setRow(index, { ...row, spouseId: p.id });
                              setQueryByRow((s) => ({ ...s, [index]: "" }));
                            }}
                          >
                            {displayName(p, people)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </label>
            <label>
              Data ślubu
              <DateField
                value={row.weddingDate || ""}
                onChange={(value) =>
                  setRow(index, {
                    ...row,
                    weddingDate: value || undefined,
                  })
                }
              />
            </label>
            {row.divorced ? (
              <p className="marriage-row__divorced">Rozwód</p>
            ) : (
              <span className="marriage-row__status" />
            )}
            <div className="marriage-add">
              <button
                type="button"
                className="btn btn-secondary"
                aria-expanded={menuFor === index}
                onClick={() => setMenuFor(menuFor === index ? null : index)}
              >
                + dodaj
              </button>
              {menuFor === index ? (
                <div className="marriage-add__menu" role="menu">
                  {!row.divorced && row.spouseId ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => markDivorced(index)}
                    >
                      Rozwód
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => addWedding(index)}
                  >
                    Kolejny ślub
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
