import type { Person } from "@/types/family";

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "l");
}

export function searchPeople(people: Person[], query: string): Person[] {
  const q = normalize(query.trim());
  if (!q) return [];
  return people
    .filter((p) => {
      const hay = normalize(
        [
          p.firstName,
          p.lastName,
          p.maidenName ?? "",
          p.notes ?? "",
          p.birthDate ?? "",
        ].join(" "),
      );
      return hay.includes(q);
    })
    .sort((a, b) => {
      const an = normalize(`${a.lastName} ${a.firstName}`);
      const bn = normalize(`${b.lastName} ${b.firstName}`);
      const aStarts = an.startsWith(q) || normalize(a.firstName).startsWith(q);
      const bStarts = bn.startsWith(q) || normalize(b.firstName).startsWith(q);
      if (aStarts !== bStarts) return aStarts ? -1 : 1;
      return an.localeCompare(bn, "pl");
    });
}
