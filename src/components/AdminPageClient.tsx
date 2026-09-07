"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChangeSubmission } from "@/types/submissions";
import {
  useAdminAuthStatus,
  useAdminLogout,
  useAdminSetSubmissionStatus,
  useAdminSubmissions,
} from "@/lib/hooks";

function AdminPanel({ email }: { email: string }) {
  const logout = useAdminLogout();
  const router = useRouter();
  const list = useAdminSubmissions();
  const patchStatus = useAdminSetSubmissionStatus();
  const items = list.data ?? [];
  const error =
    list.error instanceof Error
      ? list.error.message
      : patchStatus.error instanceof Error
        ? patchStatus.error.message
        : null;
  const busy = list.isFetching || patchStatus.isPending;

  const setStatus = (id: string, status: ChangeSubmission["status"]) => {
    patchStatus.mutate({ id, status });
  };

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Zatwierdzanie zgłoszeń</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Przeglądaj i oznaczaj
          zgłoszenia złożone przez rodzinę.
        </p>
        <div className="admin-page__toolbar">
          <Link href="/drzewo" className="btn btn-secondary">
            ← Do drzewa
          </Link>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={logout.isPending}
            onClick={() => {
              logout.mutate(undefined, {
                onSuccess: () => router.push("/login"),
              });
            }}
          >
            Wyloguj
          </button>
        </div>
      </header>

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
    </section>
  );
}

export function AdminPageClient() {
  const auth = useAdminAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.data?.loggedIn) {
      router.replace("/login?next=/admin");
    }
  }, [auth.isLoading, auth.data?.loggedIn, router]);

  if (auth.isLoading || !auth.data?.loggedIn || !auth.data.email) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return (
    <main className="page-shell">
      <AdminPanel email={auth.data.email} />
    </main>
  );
}
