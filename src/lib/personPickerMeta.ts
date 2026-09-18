import { formatPolishDate } from "@/lib/db-client";
import { generationTrunkHint } from "@/lib/chartOverview";
import { meetingLineHint } from "@/lib/meetingBranches";
import { childOfParentsHint } from "@/lib/personIdentity";
import type { Person } from "@/types/family";

/** Drugi wiersz w liście wyników wyszukiwania osoby — bez powtórzeń. */
export function personPickerSubline(person: Person, people: Person[]): string {
  const birth = formatPolishDate(person.birthDate);
  const death = formatPolishDate(person.deathDate);
  const trunk = generationTrunkHint(person.id, people);
  return [
    trunk,
    trunk ? "" : meetingLineHint(person.id, people),
    childOfParentsHint(person, people),
    birth ? `ur. ${birth}` : "",
    death ? `zm. ${death}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
