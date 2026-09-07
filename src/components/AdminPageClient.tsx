"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ChangeSubmission } from "@/types/submissions";
import type { UserRole } from "@/types/auth";
import { useAuthStatus, useLogout } from "@/lib/hooks";

type UserRow = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
};

function roleLabel(role: UserRole) {
  return role === "admin" ? "Admin" : "Rodzina";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Błąd sieci");
  return data as T;
}

function AdminPanel({ email }: { email: string }) {
  const logout = useLogout();
  const router = useRouter();
  const qc = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("member");
  const [newName, setNewName] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const submissionsQ = useQuery({
    queryKey: ["admin-submissions"],
    queryFn: () =>
      fetchJson<{ submissions: ChangeSubmission[] }>("/api/admin/submissions"),
  });
  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchJson<{ users: UserRow[] }>("/api/admin/users"),
  });

  const statusMut = useMutation({
    mutationFn: (input: { id: string; status: ChangeSubmission["status"] }) =>
      fetchJson<{ submission: ChangeSubmission }>("/api/admin/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-submissions"] }),
  });

  const createMut = useMutation({
    mutationFn: (input: {
      email: string;
      password: string;
      role: UserRole;
      displayName?: string;
    }) =>
      fetchJson<{ user: UserRow }>("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("member");
      setNotice(
        `Utworzono konto ${data.user.email} (${roleLabel(data.user.role)}).`,
      );
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  const inviteQ = useQuery({
    queryKey: ["admin-invite"],
    queryFn: () =>
      fetchJson<{ enabled: boolean; updatedAt: string | null }>(
        "/api/admin/invite",
      ),
  });

  const inviteMut = useMutation({
    mutationFn: (body: { generate?: boolean; code?: string }) =>
      fetchJson<{ ok: boolean; token?: string; path?: string }>(
        "/api/admin/invite",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      ),
    onSuccess: (data) => {
      setInviteCode("");
      if (data.path) {
        const url = `${window.location.origin}${data.path}`;
        setInviteLink(url);
        setNotice(
          "Gotowy jeden link dla całej rodziny. Skopiuj i wyślij. W bazie jest tylko hash — później linku stąd nie odzyskasz.",
        );
      } else {
        setNotice("Zapisano klucz zaproszenia (w bazie jest tylko hash).");
      }
      void qc.invalidateQueries({ queryKey: ["admin-invite"] });
    },
  });

  const importMdMut = useMutation({
    mutationFn: (body: FormData) =>
      fetch("/api/admin/family-import", { method: "POST", body }).then(
        async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Błąd importu");
          return data as { people: number };
        },
      ),
    onSuccess: (data) => {
      setNotice(`Wgrano drzewo (${data.people} osób) do Neona.`);
      void qc.invalidateQueries({ queryKey: ["family"] });
    },
  });

  const inviteClearMut = useMutation({
    mutationFn: () =>
      fetchJson<{ ok: boolean }>("/api/admin/invite", { method: "DELETE" }),
    onSuccess: () => {
      setInviteLink("");
      setNotice("Rejestracja wyłączona — klucz usunięty.");
      void qc.invalidateQueries({ queryKey: ["admin-invite"] });
    },
  });

  const roleMut = useMutation({
    mutationFn: (input: { id: string; role: UserRole }) =>
      fetchJson<{ user: UserRow }>("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  const items = submissionsQ.data?.submissions ?? [];
  const users = usersQ.data?.users ?? [];
  const error =
    submissionsQ.error ||
    usersQ.error ||
    inviteQ.error ||
    statusMut.error ||
    createMut.error ||
    roleMut.error ||
    inviteMut.error ||
    inviteClearMut.error ||
    importMdMut.error;
  const busy =
    statusMut.isPending ||
    createMut.isPending ||
    roleMut.isPending ||
    inviteMut.isPending ||
    inviteClearMut.isPending;

  return (
    <section className="admin-page">
      <header className="admin-page__intro">
        <h1>Panel administratora</h1>
        <p>
          Zalogowany jako <strong>{email}</strong>. Wygeneruj jeden link
          zaproszenia, zakładaj konta i zatwierdzaj zgłoszenia.
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
          {(error as Error).message}
        </p>
      )}
      {notice && (
        <p className="banner-success" role="status">
          {notice}
        </p>
      )}

      <section className="admin-users">
        <h2>Link zaproszenia dla rodziny</h2>
        <p className="empty-hint">
          Jeden ogólny link. Rodzina otwiera go, podaje e-mail i hasło — klucz
          jest już w adresie. W Neon zapisujemy wyłącznie hash. Po odświeżeniu
          strony linku stąd nie odczytasz, więc skopiuj go od razu.
        </p>
        <p className="empty-hint">
          Status:{" "}
          {inviteQ.data?.enabled
            ? "rejestracja włączona (token ustawiony)"
            : "rejestracja wyłączona (brak tokenu)"}
        </p>
        {inviteLink ? (
          <p className="empty-hint">
            <label className="field-block">
              Link do skopiowania
              <input
                className="gate-input"
                readOnly
                value={inviteLink}
                onFocus={(e) => e.currentTarget.select()}
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                void navigator.clipboard.writeText(inviteLink);
                setNotice("Skopiowano link zaproszenia.");
              }}
            >
              Kopiuj link
            </button>
          </p>
        ) : null}
        <form
          className="admin-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            inviteMut.mutate({ code: inviteCode });
          }}
        >
          <button
            type="button"
            className="btn btn-primary"
            disabled={inviteMut.isPending}
            onClick={() => {
              setNotice(null);
              inviteMut.mutate({ generate: true });
            }}
          >
            {inviteMut.isPending
              ? "Generuję…"
              : "Wygeneruj nowy link rodzinny"}
          </button>
          <label className="field-block">
            Albo własny klucz (min. 8 znaków)
            <input
              type="password"
              className="gate-input"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button
            type="submit"
            className="btn btn-secondary"
            disabled={inviteMut.isPending || inviteCode.trim().length < 8}
          >
            Zapisz własny klucz
          </button>
          {inviteQ.data?.enabled ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={inviteClearMut.isPending}
              onClick={() => {
                setNotice(null);
                inviteClearMut.mutate();
              }}
            >
              Wyłącz rejestrację
            </button>
          ) : null}
        </form>
      </section>

      <section className="admin-users">
        <h2>Drzewo z pliku Markdown</h2>
        <p className="empty-hint">
          Żywe dane są w Neon, nie w kodzie. Wgraj <strong>.md</strong> (jak
          załącznik z raportu), a aplikacja zbuduje osoby, rodziców i małżeństwa.
        </p>
        <form
          className="admin-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            const input = e.currentTarget.elements.namedItem(
              "mdfile",
            ) as HTMLInputElement | null;
            const file = input?.files?.[0];
            if (!file) {
              setNotice(null);
              return;
            }
            const body = new FormData();
            body.append("file", file);
            setNotice(null);
            importMdMut.mutate(body);
          }}
        >
          <label className="field-block">
            Plik .md
            <input name="mdfile" type="file" accept=".md,text/markdown,text/plain" />
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={importMdMut.isPending}
          >
            {importMdMut.isPending ? "Wczytuję…" : "Wgraj drzewo do bazy"}
          </button>
        </form>
      </section>

      <section className="admin-users">
        <h2>Konta rodziny</h2>
        <p className="empty-hint">
          <strong>Rodzina</strong> widzi drzewo, zgłasza poprawki i zapisuje
          się na spotkanie. <strong>Admin</strong> dodatkowo edytuje graf i
          zatwierdza zgłoszenia.
        </p>
        <form
          className="admin-user-form"
          onSubmit={(e) => {
            e.preventDefault();
            setNotice(null);
            createMut.mutate({
              email: newEmail,
              password: newPassword,
              role: newRole,
              displayName: newName || undefined,
            });
          }}
        >
          <label className="field-block">
            E-mail
            <input
              type="email"
              className="gate-input"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="field-block">
            Hasło (min. 8 znaków)
            <input
              type="password"
              className="gate-input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label className="field-block">
            Imię (opcjonalnie)
            <input
              type="text"
              className="gate-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="field-block">
            Rola
            <select
              className="gate-input"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
            >
              <option value="member">Rodzina</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "Zapisuję…" : "Dodaj konto"}
          </button>
        </form>
        <ul className="admin-list">
          {users.map((u) => (
            <li key={u.id} className="admin-card">
              <div className="admin-card__head">
                <strong>{u.displayName || u.email}</strong>
                <span className="admin-card__status">{roleLabel(u.role)}</span>
              </div>
              {u.displayName ? <p className="empty-hint">{u.email}</p> : null}
              <div className="admin-card__actions">
                {u.role === "admin" ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => roleMut.mutate({ id: u.id, role: "member" })}
                  >
                    Zrób członkiem rodziny
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => roleMut.mutate({ id: u.id, role: "admin" })}
                  >
                    Nadaj admina
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <h2>Zgłoszenia</h2>
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
  const auth = useAuthStatus();
  const router = useRouter();

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.data?.unlocked) {
      router.replace("/login?next=/admin");
      return;
    }
    if (auth.data.role !== "admin") {
      router.replace("/drzewo");
    }
  }, [auth.isLoading, auth.data, router]);

  if (
    auth.isLoading ||
    !auth.data?.unlocked ||
    auth.data.role !== "admin" ||
    !auth.data.email
  ) {
    return <div className="loading-screen">Ładowanie…</div>;
  }

  return (
    <main className="page-shell">
      <AdminPanel email={auth.data.email} />
    </main>
  );
}
