import { GENERATION_TRUNK_ID } from "@/lib/chartOverview";
import { personBranchSearchHaystack } from "@/lib/meetingBranches";
import type { Person } from "@/types/family";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l");
}

const TRUNK_SEARCH_ALIASES = [
  "pien",
  "pien rodziny",
  "franciszek xawery",
  "xawery potrykus",
  "pien franciszka xawerego",
];

type SearchIndex = {
  hay: Map<string, string>;
  name: Map<string, { lastFirst: string; firstLast: string; first: string }>;
};

const indexCache = new WeakMap<Person[], SearchIndex>();

function searchIndex(people: Person[]): SearchIndex {
  const cached = indexCache.get(people);
  if (cached) return cached;

  const hay = new Map<string, string>();
  const name = new Map<
    string,
    { lastFirst: string; firstLast: string; first: string }
  >();

  for (const p of people) {
    const lastFirst = normalize(`${p.lastName} ${p.firstName}`);
    const firstLast = normalize(`${p.firstName} ${p.lastName}`);
    name.set(p.id, {
      lastFirst,
      firstLast,
      first: normalize(p.firstName),
    });
    const extra =
      p.id === GENERATION_TRUNK_ID
        ? TRUNK_SEARCH_ALIASES.join(" ")
        : p.spouseIds.includes(GENERATION_TRUNK_ID)
          ? "malzonek pnia franciszka xawerego"
          : personBranchSearchHaystack(p, people);
    hay.set(
      p.id,
      normalize(
        [
          p.firstName,
          p.lastName,
          p.maidenName ?? "",
          p.notes ?? "",
          p.birthDate ?? "",
          p.weddingDate ?? "",
          ...(p.marriages ?? []).map((m) => m.weddingDate ?? ""),
          extra,
        ].join(" "),
      ),
    );
  }

  const next = { hay, name };
  indexCache.set(people, next);
  return next;
}

export function searchPeople(people: Person[], query: string): Person[] {
  const q = normalize(query.trim());
  if (!q) return [];
  const tokens = q.split(/[\s,;./]+/).filter(Boolean);
  const { hay, name } = searchIndex(people);
  return people
    .filter((p) => {
      const text = hay.get(p.id) ?? "";
      return tokens.every((token) => text.includes(token));
    })
    .sort((a, b) => {
      const an = name.get(a.id);
      const bn = name.get(b.id);
      if (!an || !bn) return 0;
      const aStarts =
        an.lastFirst.startsWith(q) ||
        an.firstLast.startsWith(q) ||
        an.first.startsWith(q);
      const bStarts =
        bn.lastFirst.startsWith(q) ||
        bn.firstLast.startsWith(q) ||
        bn.first.startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return an.lastFirst.localeCompare(bn.lastFirst, "pl");
    });
}
