import type { Person } from "@/types/family";
import { getChildrenIds, getPersonMap } from "@/lib/tree";

export interface ListEntry {
  generation: number;
  person: Person;
  isSpouse: boolean;
  depth: number;
  /** Integer depth for nesting rails (spouses share parent depth+0 visually) */
  railDepth: number;
  isLast: boolean;
  /** Ancestor last-flags for drawing vertical rails */
  ancestorLast: boolean[];
}

/** Flat indented list like the printed genealogical documents. */
export function buildDescendantList(
  people: Person[],
  rootId: string,
  generation = 1,
  depth = 0,
  visited = new Set<string>(),
  ancestorLast: boolean[] = [],
): ListEntry[] {
  const map = getPersonMap(people);
  const person = map.get(rootId);
  if (!person || visited.has(rootId)) return [];
  visited.add(rootId);

  const entries: ListEntry[] = [
    {
      generation,
      person,
      isSpouse: false,
      depth,
      railDepth: depth,
      isLast: false, // filled by parent when siblings known
      ancestorLast: [...ancestorLast],
    },
  ];

  const spouses = person.spouseIds
    .map((id) => map.get(id))
    .filter((p): p is Person => Boolean(p));

  spouses.forEach((spouse, i) => {
    visited.add(spouse.id);
    entries.push({
      generation,
      person: spouse,
      isSpouse: true,
      depth: depth + 0.5,
      railDepth: depth,
      isLast: i === spouses.length - 1 && getChildrenIds(people, rootId).length === 0,
      ancestorLast: [...ancestorLast],
    });
  });

  const childIds = getChildrenIds(people, rootId);
  childIds.forEach((childId, index) => {
    const isLast = index === childIds.length - 1;
    const childEntries = buildDescendantList(
      people,
      childId,
      generation + 1,
      depth + 1,
      visited,
      [...ancestorLast, isLast],
    );
    if (childEntries[0]) {
      childEntries[0].isLast = isLast;
    }
    entries.push(...childEntries);
  });

  // Mark root as last at its level
  if (entries[0] && depth === 0) entries[0].isLast = true;

  return entries;
}

function personSortKey(id: string): number {
  const n = Number(String(id).replace(/^P/i, ""));
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Parentless people, oldest IDs first — same tops as the graph. */
export function forestRootIds(people: Person[]): string[] {
  return people
    .filter((p) => p.parentIds.length === 0)
    .map((p) => p.id)
    .sort((a, b) => personSortKey(a) - personSortKey(b));
}

/**
 * Full family list: every disconnected root (np. Grabaczowie, Sadachowie),
 * without repeating people already shown as child or spouse.
 */
export function buildFamilyForestList(people: Person[]): ListEntry[] {
  const visited = new Set<string>();
  const out: ListEntry[] = [];
  for (const id of forestRootIds(people)) {
    if (visited.has(id)) continue;
    out.push(...buildDescendantList(people, id, 1, 0, visited));
  }
  for (const p of people) {
    if (visited.has(p.id)) continue;
    out.push(...buildDescendantList(people, p.id, 1, 0, visited));
  }
  return out;
}
