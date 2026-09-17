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
  const name = displayName(person);

  const genderClass =
    person.gender === "male"
      ? "person-card--male"
      : person.gender === "female"
        ? "person-card--female"
        : "person-card--unknown";

  const inner = (
    <>
      <PersonPhotoControl person={person} size={compact ? "sm" : "md"} />
      <div className="person-card__body">
        <p className="person-card__name">{name}</p>
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
      <Link
        href={href}
        className={className}
        aria-label={`Otwórz: ${name}`}
        onClick={onClick}
      >
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {inner}
      </button>
    );
  }

  return <div className={className}>{inner}</div>;
}
