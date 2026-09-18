"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminLogin } from "@/lib/hooks";
import { TermsAccept, useStoredLegalAccept } from "@/components/TermsAccept";

type Props = {
  /** Where to go after successful login. */
  nextHref?: string;
  showBackLink?: boolean;
};

export function AdminLoginForm({
  nextHref = "/admin",
  showBackLink = true,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useStoredLegalAccept();
  const login = useAdminLogin();

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Logowanie</h1>
        <p className="gate-lead">
          Konto administratora do przeglądania i zatwierdzania zgłoszeń od
          rodziny. Po ok. 30 minutach bezczynności wylogujemy Cię automatycznie
          — to ochrona przed pozostawionym otwartym panelem.
        </p>
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!accepted) return;
            login.mutate(
              { email, password },
              {
                onSuccess: () => {
                  router.push(nextHref);
                  router.refresh();
                },
              },
            );
          }}
        >
          <label htmlFor="admin-email" className="field-block">
            Login (e-mail)
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              placeholder="np. jan@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gate-input"
              required
            />
          </label>
          <label htmlFor="admin-password" className="field-block">
            Hasło
            <span className="password-field">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Hasło"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gate-input"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-pressed={showPassword}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? "Ukryj" : "Pokaż"}
              </button>
            </span>
          </label>
          <TermsAccept
            id="admin-legal"
            accepted={accepted}
            onChange={setAccepted}
          />
          <button
            type="submit"
            className="gate-cta"
            disabled={login.isPending || !accepted}
          >
            {login.isPending ? "Loguję…" : "Zaloguj"}
          </button>
        </form>
        {login.isError && (
          <p className="gate-error" role="alert">
            {(login.error as Error).message || "Błąd logowania."}
          </p>
        )}
        {showBackLink && (
          <footer className="gate-footer">
            <Link href="/drzewo">← Wróć do drzewa</Link>
            <span className="gate-footer__sep">·</span>
            <Link href="/regulamin">Regulamin</Link>
            <span className="gate-footer__sep">·</span>
            <Link href="/polityka-prywatnosci">Prywatność</Link>
          </footer>
        )}
      </section>
    </main>
  );
}
