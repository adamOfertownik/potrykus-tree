"use client";

import { useEffect, useState } from "react";
import { AuthedPage } from "@/components/AuthedPage";
import { useCanEdit } from "@/lib/hooks";
import type { ChangeSubmission } from "@/types/submissions";

function AdminInner() {
  const canEdit = useCanEdit();
  const [items, setItems] = useState<ChangeSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    void fetch("/api/admin/submissions")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Błąd");
        if (!cancelled) {
          setItems(data.submissions || []);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setLoaded(false);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const setStatus = async (id: string, status: ChangeSubmission["status"]) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setItems((list) => list.map((s) => (s.id === id ? data.submission : s)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!canEdit) {
    return (
      <section className="admin-page">
        <header className="admin-page__intro">
          <h1>Panel zgłoszeń</h1>
          <p>Ten widok jest tylko dla administratora.</p>
        </header>
        <p className="banner-error" role="alert">
          Zaloguj się kontem admina, żeby przeglądać i akceptować zgłoszenia.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Panel zgłoszeń</h1>
        <p>Przeglądaj i oznaczaj zgłoszenia z rodziny. Edycja drzewa jest w karcie osoby.</p>
      </header>

      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      {!loaded && busy ? (
        <p className="empty-hint">Wczytywanie zgłoszeń…</p>
      ) : (
        <>
          <p className="empty-hint">{items.length} zgłoszeń</p>
          <ul className="admin-list">
            {items.map((s) => (
              <li key={s.id} className="admin-card">
                <div className="admin-card__head">
                  <strong>{s.reporterName}</strong>
                  <span>{s.kind}</span>
                  <span className="admin-card__status">{s.status}</span>
                </div>
                <p>{s.message || "(bez opisu)"}</p>
                {s.targetPersonName && (
                  <p className="empty-hint">Dotyczy: {s.targetPersonName}</p>
                )}
                <div className="admin-card__actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => setStatus(s.id, "reviewed")}
                  >
                    Przejrzane
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => setStatus(s.id, "accepted")}
                  >
                    Akceptuj
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => setStatus(s.id, "rejected")}
                  >
                    Odrzuć
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function AdminPageClient() {
  return <AuthedPage>{() => <AdminInner />}</AuthedPage>;
}
