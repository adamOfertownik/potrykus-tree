"use client";

import { useState } from "react";
import { useUnlock } from "@/lib/hooks";
import { TermsAccept, useStoredLegalAccept } from "@/components/TermsAccept";

type Props = {
  /** Where to go after a successful unlock (full navigation — reliable on mobile). */
  afterUnlockHref?: string;
};

export function AccessGate({ afterUnlockHref = "/" }: Props) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [accepted, setAccepted] = useStoredLegalAccept();
  const unlock = useUnlock();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) return;
    unlock.mutate(code, {
      onSuccess: () => {
        // Full reload into the unlocked app (avoids soft-router + stale SW)
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
          Prywatne archiwum Rodu Potrykus, złożone z papierów rodzinnych.
          Chronione kodem — bez konta, bez publicznego dostępu.
        </p>
        <form className="gate-form" onSubmit={onSubmit}>
          <label htmlFor="family-code" className="field-block">
            Kod rodzinny
            <span className="password-field">
              <input
                id="family-code"
                type={showCode ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Wpisz kod"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="gate-input"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowCode((v) => !v)}
                aria-pressed={showCode}
                aria-label={showCode ? "Ukryj kod" : "Pokaż kod"}
              >
                {showCode ? "Ukryj" : "Pokaż"}
              </button>
            </span>
          </label>
          <TermsAccept
            id="family-legal"
            accepted={accepted}
            onChange={setAccepted}
          />
          <button
            type="submit"
            className="gate-cta"
            disabled={unlock.isPending || !accepted}
          >
            {unlock.isPending ? "Sprawdzam…" : "Wejdź do drzewa"}
          </button>
        </form>
        {unlock.isError && (
          <p className="gate-error" role="alert">
            {(unlock.error as Error).message || "Nieprawidłowy kod."}
          </p>
        )}
        <footer className="gate-footer">
          <p>
            Twórca: <strong>Adam Lieske</strong>
          </p>
          <p>
            <a href="/regulamin">Regulamin</a>
            <span className="gate-footer__sep">·</span>
            <a href="/polityka-prywatnosci">Prywatność</a>
            <span className="gate-footer__sep">·</span>
            <a href="/login">Logowanie administratora</a>
          </p>
        </footer>
      </section>
    </main>
  );
}
