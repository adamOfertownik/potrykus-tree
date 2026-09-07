import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import {
  ageOnDate,
  civilDateFromJs,
  parseCivilDate,
  type CivilDate,
} from "@/lib/age";

export type BirthdayEntry = {
  person: Person;
  month: number;
  day: number;
  /** Age completed on the next birthday (today if it is the birthday). */
  turningAge: number | null;
  /** Age already completed as of `from` (after a birthday: the age just turned). */
  currentAge: number | null;
  daysUntil: number;
  /** True when this year's birthday has already passed (next one is next year). */
  alreadyOccurred: boolean;
};

function daysUntilNext(month: number, day: number, today: CivilDate): number {
  let year = today.year;
  if (
    month < today.month ||
    (month === today.month && day < today.day)
  ) {
    year += 1;
  }
  const start = Date.UTC(today.year, today.month - 1, today.day);
  const next = Date.UTC(year, month - 1, day);
  return Math.round((next - start) / 86_400_000);
}

export function upcomingBirthdays(
  people: Person[],
  withinDays = 60,
  from = new Date(),
): BirthdayEntry[] {
  const today = civilDateFromJs(from);
  const out: BirthdayEntry[] = [];

  for (const person of people) {
    if (person.deathDate) continue;
    const md = parseCivilDate(person.birthDate);
    if (!md) continue;
    const days = daysUntilNext(md.month, md.day, today);
    if (days > withinDays) continue;
    const alreadyOccurred = days > 0 && (md.month < today.month ||
      (md.month === today.month && md.day < today.day));
    const nextYear =
      md.month < today.month ||
      (md.month === today.month && md.day < today.day)
        ? today.year + 1
        : today.year;
    out.push({
      person,
      month: md.month,
      day: md.day,
      currentAge: ageOnDate(person.birthDate, today),
      turningAge: ageOnDate(person.birthDate, {
        year: nextYear,
        month: md.month,
        day: md.day,
      }),
      daysUntil: days,
      alreadyOccurred,
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
  const month = civilDateFromJs(from).month;
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
