"use client";

import Link from "next/link";
import { AuthedPage } from "@/components/AuthedPage";
import {
  MONTH_NAMES_PL,
  occasionAgeLabel,
  occasionsThisMonth,
  upcomingOccasions,
  type OccasionEntry,
} from "@/lib/birthdays";
import { displayName } from "@/lib/db-client";
import type { Person } from "@/types/family";

function plCount(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return `${n} ${one}`;
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} ${few}`;
  }
  return `${n} ${many}`;
}

function OccasionPeople({ entry }: { entry: OccasionEntry }) {
  return (
    <>
      <Link href={`/osoba/${entry.person.id}`}>{displayName(entry.person)}</Link>
      {entry.spouse ? (
        <>
          {" i "}
          <Link href={`/osoba/${entry.spouse.id}`}>
            {displayName(entry.spouse)}
          </Link>
        </>
      ) : null}
    </>
  );
}

function OccasionRow({
  entry,
  variant,
}: {
  entry: OccasionEntry;
  variant: "month" | "upcoming";
}) {
  const age = occasionAgeLabel(entry, variant);
  return (
    <li>
      <span className="birthdays-list__when">
        {variant === "upcoming"
          ? entry.daysUntil === 0
            ? "dziś"
            : entry.daysUntil === 1
              ? "jutro"
              : `za ${entry.daysUntil} dni`
          : `${entry.day} ${MONTH_NAMES_PL[entry.month]}`}
      </span>
      <span
        className={`birthdays-list__kind birthdays-list__kind--${entry.kind}`}
      >
        {entry.kind === "wedding" ? "ślub" : "urodziny"}
      </span>
      <OccasionPeople entry={entry} />
      {age && <span className="birthdays-list__age">{age}</span>}
      <Link
        className="btn-text"
        href={`/drzewo?hl=${encodeURIComponent(entry.person.id)}`}
      >
        drzewo
      </Link>
    </li>
  );
}

function BirthdaysInner({ people }: { people: Person[] }) {
  const now = new Date();
  const month = occasionsThisMonth(people, now);
  const upcoming = upcomingOccasions(people, 45, now);
  const birthdays = month.filter((e) => e.kind === "birthday").length;
  const weddings = month.filter((e) => e.kind === "wedding").length;

  return (
    <section className="birthdays-page">
      <header className="birthdays-page__intro">
        <h1>Urodziny i rocznice</h1>
        <p>
          W {MONTH_NAMES_PL[now.getMonth() + 1]}:{" "}
          {plCount(birthdays, "urodziny", "urodziny", "urodzin")} i{" "}
          {plCount(weddings, "rocznica ślubu", "rocznice ślubu", "rocznic ślubu")}
          .
        </p>
      </header>

      <div className="birthdays-section">
        <h2>W tym miesiącu</h2>
        {month.length === 0 ? (
          <p className="empty-hint">Brak urodzin i rocznic w tym miesiącu.</p>
        ) : (
          <ul className="birthdays-list">
            {month.map((e) => (
              <OccasionRow key={e.key} entry={e} variant="month" />
            ))}
          </ul>
        )}
      </div>

      <div className="birthdays-section">
        <h2>Najbliższe 45 dni</h2>
        {upcoming.length === 0 ? (
          <p className="empty-hint">Brak urodzin i rocznic w najbliższych 45 dniach.</p>
        ) : (
          <ul className="birthdays-list">
            {upcoming.map((e) => (
              <OccasionRow key={`u-${e.key}`} entry={e} variant="upcoming" />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function BirthdaysPageClient() {
  return (
    <AuthedPage>
      {({ people }) => <BirthdaysInner people={people} />}
    </AuthedPage>
  );
}
