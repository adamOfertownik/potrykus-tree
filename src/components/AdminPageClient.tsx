"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission } from "@/types/submissions";
import { useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";

type TreeInfo = {
  storage: string;
  peopleCount: number;
  rootPersonId: string;
  updatedAt: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd");
  return data as T;
}

function AdminPanel({ email }: { email: string }) {
  const logout = useAdminLogout();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);

  const submissionsQ = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const data = await fetchJson<{ submissions: ChangeSubmission[] }>(
        "/api/admin/submissions",
      );
      return data.submissions || [];
    },
  });

  const treeQ = useQuery({
    queryKey: ["admin-family"],
    queryFn: () => fetchJson<TreeInfo>("/api/admin/family"),
  });

  const statusMut = useMutation({
    mutationFn: (input: {
      id: string;
      status: ChangeSubmission["status"];
    }) =>
      fetchJson<{ submission: ChangeSubmission }>("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin-submissions"] });
    },
  });

  const replaceMut = useMutation({
    mutationFn: () =>
      fetchJson<TreeInfo>("/api/admin/family", { method: "POST" }),
    onSuccess: (data) => {
      qc.setQueryData(["admin-family"], data);
    },
  });

  const replaceTree = () => {
    const ok = window.confirm(
      "Nadpisać drzewo w Neonie ziarnem z repozytorium (418 osób z pliku)? Zmiany z grafu zostaną zastąpione.",
    );
    if (!ok) return;
    setConfirming(true);
    replaceMut.mutate(undefined, {
      onSettled: () => setConfirming(false),
    });
  };

  const error =
    submissionsQ.error?.message ||
    treeQ.error?.message ||
    statusMut.error?.message ||
    replaceMut.error?.message ||
    null;
  const busy =
    submissionsQ.isFetching ||
    treeQ.isFetching ||
    statusMut.isPending ||
    replaceMut.isPending ||
    confirming;
  const items = submissionsQ.data ?? [];
  const tree = treeQ.data;

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Administracja</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Drzewo żyje w Neonie;
          zgłoszenia rodziny są poniżej.
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

      <section className="admin-card admin-family">
        <h2>Baza drzewa</h2>
        {tree ? (
          <p>
            {tree.peopleCount} osób · korzeń {tree.rootPersonId} · zapis:{" "}
            {tree.storage === "neon" ? "Neon" : "plik lokalny"}
            {tree.updatedAt ? ` · ${tree.updatedAt.slice(0, 10)}` : ""}
          </p>
        ) : (
          <p className="empty-hint">Ładowanie stanu drzewa…</p>
        )}
        <p className="empty-hint">
          Przy pustym Neonie pierwsze otwarcie drzewa samo wgrywa 418 osób z
          repozytorium. Ten przycisk nadpisuje bazę na siłę.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={replaceTree}
        >
          Wgraj 418 osób z pliku do Neona
        </button>
      </section>

      <h2 className="admin-subhead">Zgłoszenia</h2>
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
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "reviewed" })
                }
              >
                Przejrzane
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "accepted" })
                }
              >
                Akceptuj
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  statusMut.mutate({ id: s.id, status: "rejected" })
                }
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
