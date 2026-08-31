"use client";

import { useState } from "react";
import { useUnlock } from "@/lib/hooks";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  /** Where to go after a successful unlock (full navigation — reliable on mobile). */
  afterUnlockHref?: string;
};

type GateMode = "account" | "code";

export function AccessGate({ afterUnlockHref = "/" }: Props) {
  const supabaseEnabled = isSupabaseConfigured();
  const [mode, setMode] = useState<GateMode>(
    supabaseEnabled ? "account" : "code",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const unlock = useUnlock();

  const onAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseEnabled) return;

    setAccountBusy(true);
    setAccountError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setAccountError(
          error.message === "Invalid login credentials"
            ? "Nieprawidłowy e-mail lub hasło."
            : error.message,
        );
        return;
      }

      window.location.assign(afterUnlockHref);
    } catch (err) {
      setAccountError((err as Error).message || "Nie udało się zalogować.");
    } finally {
      setAccountBusy(false);
    }
  };

  const onCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    unlock.mutate(code, {
      onSuccess: () => {
        window.location.assign(afterUnlockHref);
      },
    });
  };

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Rodzinne archiwum</h1>
        <p className="gate-lead">
          {supabaseEnabled
            ? "Zaloguj się kontem rodzinnym albo użyj kodu dostępu — dane genealogiczne nie są publiczne."
            : "Dane genealogiczne i numery telefonów są chronione kodem rodzinnym — bez konta, ale też bez publicznego dostępu."}
        </p>

        {supabaseEnabled && (
          <div className="gate-tabs" role="tablist" aria-label="Sposób logowania">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "account"}
              className={mode === "account" ? "is-active" : undefined}
              onClick={() => setMode("account")}
            >
              Konto
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "code"}
              className={mode === "code" ? "is-active" : undefined}
              onClick={() => setMode("code")}
            >
              Kod rodzinny
            </button>
          </div>
        )}

        {mode === "account" && supabaseEnabled ? (
          <form className="gate-form" onSubmit={onAccountSubmit}>
            <label htmlFor="login-email" className="sr-only">E-mail</label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="gate-input"
              required
            />
            <label htmlFor="login-password" className="sr-only">Hasło</label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Hasło"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="gate-input"
              required
            />
            <button
              type="submit"
              className="gate-cta"
              disabled={accountBusy}
            >
              {accountBusy ? "Loguję…" : "Zaloguj się"}
            </button>
          </form>
        ) : (
          <form className="gate-form" onSubmit={onCodeSubmit}>
            <label htmlFor="family-code" className="sr-only">
              Kod rodzinny
            </label>
            <input
              id="family-code"
              type="password"
              autoComplete="current-password"
              placeholder="Kod rodzinny"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="gate-input"
              required
            />
            <button
              type="submit"
              className="gate-cta"
              disabled={unlock.isPending}
            >
              {unlock.isPending ? "Sprawdzam…" : "Wejdź do drzewa"}
            </button>
          </form>
        )}

        {accountError && (
          <p className="gate-error" role="alert">{accountError}</p>
        )}
        {unlock.isError && (
          <p className="gate-error" role="alert">
            {(unlock.error as Error).message || "Nieprawidłowy kod."}
          </p>
        )}

        <footer className="gate-footer">
          Twórca: <strong>Adam Lieske</strong>
        </footer>
      </section>
    </main>
  );
}
