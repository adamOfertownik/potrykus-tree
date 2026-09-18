import type { Marriage, Person } from "@/types/family";

export function normalizeMarriage(raw: unknown): Marriage | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const spouseId = String(rec.spouseId ?? "").trim();
  if (!spouseId) return null;
  const weddingDate = String(rec.weddingDate ?? "").trim() || undefined;
  const divorced = rec.divorced === true ? true : undefined;
  return { spouseId, weddingDate, divorced };
}

export function normalizeMarriages(raw: unknown): Marriage[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Marriage[] = [];
  for (const item of raw) {
    const marriage = normalizeMarriage(item);
    if (!marriage || seen.has(marriage.spouseId)) continue;
    seen.add(marriage.spouseId);
    out.push(marriage);
  }
  return out;
}

export function hydrateMarriages(person: Person): Marriage[] {
  const existing = normalizeMarriages(person.marriages);
  if (existing.length) return existing;
  const ids = person.spouseIds ?? [];
  const legacyDate = person.weddingDate?.trim() || undefined;
  return ids.map((spouseId, index) => ({
    spouseId,
    weddingDate: index === 0 ? legacyDate : undefined,
  }));
}

export function primaryWeddingDate(marriages: Marriage[]): string | undefined {
  const active = marriages.find((m) => !m.divorced && m.weddingDate?.trim());
  if (active?.weddingDate) return active.weddingDate.trim();
  return marriages.find((m) => m.weddingDate?.trim())?.weddingDate?.trim();
}

export function applyMarriagesToPerson(
  person: Person,
  marriages: Marriage[],
): void {
  const next = normalizeMarriages(marriages).filter(
    (m) => m.spouseId !== person.id,
  );
  person.marriages = next.length ? next : undefined;
  person.spouseIds = next.map((m) => m.spouseId);
  person.weddingDate = primaryWeddingDate(next);
}

export function marriagesEqual(a: Marriage[], b: Marriage[]): boolean {
  return JSON.stringify(normalizeMarriages(a)) === JSON.stringify(normalizeMarriages(b));
}

export function mergeMarriagesWithSpouseIds(
  marriages: Marriage[],
  spouseIds: string[],
  fallbackDate?: string,
): Marriage[] {
  const bySpouse = new Map(normalizeMarriages(marriages).map((m) => [m.spouseId, m]));
  const next: Marriage[] = [];
  for (const id of spouseIds) {
    const existing = bySpouse.get(id);
    if (existing) {
      next.push(existing);
    } else {
      next.push({
        spouseId: id,
        weddingDate: next.length === 0 ? fallbackDate : undefined,
      });
    }
  }
  return next;
}

export function upsertMarriage(
  person: Person,
  spouseId: string,
  patch: Partial<Pick<Marriage, "weddingDate" | "divorced">> = {},
): void {
  if (!spouseId || spouseId === person.id) return;
  const list = hydrateMarriages(person);
  const index = list.findIndex((m) => m.spouseId === spouseId);
  const next: Marriage = {
    spouseId,
    weddingDate:
      patch.weddingDate !== undefined
        ? patch.weddingDate.trim() || undefined
        : index >= 0
          ? list[index]!.weddingDate
          : undefined,
    divorced:
      patch.divorced !== undefined
        ? patch.divorced || undefined
        : index >= 0
          ? list[index]!.divorced
          : undefined,
  };
  if (index >= 0) list[index] = next;
  else list.push(next);
  applyMarriagesToPerson(person, list);
}

export function linkCouple(
  a: Person,
  b: Person,
  weddingDate?: string,
): void {
  const aHad = hydrateMarriages(a).find((m) => m.spouseId === b.id);
  const bHad = hydrateMarriages(b).find((m) => m.spouseId === a.id);
  const date =
    weddingDate?.trim() || aHad?.weddingDate || bHad?.weddingDate || undefined;
  const divorced = aHad?.divorced || bHad?.divorced;
  upsertMarriage(a, b.id, { weddingDate: date, divorced });
  upsertMarriage(b, a.id, { weddingDate: date, divorced });
}

export function markCoupleDivorced(a: Person, b: Person): void {
  upsertMarriage(a, b.id, { divorced: true });
  upsertMarriage(b, a.id, { divorced: true });
}

export function syncCoupleMarriage(
  people: Person[],
  personId: string,
  marriage: Marriage,
): void {
  const other = people.find((p) => p.id === marriage.spouseId);
  if (!other) return;
  upsertMarriage(other, personId, {
    weddingDate: marriage.weddingDate,
    divorced: marriage.divorced,
  });
}

export function dropPersonFromMarriages(people: Person[], removedId: string): void {
  for (const person of people) {
    if (!person.marriages?.length) continue;
    applyMarriagesToPerson(
      person,
      hydrateMarriages(person).filter((m) => m.spouseId !== removedId),
    );
  }
}

export function formatMarriagesForDiff(
  marriages: Marriage[] | undefined,
  nameOf: (id: string) => string,
): string {
  const list = normalizeMarriages(marriages);
  if (!list.length) return "—";
  return list
    .map((m) => {
      const bits = [nameOf(m.spouseId)];
      if (m.weddingDate) bits.push(m.weddingDate);
      if (m.divorced) bits.push("rozwód");
      return bits.join(" · ");
    })
    .join("; ");
}
