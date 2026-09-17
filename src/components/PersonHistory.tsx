"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPolishDateTime } from "@/lib/db-client";
import { PERSON_HISTORY_NOTE } from "@/lib/submissionHistory";
import type { PersonHistoryItem } from "@/lib/submissionHistory";

export function PersonHistory({ personId }: { personId: string }) {
  const [items, setItems] = useState<PersonHistoryItem[]>([]);
  const [note, setNote] = useState(PERSON_HISTORY_NOTE);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/person/${encodeURIComponent(personId)}/history`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Nie udało się wczytać historii.");
        if (cancelled) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        if (typeof data.note === "string" && data.note) setNote(data.note);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [personId]);

  return (
    <section className="person-history" data-testid="person-history">
      <h2>Kto dodawał i poprawiał</h2>
      {loading && <p className="empty-hint">Wczytywanie historii…</p>}
      {error && (
        <p className="gate-error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="empty-hint" data-testid="person-history-empty">
          {note}
        </p>
      )}
      {!loading && items.length > 0 && (
        <>
          <ol className="person-history__list">
            {items.map((item) => (
              <li key={item.id} className="person-history__item">
                <p className="person-history__when">
                  {formatPolishDateTime(item.at) || "data nieznana"}
                  <span> · {item.kindLabel}</span>
                </p>
                <p className="person-history__headline">{item.headline}</p>
                {item.detail && (
                  <p className="person-history__detail">{item.detail}</p>
                )}
                {item.reporterPersonId && (
                  <p className="person-history__who">
                    Zgłaszający:{" "}
                    <Link href={`/osoba/${encodeURIComponent(item.reporterPersonId)}`}>
                      {item.reporterName}
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <p className="person-history__note">{note}</p>
        </>
      )}
    </section>
  );
}
