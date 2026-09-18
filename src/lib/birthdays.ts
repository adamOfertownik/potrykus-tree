import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { hydrateMarriages } from "@/lib/marriages";
import { resolveWeddingDate } from "@/lib/weddingDate";

export type OccasionKind = "birthday" | "wedding";

export type OccasionEntry = {
  key: string;
  kind: OccasionKind;
  person: Person;
  spouse?: Person;
  month: number;
  day: number;
  turningAge: number | null;
  daysUntil: number;
  occurredThisYear: boolean;
};

export type BirthdayEntry = OccasionEntry;

function parseMonthDay(iso?: string): { month: number; day: number } | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

function startOfDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(12, 0, 0, 0);
  return d;
}

function daysUntilNext(month: number, day: number, from = new Date()): number {
  const year = from.getFullYear();
  const next = new Date(year, month - 1, day);
  next.setHours(12, 0, 0, 0);
  const today = startOfDay(from);
  if (next < today) next.setFullYear(year + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

function occurredThisCalendarYear(
  month: number,
  day: number,
  from = new Date(),
): boolean {
  const thisYear = new Date(from.getFullYear(), month - 1, day);
  thisYear.setHours(12, 0, 0, 0);
  return thisYear < startOfDay(from);
}

function ageInYear(iso: string, year: number): number | null {
  const born = Number(iso.slice(0, 4));
  return Number.isFinite(born) ? year - born : null;
}

function sortOccasions(a: OccasionEntry, b: OccasionEntry): number {
  return (
    a.daysUntil - b.daysUntil ||
    a.day - b.day ||
    a.kind.localeCompare(b.kind) ||
    displayName(a.person).localeCompare(displayName(b.person), "pl")
  );
}

function birthdayEntry(
  person: Person,
  from: Date,
  mode: "upcoming" | "thisYear",
): OccasionEntry | null {
  if (person.deathDate) return null;
  const md = parseMonthDay(person.birthDate);
  if (!md || !person.birthDate) return null;
  const days = daysUntilNext(md.month, md.day, from);
  const year = from.getFullYear();
  const occurred = occurredThisCalendarYear(md.month, md.day, from);
  const nextYear = occurred ? year + 1 : year;
  return {
    key: `birthday:${person.id}`,
    kind: "birthday",
    person,
    month: md.month,
    day: md.day,
    turningAge:
      mode === "thisYear"
        ? ageInYear(person.birthDate, year)
        : ageInYear(person.birthDate, nextYear),
    daysUntil: days,
    occurredThisYear: occurred,
  };
}

function weddingEntry(
  people: Person[],
  person: Person,
  from: Date,
  mode: "upcoming" | "thisYear",
  seen: Set<string>,
): OccasionEntry[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const marriages = hydrateMarriages(person).map((marriage, index) => ({
    ...marriage,
    weddingDate:
      marriage.weddingDate ||
      (index === 0 ? resolveWeddingDate(person) : undefined),
  }));
  const out: OccasionEntry[] = [];
  for (const marriage of marriages) {
    if (marriage.divorced) continue;
    const date = marriage.weddingDate || undefined;
    const md = parseMonthDay(date);
    if (!md || !date) continue;
    const spouse = byId.get(marriage.spouseId);
    if (person.deathDate && (!spouse || spouse.deathDate)) continue;
    const coupleIds = [person.id, spouse?.id]
      .filter((id): id is string => Boolean(id))
      .sort();
    const coupleKey = `wedding:${coupleIds.join("|")}:${md.month}-${md.day}`;
    if (seen.has(coupleKey)) continue;
    seen.add(coupleKey);

    const days = daysUntilNext(md.month, md.day, from);
    const year = from.getFullYear();
    const occurred = occurredThisCalendarYear(md.month, md.day, from);
    const nextYear = occurred ? year + 1 : year;
    out.push({
      key: coupleKey,
      kind: "wedding",
      person,
      spouse,
      month: md.month,
      day: md.day,
      turningAge:
        mode === "thisYear"
          ? ageInYear(date, year)
          : ageInYear(date, nextYear),
      daysUntil: days,
      occurredThisYear: occurred,
    });
  }
  return out;
}

export function upcomingBirthdays(
  people: Person[],
  withinDays = 60,
  from = new Date(),
): OccasionEntry[] {
  const out: OccasionEntry[] = [];
  for (const person of people) {
    const entry = birthdayEntry(person, from, "upcoming");
    if (entry && entry.daysUntil <= withinDays) out.push(entry);
  }
  return out.sort(sortOccasions);
}

export function birthdaysThisMonth(
  people: Person[],
  from = new Date(),
): OccasionEntry[] {
  const month = from.getMonth() + 1;
  const out: OccasionEntry[] = [];
  for (const person of people) {
    const entry = birthdayEntry(person, from, "thisYear");
    if (entry && entry.month === month) out.push(entry);
  }
  return out.sort((a, b) => a.day - b.day || sortOccasions(a, b));
}

export function upcomingAnniversaries(
  people: Person[],
  withinDays = 60,
  from = new Date(),
): OccasionEntry[] {
  const seen = new Set<string>();
  const out: OccasionEntry[] = [];
  for (const person of people) {
    const entries = weddingEntry(people, person, from, "upcoming", seen);
    for (const entry of entries) {
      if (entry.daysUntil <= withinDays) out.push(entry);
    }
  }
  return out.sort(sortOccasions);
}

export function anniversariesThisMonth(
  people: Person[],
  from = new Date(),
): OccasionEntry[] {
  const month = from.getMonth() + 1;
  const seen = new Set<string>();
  const out: OccasionEntry[] = [];
  for (const person of people) {
    const entries = weddingEntry(people, person, from, "thisYear", seen);
    for (const entry of entries) {
      if (entry.month === month) out.push(entry);
    }
  }
  return out.sort((a, b) => a.day - b.day || sortOccasions(a, b));
}

export function occasionsThisMonth(
  people: Person[],
  from = new Date(),
): OccasionEntry[] {
  return [...birthdaysThisMonth(people, from), ...anniversariesThisMonth(people, from)].sort(
    (a, b) => a.day - b.day || sortOccasions(a, b),
  );
}

export function upcomingOccasions(
  people: Person[],
  withinDays = 45,
  from = new Date(),
): OccasionEntry[] {
  return [
    ...upcomingBirthdays(people, withinDays, from),
    ...upcomingAnniversaries(people, withinDays, from),
  ].sort(sortOccasions);
}

export function occasionAgeLabel(
  entry: OccasionEntry,
  variant: "month" | "upcoming" = "month",
): string | null {
  if (entry.kind === "birthday") {
    if (entry.turningAge == null) return null;
    if (variant === "month" && entry.occurredThisYear) {
      return `były ${entry.turningAge}. urodziny`;
    }
    if (variant === "upcoming" && !entry.occurredThisYear && entry.daysUntil !== 0) {
      return `kończy ${entry.turningAge} lat`;
    }
    if (entry.daysUntil === 0) return `kończy ${entry.turningAge} lat`;
    return variant === "month"
      ? `kończy ${entry.turningAge} lat`
      : `${entry.turningAge} lat`;
  }
  if (entry.turningAge == null) {
    return entry.occurredThisYear && variant === "month"
      ? "była rocznica ślubu"
      : "rocznica ślubu";
  }
  if (variant === "month" && entry.occurredThisYear) {
    return `była ${entry.turningAge}. rocznica ślubu`;
  }
  return `${entry.turningAge}. rocznica ślubu`;
}

export const MONTH_NAMES_PL = [
  "",
  "styczeń",
  "luty",
  "marzec",
  "kwiecień",
  "maj",
  "czerwiec",
  "lipiec",
  "sierpień",
  "wrzesień",
  "październik",
  "listopad",
  "grudzień",
];
