import type { Person } from "@/types/family";
import { findApexPersonId, getPersonMap, getUnionChildrenIds } from "@/lib/tree";

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
  /** Outside the main blood line (missing parent link in the database) */
  detached?: boolean;
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

  const childIds = getUnionChildrenIds(
    people,
    rootId,
    spouses.map((s) => s.id),
  );

  spouses.forEach((spouse, i) => {
    entries.push({
      generation,
      person: spouse,
      isSpouse: true,
      depth: depth + 0.5,
      railDepth: depth,
      isLast: i === spouses.length - 1 && childIds.length === 0,
      ancestorLast: [...ancestorLast],
    });
  });
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

function comparePeople(a: Person, b: Person): number {
  const byBirth = (a.birthDate || "").localeCompare(b.birthDate || "", "pl");
  if (byBirth) return byBirth;
  return `${a.lastName} ${a.firstName}`.localeCompare(
    `${b.lastName} ${b.firstName}`,
    "pl",
  );
}

function hasKnownParent(person: Person, ids: Set<string>): boolean {
  return person.parentIds.some((id) => ids.has(id));
}

/**
 * Full family list from the same Neon people as the tree.
 * One main trunk from the genealogical apex (generation 1 = oldest ancestor),
 * then leftover people who are in the database but not linked to that trunk.
 */
export function buildCompleteFamilyList(
  people: Person[],
  preferredRootId?: string,
): ListEntry[] {
  if (!people.length) return [];
  const startId =
    preferredRootId && people.some((p) => p.id === preferredRootId)
      ? preferredRootId
      : people[0]!.id;
  const apexId = findApexPersonId(people, startId);
  const visited = new Set<string>();
  const main = buildDescendantList(people, apexId, 1, 0, visited);
  const shown = new Set(main.map((e) => e.person.id));

  const leftover = people.filter((p) => !shown.has(p.id));
  const leftoverIds = new Set(leftover.map((p) => p.id));
  const leftoverRoots = leftover
    .filter((p) => !hasKnownParent(p, leftoverIds))
    .sort(comparePeople);

  const detached: ListEntry[] = [];
  for (const person of leftoverRoots) {
    if (shown.has(person.id)) continue;
    const branch = buildDescendantList(people, person.id, 1, 0, visited);
    for (const entry of branch) {
      entry.detached = true;
      shown.add(entry.person.id);
    }
    detached.push(...branch);
  }

  const stillMissing = people.filter((p) => !shown.has(p.id)).sort(comparePeople);
  for (const person of stillMissing) {
    const branch = buildDescendantList(people, person.id, 1, 0, visited);
    for (const entry of branch) {
      entry.detached = true;
      shown.add(entry.person.id);
    }
    detached.push(...branch);
  }

  return [...main, ...detached];
}

/** True when the person sits on the apex trunk (including spouses), not in leftovers. */
export function isOnMainFamilyTree(
  people: Person[],
  personId: string,
  preferredRootId?: string,
): boolean {
  if (!people.length || !people.some((p) => p.id === personId)) return false;
  const startId =
    preferredRootId && people.some((p) => p.id === preferredRootId)
      ? preferredRootId
      : people[0]!.id;
  const apexId = findApexPersonId(people, startId);
  const main = buildDescendantList(people, apexId, 1, 0, new Set());
  return main.some((entry) => entry.person.id === personId);
}
