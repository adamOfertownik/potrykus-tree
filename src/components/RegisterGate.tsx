"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useRegister } from "@/lib/hooks";

type Props = {
  afterRegisterHref?: string;
};

export function RegisterGate({ afterRegisterHref = "/drzewo" }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const register = useRegister();
  const invite = useQuery({
    queryKey: ["register-open"],
    queryFn: async () => {
      const res = await fetch("/api/auth/register");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      return data as { enabled: boolean };
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    register.mutate(
      { email, password, inviteCode, displayName: displayName || undefined },
      {
        onSuccess: () => {
          window.location.assign(afterRegisterHref);
        },
      },
    );
  };

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Rejestracja</h1>
        <p className="gate-lead">
          Załóż własne konto. Klucz zaproszenia dostajesz od administratora —
          w bazie trzymamy tylko jego hash, nie jawny tekst.
        </p>
        {invite.data && !invite.data.enabled ? (
          <p className="gate-error" role="status">
            Rejestracja jest wyłączona, dopóki administrator nie ustawi klucza
            w panelu.
          </p>
        ) : null}
        <form className="gate-form" onSubmit={onSubmit}>
          <label htmlFor="reg-email" className="field-block">
            E-mail
            <input
              id="reg-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gate-input"
              required
            />
          </label>
          <label htmlFor="reg-name" className="field-block">
            Imię (opcjonalnie)
            <input
              id="reg-name"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="gate-input"
            />
          </label>
          <label htmlFor="reg-password" className="field-block">
            Hasło (min. 8 znaków)
            <input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="gate-input"
              required
              minLength={8}
            />
          </label>
          <label htmlFor="reg-invite" className="field-block">
            Klucz zaproszenia
            <input
              id="reg-invite"
              type="password"
              autoComplete="off"
              placeholder="Klucz od administratora"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="gate-input"
              required
            />
          </label>
          <button
            type="submit"
            className="gate-cta"
            disabled={register.isPending || invite.data?.enabled === false}
          >
            {register.isPending ? "Zakładam konto…" : "Załóż konto"}
          </button>
        </form>
        {register.isError && (
          <p className="gate-error" role="alert">
            {(register.error as Error).message || "Nie udało się zarejestrować."}
          </p>
        )}
        <footer className="gate-footer">
          Masz już konto? <Link href="/login">Zaloguj się</Link>
        </footer>
      </section>
    </main>
  );
}
