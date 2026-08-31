"use client";

import { useState } from "react";
import { useUnlock } from "@/lib/hooks";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

type Props = {
  afterUnlockHref?: string;
};

type GateMode = "account" | "code";

function loginErrorMessage(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login")) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  if (msg.includes("email not confirmed")) {
    return "E-mail niepotwierdzony. W Supabase wyłącz „Confirm email” albo potwierdź skrzynkę.";
  }
  if (msg.includes("too many")) {
    return "Za dużo prób. Poczekaj chwilę i spróbuj ponownie.";
  }
  return raw || "Nie udało się zalogować.";
}

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
        setAccountError(loginErrorMessage(error.message));
        return;
      }

      window.location.assign(afterUnlockHref);
    } catch (err) {
      setAccountError(loginErrorMessage((err as Error).message));
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
        <h1 className="gate-title">Logowanie</h1>
        <p className="gate-lead">
          {supabaseEnabled
            ? "Wejdź e-mailem i hasłem. Zwykłe konto ma podgląd drzewa — edycja jest tylko dla administratora."
            : "Wejdź kodem rodzinnym. Edycja drzewa jest tylko dla administratora."}
        </p>

        {mode === "account" && supabaseEnabled ? (
          <form className="gate-form" onSubmit={onAccountSubmit}>
            <label className="gate-field" htmlFor="login-email">
              E-mail
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                inputMode="email"
                placeholder="np. jan@poczta.pl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="gate-input"
                required
              />
            </label>
            <label className="gate-field" htmlFor="login-password">
              Hasło
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
            </label>
            <button type="submit" className="gate-cta" disabled={accountBusy}>
              {accountBusy ? "Loguję…" : "Zaloguj się"}
            </button>
          </form>
        ) : (
          <form className="gate-form" onSubmit={onCodeSubmit}>
            <label className="gate-field" htmlFor="family-code">
              Kod rodzinny
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
            </label>
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
          <p className="gate-error" role="alert">
            {accountError}
          </p>
        )}
        {unlock.isError && (
          <p className="gate-error" role="alert">
            {(unlock.error as Error).message || "Nieprawidłowy kod."}
          </p>
        )}

        {supabaseEnabled && (
          <p className="gate-switch">
            {mode === "account" ? (
              <button type="button" onClick={() => setMode("code")}>
                Mam kod rodzinny
              </button>
            ) : (
              <button type="button" onClick={() => setMode("account")}>
                Zaloguj się e-mailem
              </button>
            )}
          </p>
        )}

        <footer className="gate-footer">
          Twórca: <strong>Adam Lieske</strong>
        </footer>
      </section>
    </main>
  );
}
