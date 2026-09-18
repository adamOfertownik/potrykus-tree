import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { getPersonMap } from "@/lib/tree";

/** Prefer the father; if missing, the first listed parent. */
export function fatherOf(
  person: Person,
  people: Person[],
): Person | null {
  const map = getPersonMap(people);
  const parents = person.parentIds
    .map((id) => map.get(id))
    .filter((p): p is Person => Boolean(p));
  return parents.find((p) => p.gender === "male") ?? parents[0] ?? null;
}

export function childOfParentHint(
  person: Person,
  people: Person[],
): string {
  const father = fatherOf(person, people);
  if (!father) return "";
  const rel =
    person.gender === "female"
      ? "córka"
      : person.gender === "male"
        ? "syn"
        : "dziecko";
  return `${rel} ${father.firstName}`;
}

/** Search/picker label: "Adam Lieske · syn Jan". */
export function identityChoiceLabel(
  person: Person,
  people: Person[],
): string {
  const name = displayName(person, people);
  const hint = childOfParentHint(person, people);
  return hint ? `${name} · ${hint}` : name;
}
