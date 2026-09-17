import type { Person, PersonPublic } from "@/types/family";

export function withChildrenIds(people: Person[]): PersonPublic[] {
  return people.map((p) => ({
    ...p,
    childrenIds: getChildrenIds(people, p.id),
  }));
}

/** Oldest first. Missing birth date goes last; then name, then id. */
export function comparePeopleByBirth(
  a: { id?: string; firstName?: string; lastName?: string; birthDate?: string },
  b: { id?: string; firstName?: string; lastName?: string; birthDate?: string },
): number {
  const aDate = a.birthDate?.trim() ?? "";
  const bDate = b.birthDate?.trim() ?? "";
  if (aDate !== bDate) {
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  }
  const aName = `${a.lastName ?? ""} ${a.firstName ?? ""}`;
  const bName = `${b.lastName ?? ""} ${b.firstName ?? ""}`;
  const byName = aName.localeCompare(bName, "pl");
  if (byName !== 0) return byName;
  return (a.id ?? "").localeCompare(b.id ?? "", "pl");
}

export function getChildrenIds(people: Person[], personId: string): string[] {
  return people
    .filter((p) => p.parentIds.includes(personId))
    .sort(comparePeopleByBirth)
    .map((p) => p.id);
}

/** Children of a person and of their listed spouses (union), stable order. */
export function getUnionChildrenIds(
  people: Person[],
  personId: string,
  spouseIds: string[] = [],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of [personId, ...spouseIds]) {
    for (const childId of getChildrenIds(people, id)) {
      if (seen.has(childId) || childId === personId) continue;
      seen.add(childId);
      ids.push(childId);
    }
  }
  return ids
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p))
    .sort(comparePeopleByBirth)
    .map((p) => p.id);
}

export function getPersonMap(people: Person[]): Map<string, Person> {
  return new Map(people.map((p) => [p.id, p]));
}

function countBloodRelatives(people: Person[], rootId: string): number {
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const childId of getChildrenIds(people, id)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      queue.push(childId);
    }
  }
  return seen.size;
}

/**
 * Oldest progenitor of `startId` whose descendant tree covers the most people.
 * family-chart hides siblings of `main` unless they sit below the root as children,
 * so the default view must start at this apex — not at meta.rootPersonId.
 */
export function findApexPersonId(
  people: Person[],
  startId: string,
): string {
  const map = getPersonMap(people);
  if (!map.has(startId)) return people[0]?.id ?? startId;

  const ancestorIds = new Set<string>();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop()!;
    if (ancestorIds.has(id)) continue;
    ancestorIds.add(id);
    const person = map.get(id);
    if (!person) continue;
    for (const parentId of person.parentIds) {
      if (map.has(parentId)) stack.push(parentId);
    }
  }

  const progenitors = [...ancestorIds].filter((id) => {
    const person = map.get(id);
    if (!person) return false;
    return !person.parentIds.some((pid) => map.has(pid));
  });
  if (!progenitors.length) return startId;

  const start = map.get(startId);
  const ranked = progenitors.map((id) => ({
    id,
    relatives: countBloodRelatives(people, id),
    sameName: start && map.get(id)?.lastName === start.lastName ? 1 : 0,
  }));
  ranked.sort((a, b) => {
    if (b.relatives !== a.relatives) return b.relatives - a.relatives;
    if (b.sameName !== a.sameName) return b.sameName - a.sameName;
    return a.id.localeCompare(b.id);
  });
  return ranked[0]!.id;
}

export interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
}

/** Build a descendant tree starting from root (blood line through parentIds). */
export function buildDescendantTree(
  people: Person[],
  rootId: string,
  visited = new Set<string>(),
): TreeNode | null {
  const map = getPersonMap(people);
  const person = map.get(rootId);
  if (!person || visited.has(rootId)) return null;
  visited.add(rootId);

  const spouses = person.spouseIds
    .map((id) => map.get(id))
    .filter((p): p is Person => Boolean(p));

  const childIds = getChildrenIds(people, rootId);
  const children = childIds
    .map((id) => buildDescendantTree(people, id, visited))
    .filter((n): n is TreeNode => Boolean(n));

  return { person, spouses, children };
}
