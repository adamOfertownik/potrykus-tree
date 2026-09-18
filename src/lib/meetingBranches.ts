import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { childOfParentsHint } from "@/lib/personIdentity";
import { comparePeopleByBirth, getChildrenIds, getPersonMap } from "@/lib/tree";

/** Główne spotkanie liczymy od Franciszka Potrykusa. */
export const MEETING_ROOT_ID = "P060";

/** Babcia Helena Hallmann z d. Potrykus */
export const HELENA_BRANCH_ID = "P125";

/** Dziadek Władysław „Władek” Potrykus */
export const WLADEK_BRANCH_ID = "P270";

export const MEETING_TREE_HREF = `/drzewo?root=${MEETING_ROOT_ID}`;

export type MeetingBranchKind = "root" | "branch" | "outside";

export type MeetingBranch = {
  key: string;
  kind: MeetingBranchKind;
  headId?: string;
  short: string;
  label: string;
  personIds: string[];
};

export function plPeople(n: number): string {
  const abs = Math.abs(n);
  if (abs === 1) return "1 osoba";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} osoby`;
  }
  return `${n} osób`;
}

function walkToChildOfRoot(
  people: Person[],
  startId: string,
  rootId: string,
): Person | null {
  const map = getPersonMap(people);
  const seen = new Set<string>();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const person = map.get(id);
    if (!person) continue;
    if (person.parentIds.includes(rootId)) return person;
    if (person.id === rootId) continue;
    for (const parentId of person.parentIds) {
      if (map.has(parentId)) queue.push(parentId);
    }
  }
  return null;
}

const BRANCH_NAMES: Record<string, { short: string; label: string }> = {
  P062: { short: "Rozalia", label: "od babci Rozalii" },
  P064: { short: "Jan", label: "od dziadka Jana" },
  P072: { short: "Franciszek", label: "od dziadka Franciszka" },
  [HELENA_BRANCH_ID]: { short: "Helena", label: "od babci Heleny" },
  P213: { short: "Bronisław", label: "od dziadka Bronisława" },
  P217: { short: "Antoni", label: "od dziadka Antoniego" },
  P240: { short: "Stanisław", label: "od dziadka Stanisława" },
  P255: { short: "Józef", label: "od dziadka Józefa" },
  [WLADEK_BRANCH_ID]: { short: "Władek", label: "od dziadka Władka" },
  P298: { short: "Walerian", label: "od dziadka Waleriana" },
};

/** Jak mówi rodzina: od Heleny, od Bronka… */
const LINE_COLLOQUIAL: Record<string, string> = {
  P062: "od Rozalii",
  P064: "od Jana",
  P072: "od Franciszka",
  [HELENA_BRANCH_ID]: "od Heleny",
  P213: "od Bronka",
  P217: "od Antoniego",
  P240: "od Stanisława",
  P255: "od Józefa",
  [WLADEK_BRANCH_ID]: "od Władka",
  P298: "od Waleriana",
};

/** Dodatkowe słowa w wyszukiwarce (np. „bronka” → linia Bronisława). */
const LINE_SEARCH_ALIASES: Record<string, string[]> = {
  [HELENA_BRANCH_ID]: ["heleny", "helena", "babcia helena"],
  P213: ["bronka", "bronislaw", "bronisława", "dziadek bronisław"],
  [WLADEK_BRANCH_ID]: ["wladek", "wladka", "władka"],
  P064: ["dziadek jan"],
  P072: ["franciszek", "franka"],
};

function branchNames(head: Person): { short: string; label: string } {
  const known = BRANCH_NAMES[head.id];
  if (known) return known;
  const first = head.firstName.trim() || "NN";
  if (head.gender === "female") {
    return { short: first, label: `od babci ${first}` };
  }
  return { short: first, label: `od dziadka ${first}` };
}

export function meetingLineHeads(people: Person[]): Person[] {
  return getChildrenIds(people, MEETING_ROOT_ID)
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p))
    .sort(comparePeopleByBirth);
}

export function attributeMeetingBranch(
  personId: string,
  people: Person[],
): {
  kind: MeetingBranchKind;
  head?: Person;
  short: string;
  label: string;
} {
  const map = getPersonMap(people);
  const person = map.get(personId);
  if (!person) {
    return { kind: "outside", short: "poza linią", label: "poza linią Franciszka" };
  }
  if (person.id === MEETING_ROOT_ID || person.spouseIds.includes(MEETING_ROOT_ID)) {
    return { kind: "root", short: "Franciszek", label: "pień Franciszka" };
  }

  const blood = walkToChildOfRoot(people, personId, MEETING_ROOT_ID);
  if (blood) {
    const names = branchNames(blood);
    return { kind: "branch", head: blood, ...names };
  }

  for (const spouseId of person.spouseIds) {
    const viaSpouse = walkToChildOfRoot(people, spouseId, MEETING_ROOT_ID);
    if (viaSpouse) {
      const names = branchNames(viaSpouse);
      return { kind: "branch", head: viaSpouse, ...names };
    }
  }

  return { kind: "outside", short: "poza linią", label: "poza linią Franciszka" };
}

export function meetingBranchLabel(personId: string, people: Person[]): string {
  return attributeMeetingBranch(personId, people).label;
}

/** Krótka linia rodzinna do podpowiedzi w wyszukiwarce. */
export function meetingLineHint(personId: string, people: Person[]): string {
  const attr = attributeMeetingBranch(personId, people);
  if (attr.kind === "root") return "pień Franciszka";
  if (attr.kind === "outside") return "poza linią Franciszka";
  if (attr.head?.id && LINE_COLLOQUIAL[attr.head.id]) {
    return LINE_COLLOQUIAL[attr.head.id]!;
  }
  return attr.label;
}

/** Tekst pod imieniem w wyszukiwarce: linia + syn/córka obojga rodziców. */
export function personSearchMeta(person: Person, people: Person[]): string {
  return [meetingLineHint(person.id, people), childOfParentsHint(person, people)]
    .filter(Boolean)
    .join(" · ");
}

/** Słowa linii rodzinnej trafiające do wyszukiwania po gałęzi. */
export function personBranchSearchHaystack(
  person: Person,
  people: Person[],
): string {
  const attr = attributeMeetingBranch(person.id, people);
  const aliases =
    attr.head?.id != null ? (LINE_SEARCH_ALIASES[attr.head.id] ?? []) : [];
  return [attr.label, attr.short, meetingLineHint(person.id, people), ...aliases].join(
    " ",
  );
}

/** Cała linia Franciszka w grupach babć/dziadków — same liczby, bez 150 imion. */
export function groupFamilyByMeetingBranch(people: Person[]): MeetingBranch[] {
  const ids = people
    .filter((person) => attributeMeetingBranch(person.id, people).kind === "branch")
    .map((person) => person.id);
  return groupAttendingByMeetingBranch(people, ids).filter(
    (branch) => branch.kind === "branch",
  );
}

export function groupAttendingByMeetingBranch(
  people: Person[],
  attendingPersonIds: string[],
): MeetingBranch[] {
  const heads = meetingLineHeads(people);
  const byKey = new Map<string, MeetingBranch>();

  const ensure = (
    key: string,
    kind: MeetingBranchKind,
    names: { short: string; label: string },
    headId?: string,
  ): MeetingBranch => {
    const existing = byKey.get(key);
    if (existing) return existing;
    const next: MeetingBranch = {
      key,
      kind,
      headId,
      short: names.short,
      label: names.label,
      personIds: [],
    };
    byKey.set(key, next);
    return next;
  };

  for (const head of heads) {
    const names = branchNames(head);
    ensure(`branch:${head.id}`, "branch", names, head.id);
  }
  ensure("root", "root", { short: "Franciszek", label: "pień Franciszka" });
  ensure("outside", "outside", { short: "poza linią", label: "poza linią Franciszka" });

  const known = new Set(people.map((p) => p.id));
  for (const id of attendingPersonIds) {
    if (!known.has(id)) continue;
    const attr = attributeMeetingBranch(id, people);
    const key =
      attr.kind === "branch" && attr.head
        ? `branch:${attr.head.id}`
        : attr.kind === "root"
          ? "root"
          : "outside";
    const row = ensure(key, attr.kind, { short: attr.short, label: attr.label }, attr.head?.id);
    if (!row.personIds.includes(id)) row.personIds.push(id);
  }

  const branchRows = heads
    .map((h) => byKey.get(`branch:${h.id}`))
    .filter((row): row is MeetingBranch => row !== undefined);
  const root = byKey.get("root");
  const outside = byKey.get("outside");
  const extra = [root, outside].filter(
    (row): row is MeetingBranch =>
      row !== undefined && row.personIds.length > 0,
  );

  return [...branchRows, ...extra];
}

export function namedPeopleOnBranch(
  people: Person[],
  personIds: string[],
): { id: string; name: string }[] {
  return personIds
    .map((id) => people.find((p) => p.id === id))
    .filter((p): p is Person => Boolean(p))
    .sort(comparePeopleByBirth)
    .map((p) => ({ id: p.id, name: displayName(p, people) }));
}
