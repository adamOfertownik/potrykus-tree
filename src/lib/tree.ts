import type { Person } from "@/types/family";

export function getChildrenIds(people: Person[], personId: string): string[] {
  return people
    .filter((p) => p.parentIds.includes(personId))
    .map((p) => p.id);
}

export function getPersonMap(people: Person[]): Map<string, Person> {
  return new Map(people.map((p) => [p.id, p]));
}

export interface TreeNode {
  person: Person;
  spouses: Person[];
  children: TreeNode[];
}

export interface ListEntry {
  generation: number;
  person: Person;
  isSpouse: boolean;
  depth: number;
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

/** Flat indented list like the printed genealogical documents. */
export function buildDescendantList(
  people: Person[],
  rootId: string,
  generation = 1,
  depth = 0,
  visited = new Set<string>(),
): ListEntry[] {
  const map = getPersonMap(people);
  const person = map.get(rootId);
  if (!person || visited.has(rootId)) return [];
  visited.add(rootId);

  const entries: ListEntry[] = [
    { generation, person, isSpouse: false, depth },
  ];

  for (const spouseId of person.spouseIds) {
    const spouse = map.get(spouseId);
    if (!spouse) continue;
    entries.push({
      generation,
      person: spouse,
      isSpouse: true,
      depth: depth + 0.5,
    });
  }

  const childIds = getChildrenIds(people, rootId);
  for (const childId of childIds) {
    entries.push(
      ...buildDescendantList(
        people,
        childId,
        generation + 1,
        depth + 1,
        visited,
      ),
    );
  }

  return entries;
}

export function searchPeople(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter((p) => {
    const hay = [
      p.firstName,
      p.lastName,
      p.maidenName ?? "",
      p.notes ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
