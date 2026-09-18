import type { Person } from "@/types/family";
import type { ReporterIdentity } from "./reporter";
import { displayName } from "./db-client";

function normalizeName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/\s+/g, " ");
}

export function resolvePersonByName(
  people: Person[],
  name: string | undefined,
): Person | undefined {
  const want = normalizeName(name ?? "");
  if (!want) return undefined;
  const hits = people.filter((person) => {
    const full = normalizeName(`${person.firstName} ${person.lastName}`);
    const shown = normalizeName(displayName(person, people));
    const maiden = person.maidenName
      ? normalizeName(`${person.firstName} ${person.maidenName}`)
      : "";
    return want === full || want === shown || (maiden && want === maiden);
  });
  return hits.length === 1 ? hits[0] : undefined;
}

/** Map stored reporter identity to a person row (fixes stale ids after re-seed). */
export function resolveReporterIdentity(
  people: Person[],
  identity: ReporterIdentity | null | undefined,
): ReporterIdentity | null {
  if (!identity?.name && !identity?.personId) return identity ?? null;

  const byId = identity.personId
    ? people.find((p) => p.id === identity.personId)
    : undefined;
  if (byId) {
    return {
      name: displayName(byId, people),
      personId: byId.id,
    };
  }

  const byName = resolvePersonByName(people, identity.name);
  if (byName) {
    return {
      name: displayName(byName, people),
      personId: byName.id,
    };
  }

  return identity;
}
