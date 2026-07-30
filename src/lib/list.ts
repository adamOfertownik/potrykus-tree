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
