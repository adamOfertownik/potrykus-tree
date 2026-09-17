import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";

export type RelationConflict = {
  personId: string;
  message: string;
};

function label(people: Person[], id: string): string {
  const person = people.find((p) => p.id === id);
  return person ? displayName(person) : id;
}

/** Sprzeczne role, przez które family-chart rysuje tę samą osobę ×2 / ×3. */
export function findRelationConflicts(
  people: Person[],
  personId: string,
  parentIds: string[],
  spouseIds: string[],
  childIds: string[],
): RelationConflict[] {
  const parentSet = new Set(parentIds);
  const spouseSet = new Set(spouseIds);
  const childSet = new Set(childIds);
  const found: RelationConflict[] = [];
  const seen = new Set<string>();

  const add = (id: string, message: string) => {
    const key = `${id}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ personId: id, message });
  };

  for (const id of spouseIds) {
    if (parentSet.has(id)) {
      add(
        id,
        `${label(people, id)} jest jednocześnie rodzicem i małżonkiem.`,
      );
    }
    if (childSet.has(id)) {
      add(
        id,
        `${label(people, id)} jest jednocześnie dzieckiem i małżonkiem.`,
      );
    }
    const other = people.find((p) => p.id === id);
    if (other?.parentIds.some((pid) => parentSet.has(pid))) {
      add(
        id,
        `${label(people, id)} ma tego samego rodzica — na drzewie wygląda jak rodzeństwo i małżeństwo (×2).`,
      );
    }
  }

  for (const id of childIds) {
    if (parentSet.has(id)) {
      add(
        id,
        `${label(people, id)} jest jednocześnie rodzicem i dzieckiem.`,
      );
    }
    const child = people.find((p) => p.id === id);
    if (child?.parentIds.some((pid) => pid !== personId && parentSet.has(pid))) {
      add(
        id,
        `${label(people, id)} ma tego samego rodzica — wygląda jak rodzeństwo i dziecko (×2 / ×3). Otwórz tę osobę i zdejmij zbędnego rodzica.`,
      );
    }
  }

  return found;
}
