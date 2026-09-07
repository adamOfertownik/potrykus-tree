"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission } from "@/types/submissions";
import { useAdminAuthStatus, useAdminLogout } from "@/lib/hooks";

type Issue = { level: "error" | "warning"; line?: number; message: string };

type ImportSummary = {
  personCount: number;
  errorCount: number;
  warningCount: number;
  starredName?: string;
  rootPersonId: string;
  preservedCount: number;
  matchedCount: number;
  sample: string[];
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("pl-PL");
  } catch {
    return iso;
  }
}

function SnapshotImport() {
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [markdown, setMarkdown] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [preserveExtras, setPreserveExtras] = useState(true);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [applied, setApplied] = useState(false);

  const readFile = async (file: File) => {
    const text = await file.text();
    setMarkdown(text);
    setFileName(file.name);
    setSummary(null);
    setIssues([]);
    setApplied(false);
    setError(null);
  };

  const post = async (apply: boolean) => {
    setBusy(apply ? "apply" : "preview");
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/admin/import-md", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markdown,
          apply,
          confirm: apply,
          preserveExtras,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.summary) setSummary(data.summary);
        if (data.issues) setIssues(data.issues);
        throw new Error(data.error || "Błąd importu");
      }
      setSummary(data.summary);
      setIssues(data.issues || []);
      if (data.applied) {
        setApplied(true);
        await queryClient.invalidateQueries({ queryKey: ["family"] });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="admin-import" aria-labelledby="snapshot-heading">
      <h2 id="snapshot-heading">Snapshot Markdown</h2>
      <p>
        Wgraj plik <code>.md</code> w formacie ID-based (jedna osoba = jedna
        linia, pola <code>rodzic:</code> / <code>małżonek:</code>). Najpierw
        podgląd, potem wgranie zastępuje listę w <code>family.json</code>.
      </p>

      <div className="admin-import__row">
        <label className="field-block admin-import__file">
          Plik .md
          <input
            ref={fileRef}
            type="file"
            accept=".md,.txt,text/markdown,text/plain"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
        {fileName && <span className="selected-chip">{fileName}</span>}
      </div>

      <label className="field-block">
        Albo wklej snapshot
        <textarea
          rows={8}
          value={markdown}
          onChange={(e) => {
            setMarkdown(e.target.value);
            setSummary(null);
            setApplied(false);
          }}
          placeholder="- [P001] Jan Kowalski | m | ur. 1900-01-01 | rodzic: — | małżonek: P002"
        />
      </label>

      <label className="admin-import__check">
        <input
          type="checkbox"
          checked={preserveExtras}
          onChange={(e) => setPreserveExtras(e.target.checked)}
        />
        Zachowaj osoby z obecnego drzewa, których nie ma w pliku (np. dzieci
        dopisane w aplikacji) oraz telefony i zdjęcia przy dopasowaniu.
      </label>

      <div className="admin-card__actions">
        <button
          type="button"
          className="btn btn-secondary"
          disabled={!markdown.trim() || busy !== null}
          onClick={() => void post(false)}
        >
          {busy === "preview" ? "Sprawdzam…" : "Podgląd"}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            !markdown.trim() ||
            busy !== null ||
            !summary ||
            summary.errorCount > 0
          }
          onClick={() => {
            if (
              !window.confirm(
                `Zastąpić drzewo snapshotem (${summary?.personCount ?? "?"} osób z pliku)?`,
              )
            ) {
              return;
            }
            void post(true);
          }}
        >
          {busy === "apply" ? "Wgrywam…" : "Wgraj i zastąp drzewo"}
        </button>
      </div>

      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      {applied && (
        <p className="banner-success" role="status">
          Wgrano snapshot. Lista i drzewo korzystają z nowych danych.
        </p>
      )}
      {summary && (
        <div className="admin-import__summary">
          <p>
            Osób w pliku: <strong>{summary.personCount}</strong>
            {" · "}błędy: <strong>{summary.errorCount}</strong>
            {" · "}ostrzeżenia: {summary.warningCount}
          </p>
          <p>
            Korzeń listy: <code>{summary.rootPersonId}</code>
            {summary.starredName ? ` (${summary.starredName})` : ""}
          </p>
          <p>
            Dopasowano do obecnego drzewa: {summary.matchedCount}
            {" · "}zachowano extra: {summary.preservedCount}
          </p>
          {summary.sample.length > 0 && (
            <ul className="admin-import__sample">
              {summary.sample.map((row) => (
                <li key={row}>{row}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {issues.length > 0 && (
        <ul className="admin-import__issues">
          {issues.slice(0, 40).map((issue, i) => (
            <li key={`${issue.message}-${i}`} className={`is-${issue.level}`}>
              {issue.level === "error" ? "Błąd" : "Uwaga"}
              {issue.line ? ` (linia ${issue.line})` : ""}: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SubmissionDetails({ s }: { s: ChangeSubmission }) {
  return (
    <div className="admin-card__body">
      <p>{s.message || "(bez opisu)"}</p>
      {s.targetPersonName && (
        <p className="empty-hint">Dotyczy: {s.targetPersonName}</p>
      )}
      {s.reporterPhone && (
        <p className="empty-hint">Telefon: {s.reporterPhone}</p>
      )}
      {s.self && (
        <p>
          Brakująca osoba:{" "}
          <strong>
            {s.self.firstName} {s.self.lastName}
          </strong>
          {s.self.birthDate ? ` · ur. ${s.self.birthDate}` : ""}
          {s.self.gender ? ` · ${s.self.gender}` : ""}
        </p>
      )}
      {s.relatives && s.relatives.length > 0 && (
        <ul className="admin-import__sample">
          {s.relatives.map((r, i) => (
            <li key={`${r.firstName}-${i}`}>
              {r.relation}: {r.firstName} {r.lastName}
              {r.birthDate ? ` (${r.birthDate})` : ""}
            </li>
          ))}
        </ul>
      )}
      {s.graphEdit && (
        <p className="empty-hint">
          Edycja grafu: {s.graphEdit.op}
          {s.graphEdit.summary ? ` — ${s.graphEdit.summary}` : ""}
        </p>
      )}
      <p className="empty-hint">{formatWhen(s.createdAt)}</p>
    </div>
  );
}

function AdminPanel({ email }: { email: string }) {
  const logout = useAdminLogout();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const res = await fetch("/api/admin/submissions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      return (data.submissions || []) as ChangeSubmission[];
    },
  });

  const items = listQuery.data ?? [];

  const setStatus = async (
    id: string,
    status: ChangeSubmission["status"],
  ) => {
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
      queryClient.setQueryData(
        ["admin-submissions"],
        (list: ChangeSubmission[] | undefined) =>
          (list || []).map((s) => (s.id === id ? data.submission : s)),
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
        <h1>Konsola administracyjna</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Wgraj snapshot drzewa i
          przeglądaj zgłoszenia od rodziny.
        </p>
        <div className="admin-page__toolbar">
          <Link href="/drzewo" className="btn btn-secondary">
            ← Do drzewa
          </Link>
          <Link href="/lista" className="btn btn-secondary">
            Lista potomków
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

      <SnapshotImport />

      {error && (
        <p className="banner-error" role="alert">
          {error}
        </p>
      )}
      <h2 className="admin-page__sub">Zgłoszenia od rodziny</h2>
      <p className="empty-hint">{items.length} zgłoszeń</p>
      <ul className="admin-list">
        {items.map((s) => (
          <li key={s.id} className="admin-card">
            <div className="admin-card__head">
              <strong>{s.reporterName}</strong>
              <span>{s.kind}</span>
              <span className="admin-card__status">{s.status}</span>
            </div>
            <SubmissionDetails s={s} />
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
