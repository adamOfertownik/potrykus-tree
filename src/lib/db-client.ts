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

export function isUnnamedPerson(person: { firstName: string }): boolean {
  const first = person.firstName
    .trim()
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ");
  return first === "nn" || first === "n n" || first === "?";
}

function parentKey(parentIds: string[] | undefined): string {
  return [...(parentIds ?? [])].sort().join(",");
}

/** Number unnamed siblings who would otherwise look identical, e.g. NN Ryga (1/6). */
export function unnamedSiblingOrdinal(
  person: { id: string; firstName: string; lastName: string; parentIds: string[] },
  people: Array<{
    id: string;
    firstName: string;
    lastName: string;
    parentIds: string[];
  }>,
): { index: number; total: number } | null {
  const key = parentKey(person.parentIds);
  if (!key || !isUnnamedPerson(person)) return null;
  const siblings = people
    .filter(
      (p) =>
        isUnnamedPerson(p) &&
        p.lastName === person.lastName &&
        parentKey(p.parentIds) === key,
    )
    .sort((a, b) => a.id.localeCompare(b.id, "pl", { numeric: true }));
  if (siblings.length <= 1) return null;
  const index = siblings.findIndex((p) => p.id === person.id);
  if (index < 0) return null;
  return { index: index + 1, total: siblings.length };
}

export function displayName(
  person: {
    id?: string;
    firstName: string;
    lastName: string;
    maidenName?: string;
    parentIds?: string[];
  },
  people?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    parentIds: string[];
  }>,
): string {
  const maiden =
    person.maidenName && person.maidenName !== person.lastName
      ? ` (z d. ${person.maidenName})`
      : "";
  const base = `${person.firstName} ${person.lastName}${maiden}`;
  if (!people || !person.id || !person.parentIds) return base;
  const ordinal = unnamedSiblingOrdinal(
    {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      parentIds: person.parentIds,
    },
    people,
  );
  if (!ordinal) return base;
  return `${person.firstName} ${person.lastName} (${ordinal.index}/${ordinal.total})${maiden}`;
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
