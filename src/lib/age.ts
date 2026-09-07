/** Calendar Y-M-D helpers — never parse ISO dates with `new Date("YYYY-MM-DD")`
 * (UTC midnight shifts the civil day in some timezones and inflates age). */

export type CivilDate = {
  year: number;
  month: number;
  day: number;
};

/** Local civil date of a JS Date (browser/server timezone). */
export function civilDateFromJs(from = new Date()): CivilDate {
  return {
    year: from.getFullYear(),
    month: from.getMonth() + 1,
    day: from.getDate(),
  };
}

/**
 * Parse ISO-like birth/death strings: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`.
 * Incomplete dates are not usable for an exact age.
 */
export function parseCivilDate(iso?: string): CivilDate | null {
  if (!iso) return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function birthdayReached(birth: CivilDate, on: CivilDate): boolean {
  return (
    on.month > birth.month ||
    (on.month === birth.month && on.day >= birth.day)
  );
}

/** Whole years completed on `on` (default: today, local calendar). */
export function completedYears(
  birth: CivilDate,
  on: CivilDate,
): number {
  let years = on.year - birth.year;
  if (!birthdayReached(birth, on)) years -= 1;
  return Math.max(0, years);
}

export function ageOnDate(birthIso: string | undefined, on: CivilDate): number | null {
  const birth = parseCivilDate(birthIso);
  if (!birth) return null;
  return completedYears(birth, on);
}

export function currentAge(
  birthIso: string | undefined,
  from = new Date(),
): number | null {
  return ageOnDate(birthIso, civilDateFromJs(from));
}

export function ageAtDeath(
  birthIso: string | undefined,
  deathIso: string | undefined,
): number | null {
  const death = parseCivilDate(deathIso);
  if (!death) return null;
  return ageOnDate(birthIso, death);
}

/** Living: current age. Deceased: age at death. */
export function displayedAge(
  person: { birthDate?: string; deathDate?: string },
  from = new Date(),
): number | null {
  if (person.deathDate) return ageAtDeath(person.birthDate, person.deathDate);
  return currentAge(person.birthDate, from);
}

/** Polish: 1 rok, 2 lata, 5 lat, 22 lata, 25 lat. */
export function formatAgePl(years: number): string {
  const n = Math.abs(Math.trunc(years));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (n === 1) return "1 rok";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} lata`;
  }
  return `${n} lat`;
}

export function formatAgeLabel(
  person: { birthDate?: string; deathDate?: string },
  from = new Date(),
): string {
  const years = displayedAge(person, from);
  if (years == null) return "";
  return formatAgePl(years);
}
