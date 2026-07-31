import type { FamilyDatabase, Gender, Person } from "@/types/family";
import { displayName } from "@/lib/db-client";

export type GraphOp = "add_child" | "link_spouse" | "reparent";

export type NewPersonInput = {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  maidenName?: string;
};

export type GraphMutationInput = {
  op: GraphOp;
  /** Person opened from the graph modal */
  anchorPersonId: string;
  /** Existing related person (child / spouse / new parent) */
  relatedPersonId?: string;
  newPerson?: NewPersonInput;
  /** Optional second parent when adding a child */
  secondParentId?: string;
  /** Reparent: replace parentIds instead of appending */
  replaceParentIds?: boolean;
};

export type GraphMutationResult = {
  db: FamilyDatabase;
  summary: string;
  createdPerson?: Person;
  targetPersonId: string;
  targetPersonName: string;
};

function slugify(parts: string[]): string {
  const base = parts
    .join("-")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return base || "osoba";
}

function uniqueId(people: Person[], firstName: string, lastName: string): string {
  const base = slugify([firstName, lastName]);
  if (!people.some((p) => p.id === base)) return base;
  let i = 2;
  while (people.some((p) => p.id === `${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function cloneDb(db: FamilyDatabase): FamilyDatabase {
  return JSON.parse(JSON.stringify(db)) as FamilyDatabase;
}

function requirePerson(people: Person[], id: string, label: string): Person {
  const p = people.find((x) => x.id === id);
  if (!p) throw new Error(`Nie znaleziono osoby (${label}).`);
  return p;
}

function wouldCreateCycle(
  people: Person[],
  childId: string,
  parentId: string,
): boolean {
  // parentId must not be a descendant of childId
  const byId = new Map(people.map((p) => [p.id, p]));
  const stack = [childId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (id === parentId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const p of people) {
      if (p.parentIds.includes(id)) stack.push(p.id);
    }
    // also walk via byId for safety
    void byId;
  }
  return false;
}

function createPerson(
  people: Person[],
  input: NewPersonInput,
  parentIds: string[],
  spouseIds: string[] = [],
): Person {
  return {
    id: uniqueId(people, input.firstName, input.lastName),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    maidenName: input.maidenName?.trim() || undefined,
    gender: input.gender,
    birthDate: input.birthDate?.trim() || undefined,
    parentIds: [...parentIds],
    spouseIds: [...spouseIds],
  };
}

export function applyGraphMutation(
  source: FamilyDatabase,
  input: GraphMutationInput,
): GraphMutationResult {
  const db = cloneDb(source);
  const people = db.people;
  const anchor = requirePerson(people, input.anchorPersonId, "wybrana z grafu");

  if (!input.relatedPersonId && !input.newPerson) {
    throw new Error("Wybierz istniejącą osobę albo podaj dane nowej.");
  }
  if (input.relatedPersonId && input.newPerson) {
    throw new Error("Podaj albo istniejącą osobę, albo nową — nie obie naraz.");
  }

  if (input.op === "add_child") {
    const parents = [anchor.id];
    if (input.secondParentId && input.secondParentId !== anchor.id) {
      requirePerson(people, input.secondParentId, "drugi rodzic");
      parents.push(input.secondParentId);
    }

    if (input.newPerson) {
      const child = createPerson(people, input.newPerson, parents);
      people.push(child);
      const parentLabel = parents
        .map((id) => displayName(requirePerson(people, id, "rodzic")))
        .join(" i ");
      return {
        db,
        summary: `Dodano ${displayName(child)} jako dziecko: ${parentLabel}.`,
        createdPerson: child,
        targetPersonId: child.id,
        targetPersonName: displayName(child),
      };
    }

    const child = requirePerson(people, input.relatedPersonId!, "dziecko");
    if (child.id === anchor.id) {
      throw new Error("Osoba nie może być własnym dzieckiem.");
    }
    for (const parentId of parents) {
      if (wouldCreateCycle(people, child.id, parentId)) {
        throw new Error("Ta zmiana utworzyłaby pętlę w drzewie.");
      }
      if (!child.parentIds.includes(parentId)) {
        child.parentIds.push(parentId);
      }
    }
    return {
      db,
      summary: `Przypisano ${displayName(child)} jako dziecko ${displayName(anchor)}.`,
      targetPersonId: child.id,
      targetPersonName: displayName(child),
    };
  }

  if (input.op === "link_spouse") {
    let spouse: Person;
    let created: Person | undefined;
    if (input.newPerson) {
      spouse = createPerson(people, input.newPerson, [], [anchor.id]);
      people.push(spouse);
      created = spouse;
    } else {
      spouse = requirePerson(people, input.relatedPersonId!, "małżonek");
      if (spouse.id === anchor.id) {
        throw new Error("Nie można połączyć osoby z samą sobą.");
      }
    }
    if (!anchor.spouseIds.includes(spouse.id)) anchor.spouseIds.push(spouse.id);
    if (!spouse.spouseIds.includes(anchor.id)) spouse.spouseIds.push(anchor.id);
    return {
      db,
      summary: `Połączono ${displayName(anchor)} ↔ ${displayName(spouse)} jako małżonków/partnerów.`,
      createdPerson: created,
      targetPersonId: spouse.id,
      targetPersonName: displayName(spouse),
    };
  }

  // reparent: move anchor under related (new parent)
  const newParent = input.newPerson
    ? (() => {
        const p = createPerson(people, input.newPerson!, []);
        people.push(p);
        return p;
      })()
    : requirePerson(people, input.relatedPersonId!, "nowy rodzic");

  if (newParent.id === anchor.id) {
    throw new Error("Osoba nie może być własnym rodzicem.");
  }
  if (wouldCreateCycle(people, anchor.id, newParent.id)) {
    throw new Error("Ta zmiana utworzyłaby pętlę w drzewie.");
  }

  const oldParents = [...anchor.parentIds];
  if (input.replaceParentIds !== false) {
    anchor.parentIds = [newParent.id];
  } else if (!anchor.parentIds.includes(newParent.id)) {
    anchor.parentIds.push(newParent.id);
  }

  const oldLabel =
    oldParents.length > 0
      ? oldParents
          .map((id) => {
            const p = people.find((x) => x.id === id);
            return p ? displayName(p) : id;
          })
          .join(", ")
      : "brak";

  return {
    db,
    summary: `Przeniesiono ${displayName(anchor)} pod ${displayName(newParent)} (poprzednio: ${oldLabel}).`,
    createdPerson: input.newPerson ? newParent : undefined,
    targetPersonId: anchor.id,
    targetPersonName: displayName(anchor),
  };
}

export function summarizeMutationPreview(
  people: Person[],
  input: GraphMutationInput,
): string {
  const anchor = people.find((p) => p.id === input.anchorPersonId);
  const anchorName = anchor ? displayName(anchor) : "wybrana osoba";
  const related = input.relatedPersonId
    ? people.find((p) => p.id === input.relatedPersonId)
    : null;
  const otherName = related
    ? displayName(related)
    : input.newPerson
      ? `${input.newPerson.firstName} ${input.newPerson.lastName} (nowa)`
      : "…";

  if (input.op === "add_child") {
    return `Dodać ${otherName} jako dziecko ${anchorName}?`;
  }
  if (input.op === "link_spouse") {
    return `Połączyć ${anchorName} ↔ ${otherName} jako małżonków/partnerów?`;
  }
  return `Przenieść ${anchorName} pod ${otherName}?`;
}
