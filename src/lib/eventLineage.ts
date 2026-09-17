import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { getChildrenIds, getPersonMap } from "@/lib/tree";

/** Spotkanie jest głównie z linii Franciszka Potrykus. */
export const MEETING_LINE_ROOT_ID = "P060";
/** Helena Hallmann — „Babcia Helena”, córka Franciszka. */
export const MEETING_HELENA_ID = "P125";
/** Władysław Potrykus — „Władek”. */
export const MEETING_WLADEK_ID = "P270";

export type LineageVia = "blood" | "spouse" | "self";

export type PersonLineage =
  | { kind: "root"; via: LineageVia }
  | { kind: "branch"; branchId: string; via: LineageVia }
  | { kind: "outside" }
  | { kind: "unknown" };

export type LineageBranchRow = {
  id: string;
  name: string;
  highlight: "helena" | "wladek" | null;
  personCount: number;
  ticketCount: number;
  names: string[];
};

export type MeetingLineageSummary = {
  rootName: string;
  treePersonCount: number;
  ticketTotal: number;
  helena: LineageBranchRow | null;
  wladek: LineageBranchRow | null;
  rootCount: number;
  rootTicketCount: number;
  outsideCount: number;
  outsideTicketCount: number;
  outsideNames: string[];
  unmatchedTicketCount: number;
  unmatchedNameCount: number;
  branches: LineageBranchRow[];
};

type RsvpLike = {
  fullName: string;
  personId?: string;
  coveredPersonIds?: string[];
  guests: number;
  status?: string;
};

function rsvpPersonIds(rsvp: RsvpLike, knownIds: Set<string>): string[] {
  const ids: string[] = [];
  const add = (id?: string) => {
    if (!id || !knownIds.has(id) || ids.includes(id)) return;
    ids.push(id);
  };
  add(rsvp.personId);
  for (const id of rsvp.coveredPersonIds ?? []) add(id);
  return ids;
}

function preferBranch(
  a: string,
  b: string,
  childOrder: Map<string, number>,
): string {
  if (a === b) return a;
  if (a === MEETING_HELENA_ID) return a;
  if (b === MEETING_HELENA_ID) return b;
  if (a === MEETING_WLADEK_ID) return a;
  if (b === MEETING_WLADEK_ID) return b;
  const ia = childOrder.get(a) ?? 99;
  const ib = childOrder.get(b) ?? 99;
  if (ia !== ib) return ia < ib ? a : b;
  return a.localeCompare(b, "pl") < 0 ? a : b;
}

function findBloodTowardFranciszek(
  personId: string,
  map: Map<string, Person>,
  childIds: Set<string>,
  rootId: string,
  childOrder: Map<string, number>,
): Extract<PersonLineage, { kind: "root" } | { kind: "branch" }> | null {
  if (personId === rootId) return { kind: "root", via: "self" };
  const root = map.get(rootId);
  if (root?.spouseIds.includes(personId)) {
    return { kind: "root", via: "spouse" };
  }

  const seen = new Set<string>([personId]);
  const queue: { id: string; dist: number }[] = [{ id: personId, dist: 0 }];
  let best: { branchId: string; dist: number } | null = null;

  while (queue.length) {
    const cur = queue.shift()!;
    if (childIds.has(cur.id)) {
      if (
        !best ||
        cur.dist < best.dist ||
        (cur.dist === best.dist &&
          preferBranch(cur.id, best.branchId, childOrder) === cur.id)
      ) {
        best = { branchId: cur.id, dist: cur.dist };
      }
      continue;
    }
    const person = map.get(cur.id);
    if (!person) continue;
    for (const parentId of person.parentIds) {
      if (seen.has(parentId) || !map.has(parentId)) continue;
      seen.add(parentId);
      queue.push({ id: parentId, dist: cur.dist + 1 });
    }
  }

  if (!best) return null;
  const via: LineageVia = best.dist === 0 ? "self" : "blood";
  return { kind: "branch", branchId: best.branchId, via };
}

export function classifyPersonLineage(
  personId: string,
  people: Person[],
  rootId: string = MEETING_LINE_ROOT_ID,
): PersonLineage {
  const map = getPersonMap(people);
  if (!map.has(personId)) return { kind: "unknown" };

  const childIdsList = getChildrenIds(people, rootId);
  const childIds = new Set(childIdsList);
  const childOrder = new Map(childIdsList.map((id, i) => [id, i]));

  const blood = findBloodTowardFranciszek(
    personId,
    map,
    childIds,
    rootId,
    childOrder,
  );
  if (blood) return blood;

  const person = map.get(personId)!;
  let bestSpouse: PersonLineage | null = null;
  for (const spouseId of person.spouseIds) {
    const viaSpouse = findBloodTowardFranciszek(
      spouseId,
      map,
      childIds,
      rootId,
      childOrder,
    );
    if (!viaSpouse) continue;
    if (!bestSpouse) {
      bestSpouse = { ...viaSpouse, via: "spouse" };
      continue;
    }
    if (
      bestSpouse.kind === "branch" &&
      viaSpouse.kind === "branch" &&
      preferBranch(viaSpouse.branchId, bestSpouse.branchId, childOrder) ===
        viaSpouse.branchId
    ) {
      bestSpouse = { ...viaSpouse, via: "spouse" };
    }
  }
  if (bestSpouse) return bestSpouse;
  return { kind: "outside" };
}

function emptyBranch(person: Person, people: Person[]): LineageBranchRow {
  const highlight =
    person.id === MEETING_HELENA_ID
      ? "helena"
      : person.id === MEETING_WLADEK_ID
        ? "wladek"
        : null;
  return {
    id: person.id,
    name: displayName(person, people),
    highlight,
    personCount: 0,
    ticketCount: 0,
    names: [],
  };
}

