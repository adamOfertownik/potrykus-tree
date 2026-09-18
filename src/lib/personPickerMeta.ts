import { formatPolishDate } from "@/lib/db-client";
import { personSearchMeta } from "@/lib/meetingBranches";
import { childOfParentHint } from "@/lib/personIdentity";
import type { Person } from "@/types/family";

/** Drugi wiersz w liście wyników wyszukiwania osoby. */
export function personPickerSubline(person: Person, people: Person[]): string {
  const birth = formatPolishDate(person.birthDate);
  const death = formatPolishDate(person.deathDate);
  return [
    personSearchMeta(person, people),
    childOfParentHint(person, people),
    birth ? `ur. ${birth}` : "",
    death ? `zm. ${death}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
