import type { FamilyDatabase, Gender, Person } from "@/types/family";
import { displayName } from "@/lib/db-client";

export type GraphOp = "add_child" | "link_spouse" | "reparent";

export type NewPersonInput = {
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string;
  deathDate?: string;
  maidenName?: string;
  /** Stable id across a batch (client draft → server remap) */
  clientPersonId?: string;
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

export function cloneFamilyDb(db: FamilyDatabase): FamilyDatabase {
  return JSON.parse(JSON.stringify(db)) as FamilyDatabase;
}

function cloneDb(db: FamilyDatabase): FamilyDatabase {
  return cloneFamilyDb(db);
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
  const preferred = input.clientPersonId?.trim();
  const id =
    preferred && !people.some((p) => p.id === preferred)
      ? preferred
      : uniqueId(people, input.firstName, input.lastName);
  return {
    id,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    maidenName: input.maidenName?.trim() || undefined,
    gender: input.gender,
    birthDate: input.birthDate?.trim() || undefined,
    deathDate: input.deathDate?.trim() || undefined,
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

export function remapGraphMutationIds(
  input: GraphMutationInput,
  idMap: Record<string, string>,
): GraphMutationInput {
  const mapId = (id?: string) => (id && idMap[id] ? idMap[id] : id);
  return {
    ...input,
    anchorPersonId: mapId(input.anchorPersonId) ?? input.anchorPersonId,
    relatedPersonId: mapId(input.relatedPersonId),
    secondParentId: mapId(input.secondParentId),
  };
}

export function applyGraphMutations(
  source: FamilyDatabase,
  edits: GraphMutationInput[],
  options?: { keepClientIds?: boolean; markPending?: boolean },
): {
  db: FamilyDatabase;
  summaries: string[];
  summary: string;
  createdPeople: Person[];
  idMap: Record<string, string>;
  targetPersonId: string;
  targetPersonName: string;
} {
  if (edits.length === 0) {
    throw new Error("Brak zmian do zastosowania.");
  }

  let db = cloneDb(source);
  const idMap: Record<string, string> = {};
  const createdPeople: Person[] = [];
  const summaries: string[] = [];
  let targetPersonId = "";
  let targetPersonName = "";

  for (const raw of edits) {
    const mapped = remapGraphMutationIds(raw, idMap);
    const input: GraphMutationInput = {
      ...mapped,
      newPerson: mapped.newPerson
        ? {
            ...mapped.newPerson,
            clientPersonId: options?.keepClientIds
              ? mapped.newPerson.clientPersonId
              : undefined,
          }
        : undefined,
    };
    const result = applyGraphMutation(db, input);
    db = result.db;
    summaries.push(result.summary);
    targetPersonId = result.targetPersonId;
    targetPersonName = result.targetPersonName;
    if (result.createdPerson) {
      if (options?.markPending) {
        const created = db.people.find((p) => p.id === result.createdPerson!.id);
        if (created) created.pending = true;
      }
      createdPeople.push(result.createdPerson);
      const clientId = raw.newPerson?.clientPersonId?.trim();
      if (clientId) idMap[clientId] = result.createdPerson.id;
    }
  }

  return {
    db,
    summaries,
    summary: summaries.join(" "),
    createdPeople,
    idMap,
    targetPersonId,
    targetPersonName,
  };
}

export function overlayDraftPeople(
  people: Person[],
  edits: GraphMutationInput[],
): Person[] {
  if (edits.length === 0) return people;
  const result = applyGraphMutations(
    {
      meta: {
        title: "",
        rootPersonId: people[0]?.id ?? "",
        creator: "",
        updatedAt: "",
        description: "",
      },
      people: people.map((p) => {
        const { pending: _pending, ...rest } = p;
        void _pending;
        return { ...rest, pending: undefined };
      }),
    },
    edits,
    { keepClientIds: true, markPending: true },
  );
  return result.db.people;
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

export function snapshotPerson(person: Person) {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    maidenName: person.maidenName,
    gender: person.gender,
    birthDate: person.birthDate,
    deathDate: person.deathDate,
    photoUrl: person.photoUrl,
    phone: person.phone,
    notes: person.notes,
    parentIds: [...person.parentIds],
    spouseIds: [...person.spouseIds],
  };
}

export function snapshotPeople(people: Person[], ids: string[]) {
  const wanted = new Set(ids.filter(Boolean));
  return people.filter((p) => wanted.has(p.id)).map(snapshotPerson);
}

export function patchPerson(
  source: FamilyDatabase,
  id: string,
  patch: Partial<
    Pick<
      Person,
      | "firstName"
      | "lastName"
      | "maidenName"
      | "gender"
      | "birthDate"
      | "deathDate"
      | "phone"
      | "notes"
      | "photoUrl"
      | "parentIds"
      | "spouseIds"
    >
  >,
): FamilyDatabase {
  const db = cloneDb(source);
  const person = requirePerson(db.people, id, "edytowana");
  if (patch.firstName !== undefined) person.firstName = patch.firstName.trim();
  if (patch.lastName !== undefined) person.lastName = patch.lastName.trim();
  if (patch.maidenName !== undefined) {
    person.maidenName = patch.maidenName.trim() || undefined;
  }
  if (patch.gender !== undefined) person.gender = patch.gender;
  if (patch.birthDate !== undefined) {
    person.birthDate = patch.birthDate.trim() || undefined;
  }
  if (patch.deathDate !== undefined) {
    person.deathDate = patch.deathDate.trim() || undefined;
  }
  if (patch.phone !== undefined) person.phone = patch.phone.trim() || undefined;
  if (patch.notes !== undefined) person.notes = patch.notes.trim() || undefined;
  if (patch.photoUrl !== undefined) {
    if (patch.photoUrl) person.photoUrl = patch.photoUrl;
    else delete person.photoUrl;
  }
  if (patch.parentIds) person.parentIds = [...patch.parentIds];
  if (patch.spouseIds) person.spouseIds = [...patch.spouseIds];
  return db;
}

export function addStandalonePerson(
  source: FamilyDatabase,
  input: NewPersonInput & {
    phone?: string;
    notes?: string;
    deathDate?: string;
    parentIds?: string[];
    spouseIds?: string[];
  },
): { db: FamilyDatabase; person: Person } {
  const db = cloneDb(source);
  const person = createPerson(
    db.people,
    {
      firstName: input.firstName,
      lastName: input.lastName,
      gender: input.gender,
      birthDate: input.birthDate,
      deathDate: input.deathDate,
      maidenName: input.maidenName,
    },
    input.parentIds ?? [],
    input.spouseIds ?? [],
  );
  if (input.phone) person.phone = input.phone;
  if (input.notes) person.notes = input.notes;
  if (input.deathDate) person.deathDate = input.deathDate;
  db.people.push(person);
  for (const spouseId of person.spouseIds) {
    const spouse = db.people.find((p) => p.id === spouseId);
    if (spouse && !spouse.spouseIds.includes(person.id)) {
      spouse.spouseIds.push(person.id);
    }
  }
  return { db, person };
}

export function deletePersonFromTree(
  source: FamilyDatabase,
  id: string,
): { db: FamilyDatabase; affectedNames: string[] } {
  const db = cloneDb(source);
  const person = requirePerson(db.people, id, "usuwana");
  const name = displayName(person);
  const affected = new Set<string>();
  db.people = db.people.filter((p) => p.id !== id);
  for (const other of db.people) {
    const hadParent = other.parentIds.includes(id);
    const hadSpouse = other.spouseIds.includes(id);
    if (hadParent || hadSpouse) affected.add(displayName(other));
    other.parentIds = other.parentIds.filter((pid) => pid !== id);
    other.spouseIds = other.spouseIds.filter((sid) => sid !== id);
  }
  if (db.meta.rootPersonId === id) {
    db.meta.rootPersonId = db.people[0]?.id ?? "";
  }
  affected.add(name);
  return { db, affectedNames: [...affected] };
}
