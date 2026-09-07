"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useViewUnlock } from "@/lib/hooks";

type Props = {
  afterUnlockHref?: string;
};

export function ViewGate({ afterUnlockHref = "/drzewo" }: Props) {
  const searchParams = useSearchParams();
  const fromLink =
    searchParams.get("k")?.trim() || searchParams.get("invite")?.trim() || "";
  const [code, setCode] = useState("");
  const autoTried = useRef(false);
  const unlock = useViewUnlock();
  const status = useQuery({
    queryKey: ["view-open"],
    queryFn: async () => {
      const res = await fetch("/api/auth/view");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd");
      return data as { enabled: boolean };
    },
  });

  useEffect(() => {
    if (!fromLink || autoTried.current || status.isLoading) return;
    if (status.data?.enabled === false) return;
    autoTried.current = true;
    unlock.mutate(fromLink, {
      onSuccess: () => window.location.assign(afterUnlockHref),
    });
    // One auto-submit per invite token; mutate identity is unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterUnlockHref, fromLink, status.data?.enabled, status.isLoading]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = fromLink || code.trim();
    if (!value) return;
    unlock.mutate(value, {
      onSuccess: () => window.location.assign(afterUnlockHref),
    });
  };

  return (
    <main className="gate">
      <div className="gate-atmosphere" aria-hidden />
      <section className="gate-panel">
        <p className="gate-brand">Drzewo Potrykus</p>
        <h1 className="gate-title">Wejście do drzewa</h1>
        <p className="gate-lead">
          {fromLink
            ? "Otwieram drzewo z linku — bez zakładania konta."
            : "Hasło rodzinne wystarczy, żeby obejrzeć drzewo. Konto jest tylko dla osób, które mają edytować albo prowadzić zjazd."}
        </p>
        {status.data && !status.data.enabled ? (
          <p className="gate-error" role="status">
            Podgląd bez konta jest wyłączony, dopóki administrator nie ustawi
            hasła w panelu.
          </p>
        ) : null}
        <form className="gate-form" onSubmit={onSubmit}>
          {fromLink ? (
            <input type="hidden" name="code" value={fromLink} />
          ) : (
            <label htmlFor="view-code" className="field-block">
              Hasło do drzewa
              <input
                id="view-code"
                type="password"
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="gate-input"
                required
              />
            </label>
          )}
          <button
            type="submit"
            className="gate-cta"
            disabled={unlock.isPending || status.data?.enabled === false}
          >
            {unlock.isPending ? "Otwieram…" : "Pokaż drzewo"}
          </button>
        </form>
        {unlock.isError && (
          <p className="gate-error" role="alert">
            {(unlock.error as Error).message || "Nie udało się otworzyć drzewa."}
          </p>
        )}
        <footer className="gate-footer">
          Masz konto? <Link href="/login">Zaloguj się</Link>
          <span className="gate-footer__sep">·</span>
          <Link href="/register">Załóż konto z zaproszenia</Link>
        </footer>
      </section>
    </main>
  );
}
