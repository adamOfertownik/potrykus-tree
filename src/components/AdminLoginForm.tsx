"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdminLogin } from "@/lib/hooks";

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
  const login = useAdminLogin();

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Logowanie</h1>
        <p className="gate-lead">
          Konto administratora do przeglądania i zatwierdzania zgłoszeń od
          rodziny.
        </p>
        <form
          className="gate-form"
          onSubmit={(e) => {
            e.preventDefault();
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
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="gate-input"
              required
            />
          </label>
          <button type="submit" className="gate-cta" disabled={login.isPending}>
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
          </footer>
        )}
      </section>
    </main>
  );
}
