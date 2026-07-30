import type { Person } from "@/types/family";
import type { Data } from "family-chart";
import { getChildrenIds } from "@/lib/tree";

export function peopleToFamilyChartData(people: Person[]): Data {
  const ids = new Set(people.map((p) => p.id));

  return people.map((p) => {
    const parents = p.parentIds.filter((id) => ids.has(id));
    const spouses = p.spouseIds.filter((id) => ids.has(id));
    const children = getChildrenIds(people, p.id).filter((id) => ids.has(id));

    return {
      id: p.id,
      data: {
        gender: (p.gender === "female" ? "F" : "M") as "M" | "F",
        "first name": p.firstName,
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
