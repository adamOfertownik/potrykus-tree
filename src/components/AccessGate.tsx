"use client";

import { useState } from "react";
import Link from "next/link";
import { useLogin } from "@/lib/hooks";

type Props = {
  /** Where to go after a successful login (full navigation — reliable on mobile). */
  afterLoginHref?: string;
};

export function AccessGate({ afterLoginHref }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: (data) => {
          if (afterLoginHref) {
            const target =
              afterLoginHref.startsWith("/admin") && data.role !== "admin"
                ? "/drzewo"
                : afterLoginHref;
            window.location.assign(target);
            return;
          }
          window.location.reload();
        },
      },
    );
  };

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Logowanie</h1>
        <p className="gate-lead">
          Prywatne archiwum rodziny. Wejdź e-mailem i hasłem albo załóż konto
          kluczem zaproszenia od administratora.
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
            {(login.error as Error).message || "Nie udało się zalogować."}
          </p>
        )}
        <footer className="gate-footer">
          Nie masz konta? <Link href="/register">Zarejestruj się</Link>
          <span className="gate-footer__sep">·</span>
          Twórca: <strong>Adam Lieske</strong>
        </footer>
      </section>
    </main>
  );
}
