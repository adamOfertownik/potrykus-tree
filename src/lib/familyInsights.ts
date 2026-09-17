import type { Person } from "@/types/family";
import { displayName, isUnnamedPerson } from "@/lib/db-client";
import {
  attributeMeetingBranch,
  groupAttendingByMeetingBranch,
  groupFamilyByMeetingBranch,
  type MeetingBranch,
} from "@/lib/meetingBranches";
import { getChildrenIds } from "@/lib/tree";

export type NameCount = { name: string; count: number };

export type RankedPerson = {
  id: string;
  name: string;
  detail: string;
  sort: number;
};

export type CrossMarriage = {
  a: string;
  b: string;
  count: number;
};

export type FamilyInsights = {
  total: number;
  inFranciszekLine: number;
  living: number;
  deceased: number;
  withPhoto: number;
  withPhone: number;
  couples: number;
  branches: MeetingBranch[];
  livingByBranch: {
    key: string;
    label: string;
    featured: boolean;
    living: number;
    total: number;
    going: number;
  }[];
  topFirstNames: NameCount[];
  topLastNames: NameCount[];
  mostChildren: RankedPerson[];
  oldestLiving: RankedPerson[];
  longestLived: RankedPerson[];
  crossMarriages: CrossMarriage[];
};

function parseYear(iso?: string): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) && y > 1000 ? y : null;
}

function ageYears(fromIso: string, toIso?: string): number | null {
  const from = parseYear(fromIso);
  const to = toIso ? parseYear(toIso) : new Date().getFullYear();
  if (from == null || to == null || to < from) return null;
  return to - from;
}

function isLiving(person: Person): boolean {
  return !person.deathDate?.trim();
}

function bump(map: Map<string, number>, key: string) {
  const k = key.trim();
  if (!k) return;
  map.set(k, (map.get(k) ?? 0) + 1);
}

function topMap(map: Map<string, number>, limit: number): NameCount[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function bySortThenName(a: RankedPerson, b: RankedPerson) {
  if (b.sort !== a.sort) return b.sort - a.sort;
  return a.name.localeCompare(b.name, "pl");
}

export function buildFamilyInsights(
  people: Person[],
  attendingPersonIds: string[] = [],
): FamilyInsights {
  const branches = groupFamilyByMeetingBranch(people);
  const goingByKey = new Map(
    groupAttendingByMeetingBranch(people, attendingPersonIds).map((row) => [
      row.key,
      row.personIds.length,
    ]),
  );
  const byId = new Map(people.map((p) => [p.id, p]));
  const inLine = people.filter(
    (p) => attributeMeetingBranch(p.id, people).kind !== "outside",
  );
  const firstNames = new Map<string, number>();
  const lastNames = new Map<string, number>();
  const mostChildren: RankedPerson[] = [];
  const oldestLiving: RankedPerson[] = [];
  const longestLived: RankedPerson[] = [];
  const pairCounts = new Map<string, CrossMarriage>();
  const seenCouples = new Set<string>();
  let couples = 0;

  for (const person of people) {
    if (!isUnnamedPerson(person)) bump(firstNames, person.firstName);
    if (person.lastName.trim()) bump(lastNames, person.lastName);

    const kids = getChildrenIds(people, person.id).length;
    if (kids >= 3) {
      mostChildren.push({
        id: person.id,
        name: displayName(person, people),
        detail: `${kids} ${kids === 1 ? "dziecko" : "dzieci"}`,
        sort: kids,
      });
    }

    if (isLiving(person) && person.birthDate) {
      const age = ageYears(person.birthDate);
      if (age != null && age >= 70) {
        oldestLiving.push({
          id: person.id,
          name: displayName(person, people),
          detail: `ok. ${age} lat`,
          sort: age,
        });
      }
    }

    if (person.birthDate && person.deathDate) {
      const age = ageYears(person.birthDate, person.deathDate);
      if (age != null && age >= 80) {
        longestLived.push({
          id: person.id,
          name: displayName(person, people),
          detail: `${age} lat`,
          sort: age,
        });
      }
    }

    for (const spouseId of person.spouseIds) {
      if (spouseId <= person.id) continue;
      const pair = [person.id, spouseId].sort().join(":");
      if (seenCouples.has(pair)) continue;
      seenCouples.add(pair);
      couples += 1;
      const a = attributeMeetingBranch(person.id, people);
      const b = attributeMeetingBranch(spouseId, people);
      if (
        a.kind === "branch" &&
        b.kind === "branch" &&
        a.head &&
        b.head &&
        a.head.id !== b.head.id
      ) {
        const labels = [a.label, b.label].sort((x, y) =>
          x.localeCompare(y, "pl"),
        );
        const key = labels.join(" × ");
        const existing = pairCounts.get(key);
        if (existing) existing.count += 1;
        else pairCounts.set(key, { a: labels[0]!, b: labels[1]!, count: 1 });
      }
    }
  }

  const livingByBranch = branches.map((branch) => ({
    key: branch.key,
    label: branch.label,
    featured: branch.featured,
    total: branch.personIds.length,
    going: goingByKey.get(branch.key) ?? 0,
    living: branch.personIds.filter((id) => {
      const p = byId.get(id);
      return p ? isLiving(p) : false;
    }).length,
  }));

  return {
    total: people.length,
    inFranciszekLine: inLine.length,
    living: people.filter(isLiving).length,
    deceased: people.filter((p) => !isLiving(p)).length,
    withPhoto: people.filter((p) => Boolean(p.photoUrl)).length,
    withPhone: people.filter((p) => Boolean(p.phone?.trim())).length,
    couples,
    branches,
    livingByBranch,
    topFirstNames: topMap(firstNames, 8),
    topLastNames: topMap(lastNames, 8),
    mostChildren: mostChildren.sort(bySortThenName).slice(0, 8),
    oldestLiving: oldestLiving.sort(bySortThenName).slice(0, 8),
    longestLived: longestLived.sort(bySortThenName).slice(0, 8),
    crossMarriages: [...pairCounts.values()].sort(
      (a, b) => b.count - a.count || a.a.localeCompare(b.a, "pl"),
    ),
  };
}
