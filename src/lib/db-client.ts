/** Client-safe date/name helpers (mirror of server db helpers). */

const MONTHS = [
  "sty",
  "lut",
  "mar",
  "kwi",
  "maj",
  "cze",
  "lip",
  "sie",
  "wrz",
  "paź",
  "lis",
  "gru",
];

export function formatPolishDate(iso?: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  const year = parts[0];
  const month = parts[1] ? MONTHS[Number(parts[1]) - 1] : undefined;
  const day = parts[2] ? String(Number(parts[2])) : undefined;
  if (month && day) return `${day} ${month} ${year}`;
  if (month) return `${month} ${year}`;
  return year;
}

export function displayName(person: {
  firstName: string;
  lastName: string;
  maidenName?: string;
}): string {
  const maiden =
    person.maidenName && person.maidenName !== person.lastName
      ? ` (z d. ${person.maidenName})`
      : "";
  return `${person.firstName} ${person.lastName}${maiden}`;
}

export function lifespan(person: {
  birthDate?: string;
  deathDate?: string;
}): string {
  const birth = formatPolishDate(person.birthDate);
  const death = formatPolishDate(person.deathDate);
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `ur. ${birth}`;
  if (death) return `zm. ${death}`;
  return "";
}
