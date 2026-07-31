"use client";

import Link from "next/link";
import type { Person } from "@/types/family";
import { displayName, formatPolishDate } from "@/lib/db-client";

type Props = {
  person: Person;
  compact?: boolean;
  href?: string;
  onClick?: () => void;
};

export function PersonCard({ person, compact, href, onClick }: Props) {
  const birth = formatPolishDate(person.birthDate);
  const death = formatPolishDate(person.deathDate);
  const dates =
    birth && death ? `${birth} – ${death}` : birth ? birth : death ? `† ${death}` : "";

  const genderClass =
    person.gender === "male"
      ? "person-card--male"
      : person.gender === "female"
        ? "person-card--female"
        : "person-card--unknown";

  const content = (
    <>
      <div className="person-card__avatar" aria-hidden>
        {person.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
            <img src={person.photoUrl} alt={displayName(person)} />
        ) : (
          <span className="person-card__silhouette" />
        )}
      </div>
      <div className="person-card__body">
        <p className="person-card__name">{displayName(person)}</p>
        {dates && <p className="person-card__dates">{dates}</p>}
        {!compact && person.maidenName && (
          <p className="person-card__meta">z d. {person.maidenName}</p>
        )}
      </div>
      <span className="person-card__gender-mark" aria-hidden />
    </>
  );

  const className = `person-card ${genderClass}${compact ? " person-card--compact" : ""}`;

  if (href) {
    return (
      <Link href={href} className={className} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick}>
      {content}
    </button>
  );
}
