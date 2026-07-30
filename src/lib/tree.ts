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

export type { ListEntry } from "@/lib/list";
export { buildDescendantList } from "@/lib/list";
export { searchPeople } from "@/lib/search";

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
