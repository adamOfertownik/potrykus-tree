import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { getPersonMap } from "@/lib/tree";

/** Rough Polish genitive for a given name (Jan → Jana, Maria → Marii). */
export function givenNameGenitive(name: string): string {
  const raw = name.trim();
  if (!raw) return raw;
  if (raw.includes(" ")) {
    return raw.split(/\s+/).map(givenNameGenitive).join(" ");
  }
  const lower = raw.toLowerCase();
  if (lower.endsWith("ia")) return `${raw.slice(0, -1)}i`;
  if (lower.endsWith("a")) return `${raw.slice(0, -1)}y`;
  if (lower.endsWith("ek")) return `${raw.slice(0, -2)}ka`;
  if (lower.endsWith("iec")) return `${raw.slice(0, -3)}ca`;
  if (lower.endsWith("i") || lower.endsWith("y")) return `${raw}ego`;
  return `${raw}a`;
}

export function parentsOf(
  person: Person,
  people: Person[],
): { father: Person | null; mother: Person | null } {
  const map = getPersonMap(people);
  const parents = person.parentIds
    .map((id) => map.get(id))
    .filter((p): p is Person => Boolean(p));
  return {
    father: parents.find((p) => p.gender === "male") ?? null,
    mother: parents.find((p) => p.gender === "female") ?? null,
  };
}

/** Prefer the father; if missing, the first listed parent. */
export function fatherOf(
  person: Person,
  people: Person[],
): Person | null {
  const { father, mother } = parentsOf(person, people);
  if (father) return father;
  const map = getPersonMap(people);
  return (
    person.parentIds.map((id) => map.get(id)).find((p): p is Person => Boolean(p)) ??
    mother
  );
}

function childWord(person: Person): "syn" | "córka" | "dziecko" {
  if (person.gender === "female") return "córka";
  if (person.gender === "male") return "syn";
  return "dziecko";
}

/** "syn Brunona i Marii" — both parents when known, no duplicate. */
export function childOfParentsHint(
  person: Person,
  people: Person[],
): string {
  const { father, mother } = parentsOf(person, people);
  const names = [father, mother]
    .filter((p): p is Person => Boolean(p))
    .map((p) => givenNameGenitive(p.firstName.trim() || displayName(p, people)));
  if (!names.length) return "";
  const rel = childWord(person);
  if (names.length === 1) return `${rel} ${names[0]}`;
  return `${rel} ${names[0]} i ${names[1]}`;
}

/** @deprecated use childOfParentsHint */
export function childOfParentHint(
  person: Person,
  people: Person[],
): string {
  return childOfParentsHint(person, people);
}

/** Search/picker label: "Adam Lieske · syn Brunona i Marii". */
export function identityChoiceLabel(
  person: Person,
  people: Person[],
): string {
  const name = displayName(person, people);
  const hint = childOfParentsHint(person, people);
  return hint ? `${name} · ${hint}` : name;
}
