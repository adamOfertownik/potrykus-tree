"use client";

import { useState } from "react";
import { AuthedPage } from "@/components/AuthedPage";
import type { ChangeSubmission } from "@/types/submissions";

function AdminInner() {
  const [code, setCode] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [items, setItems] = useState<ChangeSubmission[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async (adminCode: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        headers: { "x-admin-code": adminCode },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setItems(data.submissions || []);
      setUnlocked(true);
    } catch (e) {
      setError((e as Error).message);
      setUnlocked(false);
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    id: string,
    status: ChangeSubmission["status"],
  ) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/submissions", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-code": code,
        },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      setItems((list) =>
        list.map((s) => (s.id === id ? data.submission : s)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Panel zgłoszeń</h1>
        <p>Przeglądaj i oznaczaj zgłoszenia z rodziny.</p>
      </header>

      {!unlocked ? (
        <form
          className="change-form"
          onSubmit={(e) => {
            e.preventDefault();
            void load(code);
          }}
        >
          <label className="field-block">
            Kod admina
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          {error && (
            <p className="banner-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Sprawdzam…" : "Otwórz"}
          </button>
        </form>
      ) : (
        <>
          {error && (
            <p className="banner-error" role="alert">
              {error}
            </p>
          )}
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
  return (
    <AuthedPage>
      {() => <AdminInner />}
    </AuthedPage>
  );
}