function addPersonToBucket(
  row: { personCount: number; names: string[] },
  name: string,
) {
  row.personCount += 1;
  if (!row.names.includes(name)) row.names.push(name);
}

function collectAttendingIds(rsvps: RsvpLike[], knownIds: Set<string>): string[] {
  const attending = new Set<string>();
  for (const rsvp of rsvps) {
    for (const id of rsvpPersonIds(rsvp, knownIds)) attending.add(id);
  }
  return [...attending];
}

export function summarizeMeetingLineage(
  people: Person[],
  rsvps: RsvpLike[],
  rootId: string = MEETING_LINE_ROOT_ID,
): MeetingLineageSummary {
  const map = getPersonMap(people);
  const root = map.get(rootId);
  const rootName = root ? displayName(root, people) : "Franciszek Potrykus";
  const branches = getChildrenIds(people, rootId)
    .map((id) => map.get(id))
    .filter((p): p is Person => Boolean(p))
    .map((p) => emptyBranch(p, people));
  const byBranch = new Map(branches.map((b) => [b.id, b]));

  const active = rsvps.filter((r) => r.status !== "cancelled");
  const knownIds = new Set(people.map((p) => p.id));
  const attendingIds = collectAttendingIds(active, knownIds);
  const classified = new Map<string, PersonLineage>();
  for (const id of attendingIds) {
    classified.set(id, classifyPersonLineage(id, people, rootId));
  }

  let rootCount = 0;
  let outsideCount = 0;
  const outsideNames: string[] = [];

  for (const id of attendingIds) {
    const person = map.get(id);
    const name = person ? displayName(person, people) : id;
    const lineage = classified.get(id) ?? { kind: "unknown" as const };
    if (lineage.kind === "branch") {
      const row = byBranch.get(lineage.branchId);
      if (row) addPersonToBucket(row, name);
    } else if (lineage.kind === "root") {
      rootCount += 1;
    } else {
      outsideCount += 1;
      outsideNames.push(name);
    }
  }

  let unmatchedTicketCount = 0;
  let unmatchedNameCount = 0;
  let rootTicketCount = 0;
  let outsideTicketCount = 0;
  const seenUnmatchedNames = new Set<string>();

  for (const rsvp of active) {
    const ids = rsvpPersonIds(rsvp, knownIds);
    const guests = rsvp.guests || 1;
    if (ids.length === 0) {
      unmatchedTicketCount += guests;
      const key = rsvp.fullName.trim().toLowerCase();
      if (key && !seenUnmatchedNames.has(key)) {
        seenUnmatchedNames.add(key);
        unmatchedNameCount += 1;
      }
      continue;
    }

    const ticketByBranch = new Map<string, number>();
    let ticketsRoot = 0;
    let ticketsOutside = 0;
    for (const id of ids) {
      const lineage =
        classified.get(id) ?? classifyPersonLineage(id, people, rootId);
      classified.set(id, lineage);
      if (lineage.kind === "branch") {
        ticketByBranch.set(
          lineage.branchId,
          (ticketByBranch.get(lineage.branchId) ?? 0) + 1,
        );
      } else if (lineage.kind === "root") {
        ticketsRoot += 1;
      } else {
        ticketsOutside += 1;
      }
    }

    const assigned = ids.length;
    const leftover = Math.max(0, guests - assigned);
    if (leftover > 0) {
      if (ticketByBranch.size) {
        let topId = [...ticketByBranch.keys()][0]!;
        let top = ticketByBranch.get(topId) ?? 0;
        for (const [id, n] of ticketByBranch) {
          if (n > top) {
            top = n;
            topId = id;
          }
        }
        ticketByBranch.set(topId, (ticketByBranch.get(topId) ?? 0) + leftover);
      } else if (ticketsRoot > 0) {
        ticketsRoot += leftover;
      } else if (ticketsOutside > 0) {
        ticketsOutside += leftover;
      } else {
        unmatchedTicketCount += leftover;
      }
    }

    for (const [id, n] of ticketByBranch) {
      const row = byBranch.get(id);
      if (row) row.ticketCount += n;
    }
    rootTicketCount += ticketsRoot;
    outsideTicketCount += ticketsOutside;
  }

  for (const row of branches) {
    row.names.sort((a, b) => a.localeCompare(b, "pl"));
  }

  const helena = byBranch.get(MEETING_HELENA_ID) ?? null;
  const wladek = byBranch.get(MEETING_WLADEK_ID) ?? null;
  const ticketTotal = active.reduce((sum, r) => sum + (r.guests || 1), 0);

  return {
    rootName,
    treePersonCount: attendingIds.length,
    ticketTotal,
    helena,
    wladek,
    rootCount,
    rootTicketCount,
    outsideCount,
    outsideTicketCount,
    outsideNames: outsideNames.sort((a, b) => a.localeCompare(b, "pl")),
    unmatchedTicketCount,
    unmatchedNameCount,
    branches,
  };
}

export function lineageLabel(lineage: PersonLineage, people: Person[]): string {
  if (lineage.kind === "root") return "linia Franciszka (on / Helena Gurska)";
  if (lineage.kind === "outside") return "poza linią Franciszka";
  if (lineage.kind === "unknown") return "brak osoby w drzewie";
  const person = people.find((p) => p.id === lineage.branchId);
  const name = person ? displayName(person, people) : lineage.branchId;
  if (lineage.branchId === MEETING_HELENA_ID) {
    return `od Babci Heleny (${name})`;
  }
  if (lineage.branchId === MEETING_WLADEK_ID) {
    return `od Władka (${name})`;
  }
  return `od: ${name}`;
}
