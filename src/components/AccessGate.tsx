"use client";

import { useState } from "react";
import { useUnlock } from "@/lib/hooks";

type Props = {
  /** Where to go after a successful unlock (full navigation — reliable on mobile). */
  afterUnlockHref?: string;
};

export function AccessGate({ afterUnlockHref = "/" }: Props) {
  const [code, setCode] = useState("");
  const unlock = useUnlock();

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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
          Dane genealogiczne i numery telefonów są chronione kodem rodzinnym —
          bez konta, ale też bez publicznego dostępu.
        </p>
        <form className="gate-form" onSubmit={onSubmit}>
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
          <button type="submit" className="gate-cta" disabled={unlock.isPending}>
            {unlock.isPending ? "Sprawdzam…" : "Wejdź do drzewa"}
          </button>
        </form>
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
