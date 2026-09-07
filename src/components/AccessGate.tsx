"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthStatus, useFirstAdmin, useLogin, useViewUnlock } from "@/lib/hooks";

type Props = {
  /** Where to go after a successful login (full navigation — reliable on mobile). */
  afterLoginHref?: string;
  needsFirstAdmin?: boolean;
};

export function AccessGate({ afterLoginHref, needsFirstAdmin }: Props) {
  const auth = useAuthStatus();
  const firstAdmin = Boolean(needsFirstAdmin ?? auth.data?.needsFirstAdmin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [viewCode, setViewCode] = useState("");
  const login = useLogin();
  const setup = useFirstAdmin();
  const viewUnlock = useViewUnlock();
  const pending = login.isPending || setup.isPending;

  const goAfterAuth = (role: string) => {
    if (afterLoginHref) {
      const target =
        afterLoginHref.startsWith("/admin") && role !== "admin"
          ? "/drzewo"
          : afterLoginHref;
      window.location.assign(target);
      return;
    }
    window.location.reload();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstAdmin) {
      setup.mutate(
        { email, password },
        { onSuccess: (data) => goAfterAuth(data.role) },
      );
      return;
    }
    login.mutate(
      { email, password },
      { onSuccess: (data) => goAfterAuth(data.role) },
    );
  };

  const error = firstAdmin ? setup.error : login.error;

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">
          {firstAdmin ? "Pierwsze konto admina" : "Logowanie"}
        </h1>
        <p className="gate-lead">
          {firstAdmin
            ? "Nie ma jeszcze żadnego konta w bazie. Ustaw swój e-mail i hasło (min. 8 znaków). Aplikacja sama utworzy tabele w Neon. Nie ma kodu rodzinnego."
            : "Prywatne archiwum. Admin loguje się e-mailem. Reszta rodziny może wejść samym hasłem do drzewa — bez konta."}
        </p>
        <form className="gate-form" onSubmit={onSubmit}>
          <label htmlFor="family-email" className="field-block">
            E-mail
            <input
              id="family-email"
              type="email"
              autoComplete="username"
              placeholder="np. jan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gate-input"
              required
            />
          </label>
          <label htmlFor="family-password" className="field-block">
            Hasło
            <input
              id="family-password"
              type="password"
              autoComplete={firstAdmin ? "new-password" : "current-password"}
              placeholder={firstAdmin ? "Hasło (min. 8 znaków)" : "Hasło"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="gate-input"
              required
              minLength={firstAdmin ? 8 : undefined}
            />
          </label>
          <button type="submit" className="gate-cta" disabled={pending}>
            {pending
              ? firstAdmin
                ? "Tworzę tabele i konto…"
                : "Loguję…"
              : firstAdmin
                ? "Utwórz konto administratora"
                : "Zaloguj"}
          </button>
        </form>
        {error && (
          <p className="gate-error" role="alert">
            {(error as Error).message || "Nie udało się."}
          </p>
        )}
        {!firstAdmin ? (
          <form
            className="gate-form"
            onSubmit={(e) => {
              e.preventDefault();
              viewUnlock.mutate(viewCode.trim(), {
                onSuccess: () => goAfterAuth("guest"),
              });
            }}
          >
            <p className="gate-lead">Bez konta — tylko hasło do drzewa</p>
            <label htmlFor="family-view-code" className="field-block">
              Hasło rodzinne
              <input
                id="family-view-code"
                type="password"
                autoComplete="off"
                value={viewCode}
                onChange={(e) => setViewCode(e.target.value)}
                className="gate-input"
                required
              />
            </label>
            <button
              type="submit"
              className="gate-cta"
              disabled={viewUnlock.isPending || viewCode.trim().length < 1}
            >
              {viewUnlock.isPending ? "Otwieram…" : "Pokaż drzewo bez konta"}
            </button>
            {viewUnlock.isError ? (
              <p className="gate-error" role="alert">
                {(viewUnlock.error as Error).message}
              </p>
            ) : null}
          </form>
        ) : null}
        <footer className="gate-footer">
          {firstAdmin ? (
            <>
              Twórca: <strong>Adam Lieske</strong>
            </>
          ) : (
            <>
              Link z zaproszenia? <Link href="/register">Załóż konto</Link>
              <span className="gate-footer__sep">·</span>
              <Link href="/wejscie">Tylko drzewo</Link>
              <span className="gate-footer__sep">·</span>
              Twórca: <strong>Adam Lieske</strong>
            </>
          )}
        </footer>
      </section>
    </main>
  );
}
