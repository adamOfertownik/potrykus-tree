import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";

export type BirthdayEntry = {
  person: Person;
  month: number;
  day: number;
  turningAge: number | null;
  daysUntil: number;
};

function parseMonthDay(iso?: string): { month: number; day: number } | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { month: Number(m[2]), day: Number(m[3]) };
}

function daysUntilNext(month: number, day: number, from = new Date()): number {
  const year = from.getFullYear();
  const next = new Date(year, month - 1, day);
  next.setHours(12, 0, 0, 0);
  const today = new Date(from);
  today.setHours(12, 0, 0, 0);
  if (next < today) next.setFullYear(year + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function upcomingBirthdays(
  people: Person[],
  withinDays = 60,
  from = new Date(),
): BirthdayEntry[] {
  const year = from.getFullYear();
  const out: BirthdayEntry[] = [];

  for (const person of people) {
    if (person.deathDate) continue;
    const md = parseMonthDay(person.birthDate);
    if (!md) continue;
    const days = daysUntilNext(md.month, md.day, from);
    if (days > withinDays) continue;
    const birthYear = Number(person.birthDate!.slice(0, 4));
    const nextYear =
      days === 0 && from.getMonth() + 1 === md.month && from.getDate() === md.day
        ? year
        : new Date(year, md.month - 1, md.day) < from
          ? year + 1
          : year;
    out.push({
      person,
      month: md.month,
      day: md.day,
      turningAge: Number.isFinite(birthYear)
        ? nextYear - birthYear
        : null,
      daysUntil: days,
    });
  }

  return out.sort(
    (a, b) =>
      a.daysUntil - b.daysUntil ||
      displayName(a.person).localeCompare(displayName(b.person), "pl"),
  );
}

export function birthdaysThisMonth(
  people: Person[],
  from = new Date(),
): BirthdayEntry[] {
  const month = from.getMonth() + 1;
  return upcomingBirthdays(people, 366, from).filter((e) => e.month === month);
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
