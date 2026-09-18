import type { Person } from "@/types/family";
import type { Data } from "family-chart";
import { comparePeopleByBirth } from "@/lib/tree";
import { unnamedSiblingOrdinal } from "@/lib/db-client";

function arePartners(a: Person, b: Person): boolean {
  return a.spouseIds.includes(b.id) || b.spouseIds.includes(a.id);
}

/**
 * family-chart draws the same person ×2 when two listed parents are not a
 * couple (e.g. siblings Tola and Milo). Keep at most one parental union.
 */
export function chartParentIds(
  person: Person,
  byId: Map<string, Person>,
): string[] {
  const parents = person.parentIds
    .map((id) => byId.get(id))
    .filter((p): p is Person => Boolean(p));
  if (parents.length <= 1) return parents.map((p) => p.id);

  for (let i = 0; i < parents.length; i++) {
    for (let j = i + 1; j < parents.length; j++) {
      const left = parents[i]!;
      const right = parents[j]!;
      if (arePartners(left, right)) return [left.id, right.id];
    }
  }

  return [parents[0]!.id];
}

export function peopleToFamilyChartData(people: Person[]): Data {
  const ids = new Set(people.map((p) => p.id));
  const byId = new Map(people.map((p) => [p.id, p]));
  const parentsByChild = new Map(
    people.map((p) => [p.id, chartParentIds(p, byId)] as const),
  );
  const childrenByParent = new Map<string, string[]>();
  for (const person of people) {
    for (const parentId of parentsByChild.get(person.id) ?? []) {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(person.id);
      childrenByParent.set(parentId, list);
    }
  }

  return people.map((p) => {
    const parents = (parentsByChild.get(p.id) ?? []).filter((id) => ids.has(id));
    const spouses = p.spouseIds.filter((id) => ids.has(id));
    const children = (childrenByParent.get(p.id) ?? [])
      .filter((id) => ids.has(id))
      .map((id) => byId.get(id))
      .filter((child): child is Person => Boolean(child))
      .sort(comparePeopleByBirth)
      .map((child) => child.id);

    return {
      id: p.id,
      data: {
        gender: (p.gender === "female" ? "F" : "M") as "M" | "F",
        "first name": (() => {
          const ordinal = unnamedSiblingOrdinal(p, people);
          return ordinal ? `NN ${ordinal.index}/${ordinal.total}` : p.firstName;
        })(),
        "last name": p.lastName,
        ...(p.birthDate ? { birthday: p.birthDate } : {}),
        ...(p.deathDate ? { death: p.deathDate } : {}),
        ...(p.photoUrl ? { avatar: p.photoUrl } : {}),
        ...(p.maidenName ? { maiden: `z d. ${p.maidenName}` } : {}),
      },
      rels: {
        parents,
        spouses,
        children,
      },
    };
  });
}
