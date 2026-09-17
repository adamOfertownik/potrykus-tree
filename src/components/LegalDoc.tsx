import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_UPDATED_LABEL } from "@/lib/legal";

export function LegalDoc({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <div className="legal-page__inner">
        <p className="legal-page__brand">
          <Link href="/">Drzewo Potrykus</Link>
        </p>
        <h1>{title}</h1>
        <p className="legal-page__meta">
          Wersja z dnia {LEGAL_UPDATED_LABEL}. Prosta informacja dla rodziny —
          nie jest to porada prawna.
        </p>
        <article className="legal-page__body">{children}</article>
        <p className="legal-page__nav">
          <Link href="/regulamin">Regulamin</Link>
          {" · "}
          <Link href="/polityka-prywatnosci">Polityka prywatności</Link>
          {" · "}
          <Link href="/">Wejście do drzewa</Link>
        </p>
      </div>
    </main>
  );
}
