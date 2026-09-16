"use client";

import Link from "next/link";
import type { Person } from "@/types/family";
import { displayName, formatPolishDate } from "@/lib/db-client";
import { PersonPhotoControl } from "@/components/PersonPhotoControl";

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

  const body = (
    <>
      <p className="person-card__name">{displayName(person)}</p>
      {dates && <p className="person-card__dates">{dates}</p>}
      {!compact && person.maidenName && (
        <p className="person-card__meta">z d. {person.maidenName}</p>
      )}
    </>
  );

  const className = `person-card ${genderClass}${compact ? " person-card--compact" : ""}`;

  return (
    <div className={className}>
      <PersonPhotoControl person={person} size={compact ? "sm" : "md"} />
      {href ? (
        <Link href={href} className="person-card__body" onClick={onClick}>
          {body}
        </Link>
      ) : (
        <button type="button" className="person-card__body" onClick={onClick}>
          {body}
        </button>
      )}
      <span className="person-card__gender-mark" aria-hidden />
    </div>
  );
}
