import type { FamilyDatabase, Gender, Person } from "@/types/family";
import { displayName } from "@/lib/db-client";

export type MarkdownIssue = {
  level: "error" | "warning";
  line?: number;
  message: string;
};

export type ParsedSnapshot = {
  people: Person[];
  issues: MarkdownIssue[];
  starredId?: string;
  lineCount: number;
};

const PERSON_LINE =
  /^(\s*)-\s*\[([A-Za-z][A-Za-z0-9]*)\]\s+(.+)$/;

const ISO_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;

function normalizeId(raw: string): string {
  return raw.trim().toLowerCase();
}

function isBlankRef(value: string): boolean {
  const v = value.trim();
  return !v || v === "—" || v === "–" || v === "-" || v === "–";
}

function parseIdList(raw: string): string[] {
  if (isBlankRef(raw)) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !isBlankRef(part))
    .map(normalizeId);
}

function splitName(raw: string): { firstName: string; lastName: string } {
  const cleaned = raw
    .replace(/[★☆*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const idx = cleaned.lastIndexOf(" ");
  if (idx <= 0) {
    return { firstName: cleaned || "NN", lastName: "NN" };
  }
  return {
    firstName: cleaned.slice(0, idx).trim(),
    lastName: cleaned.slice(idx + 1).trim() || "NN",
  };
}

function parseGender(raw: string | undefined): Gender {
  const g = (raw || "").trim().toLowerCase();
  if (g === "k" || g === "f" || g === "female") return "female";
  if (g === "m" || g === "male") return "male";
  return "unknown";
}

function parseFlexibleDate(
  raw: string,
): { iso?: string; leftover?: string } {
  const value = raw.trim();
  if (!value) return {};
  const approx = value.match(/^ok\.?\s*(\d{4})$/i);
  if (approx) {
    return { iso: approx[1], leftover: `ok. ${approx[1]}` };
  }
  if (ISO_DATE.test(value)) return { iso: value };
  return { leftover: value };
}

function parseFieldChunks(chunks: string[]): {
  birthDate?: string;
  deathDate?: string;
  parentIds: string[];
  spouseIds: string[];
  notes: string[];
} {
  const notes: string[] = [];
  let birthDate: string | undefined;
  let deathDate: string | undefined;
  let parentIds: string[] = [];
  let spouseIds: string[] = [];

  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    const lower = text.toLowerCase();

    const take = (prefix: string) =>
      text.slice(prefix.length).trim().replace(/^:\s*/, "");

    if (lower.startsWith("ur.") || lower.startsWith("ur:")) {
      const parsed = parseFlexibleDate(take(text.slice(0, 3)));
      if (parsed.iso) birthDate = parsed.iso;
      if (parsed.leftover) notes.push(`ur. ${parsed.leftover}`);
      continue;
    }
    if (lower.startsWith("zm.") || lower.startsWith("zm:")) {
      const parsed = parseFlexibleDate(take(text.slice(0, 3)));
      if (parsed.iso) deathDate = parsed.iso;
      if (parsed.leftover) notes.push(`zm. ${parsed.leftover}`);
      continue;
    }
    if (lower.startsWith("rodzic")) {
      parentIds = parseIdList(take("rodzic").replace(/^:/, ""));
      continue;
    }
    if (lower.startsWith("małżonek") || lower.startsWith("malzonek")) {
      const rest = text.replace(/^(małżonek|malzonek)\s*:?\s*/i, "");
      spouseIds = parseIdList(rest);
      continue;
    }
    if (lower.startsWith("notatka")) {
      const rest = text.replace(/^notatka\s*:?\s*/i, "").trim();
      if (rest) notes.push(rest);
      continue;
    }
    notes.push(text);
  }

  return { birthDate, deathDate, parentIds, spouseIds, notes };
}

export function parseFamilyMarkdown(markdown: string): ParsedSnapshot {
  const issues: MarkdownIssue[] = [];
  const people: Person[] = [];
  const byId = new Map<string, Person>();
  let starredId: string | undefined;
  const lines = markdown.split(/\r?\n/);
  let personLines = 0;

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(">")) return;
    if (!trimmed.startsWith("-")) return;
    if (!trimmed.includes("[") || !PERSON_LINE.test(line)) {
      if (/^\s*-\s*\[/.test(line)) {
        issues.push({
          level: "error",
          line: lineNo,
          message: "Nie udało się odczytać wiersza osoby.",
        });
      }
      return;
    }

    const match = line.match(PERSON_LINE);
    if (!match) return;
    personLines += 1;
    const rawId = match[2];
    const id = normalizeId(rawId);
    const rest = match[3].trim();
    const chunks = rest.split(/\s*\|\s*/);
    if (chunks.length < 2) {
      issues.push({
        level: "error",
        line: lineNo,
        message: `Brak płci po imieniu (${rawId}).`,
      });
      return;
    }

    let nameRaw = chunks[0].trim();
    const gender = parseGender(chunks[1]);
    const fields = parseFieldChunks(chunks.slice(2));

    const starred =
      /[★☆]/.test(nameRaw) ||
      /szukana/i.test(nameRaw) ||
      fields.notes.some((n) => /szukana/i.test(n));
    nameRaw = nameRaw.replace(/[★☆*]+/g, " ").replace(/\s+/g, " ").trim();
    const szukana = nameRaw.match(/\(([^)]*SZUKANA[^)]*)\)/i);
    if (szukana) {
      fields.notes.unshift(szukana[1].trim());
      nameRaw = nameRaw.replace(szukana[0], "").replace(/\s+/g, " ").trim();
    }
    if (starred) {
      starredId = id;
      fields.notes.unshift("Oś drzewa / osoba wskazana w snapshocie");
    }

    const { firstName, lastName } = splitName(nameRaw);
    if (byId.has(id)) {
      issues.push({
        level: "error",
        line: lineNo,
        message: `Duplikat ID ${rawId}.`,
      });
      return;
    }

    const notes = fields.notes.filter(Boolean).join(" ").trim() || undefined;
    const person: Person = {
      id,
      firstName,
      lastName,
      gender,
      parentIds: fields.parentIds,
      spouseIds: fields.spouseIds,
    };
    if (fields.birthDate) person.birthDate = fields.birthDate;
    if (fields.deathDate) person.deathDate = fields.deathDate;
    if (notes) person.notes = notes;

    people.push(person);
    byId.set(id, person);
  });

  for (const person of people) {
    for (const parentId of person.parentIds) {
      if (!byId.has(parentId)) {
        issues.push({
          level: "error",
          message: `${person.id}: rodzic ${parentId} nie istnieje.`,
        });
      }
    }
    const uniqueSpouses = [...new Set(person.spouseIds)];
    person.spouseIds = uniqueSpouses;
    for (const spouseId of uniqueSpouses) {
      const spouse = byId.get(spouseId);
      if (!spouse) {
        issues.push({
          level: "error",
          message: `${person.id}: małżonek ${spouseId} nie istnieje.`,
        });
        continue;
      }
      if (!spouse.spouseIds.includes(person.id)) {
        spouse.spouseIds.push(person.id);
        issues.push({
          level: "warning",
          message: `Uzupełniono brakującą relację małżeństwa: ${spouse.id} ↔ ${person.id}.`,
        });
      }
    }
  }

  if (people.length === 0) {
    issues.push({
      level: "error",
      message:
        "Brak osób w pliku. Każda osoba to linia: - [P001] Imię Nazwisko | m | rodzic: — | małżonek: —",
    });
  }

  return {
    people,
    issues,
    starredId,
    lineCount: personLines,
  };
}

export function pickRootPersonId(
  parsed: ParsedSnapshot,
  preferred?: string,
): string {
  if (preferred && parsed.people.some((p) => p.id === preferred)) {
    return preferred;
  }
  const wincenty = parsed.people.find(
    (p) =>
      p.firstName.toLowerCase().includes("wincenty") ||
      p.firstName.toLowerCase().includes("vincentius"),
  );
  if (wincenty) return wincenty.id;
  if (parsed.starredId) return parsed.starredId;
  const founder = parsed.people.find((p) => p.parentIds.length === 0);
  return founder?.id || parsed.people[0]?.id || "";
}

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function surnamesOf(person: Person): string[] {
  const names = [norm(person.lastName)];
  if (person.maidenName) names.push(norm(person.maidenName));
  return [...new Set(names.filter(Boolean))];
}

function indexExisting(existing: Person[]) {
  const byBirthFirst = new Map<string, Person[]>();
  const byName = new Map<string, Person[]>();
  for (const person of existing) {
    if (person.birthDate) {
      const key = `${norm(person.firstName)}|${person.birthDate}`;
      const list = byBirthFirst.get(key) || [];
      list.push(person);
      byBirthFirst.set(key, list);
    }
    for (const surname of surnamesOf(person)) {
      const key = `${norm(person.firstName)}|${surname}`;
      const list = byName.get(key) || [];
      list.push(person);
      byName.set(key, list);
    }
  }
  return { byBirthFirst, byName };
}

function findExistingMatch(
  person: Person,
  index: ReturnType<typeof indexExisting>,
  alreadyMatched: Set<string>,
): Person | undefined {
  const unused = (list: Person[]) =>
    list.filter((p) => !alreadyMatched.has(p.id));

  if (person.birthDate) {
    const byBirth = unused(
      index.byBirthFirst.get(`${norm(person.firstName)}|${person.birthDate}`) ||
        [],
    );
    if (byBirth.length === 1) return byBirth[0];
    const surnameHit = byBirth.filter((p) =>
      surnamesOf(p).some((s) => surnamesOf(person).includes(s)),
    );
    if (surnameHit.length === 1) return surnameHit[0];
  }

  const nameHits = unused(
    surnamesOf(person).flatMap(
      (s) => index.byName.get(`${norm(person.firstName)}|${s}`) || [],
    ),
  );
  const unique = [...new Map(nameHits.map((p) => [p.id, p])).values()];
  if (unique.length === 1) {
    const hit = unique[0];
    if (!person.birthDate || !hit.birthDate || person.birthDate === hit.birthDate) {
      return hit;
    }
  }
  return undefined;
}

export function mergeImportedPeople(
  imported: Person[],
  existing: Person[],
): { people: Person[]; preservedCount: number; matchedCount: number } {
  const index = indexExisting(existing);
  const oldToNew = new Map<string, string>();
  const matchedOldIds = new Set<string>();
  let matchedCount = 0;

  const people = imported.map((person) => {
    const previous = findExistingMatch(person, index, matchedOldIds);
    if (!previous) {
      return {
        ...person,
        parentIds: [...person.parentIds],
        spouseIds: [...person.spouseIds],
      };
    }

    matchedCount += 1;
    matchedOldIds.add(previous.id);
    oldToNew.set(previous.id, person.id);
    const next: Person = {
      ...person,
      parentIds: [...person.parentIds],
      spouseIds: [...person.spouseIds],
      photoUrl: previous.photoUrl || person.photoUrl,
      phone: previous.phone || person.phone,
    };
    if (previous.maidenName && !next.maidenName) {
      next.maidenName = previous.maidenName;
    } else if (
      !person.maidenName &&
      previous.lastName &&
      norm(previous.lastName) !== norm(person.lastName)
    ) {
      next.maidenName = person.lastName;
      // keep snapshot blood surname; married name stays in notes via maiden swap:
      // existing lastName is typically married name.
    }
    if (!next.notes && previous.notes) next.notes = previous.notes;
    return next;
  });

  const importedIds = new Set(people.map((p) => p.id));
  const extras: Person[] = [];
  for (const person of existing) {
    if (matchedOldIds.has(person.id)) continue;
    if (importedIds.has(person.id)) continue;
    const placeholder =
      /linia-glowna|galaz-page|branch/i.test(person.id) ||
      (person.gender === "unknown" &&
        /linia|gałąź|galaz/i.test(person.firstName));
    if (placeholder) continue;
    extras.push({
      ...person,
      parentIds: person.parentIds.map((id) => oldToNew.get(id) || id),
      spouseIds: person.spouseIds.map((id) => oldToNew.get(id) || id),
    });
  }

  for (const extra of extras) {
    for (const spouseId of extra.spouseIds) {
      const spouse = people.find((p) => p.id === spouseId);
      if (spouse && !spouse.spouseIds.includes(extra.id)) {
        spouse.spouseIds.push(extra.id);
      }
    }
  }

  return {
    people: [...people, ...extras],
    preservedCount: extras.length,
    matchedCount,
  };
}

export function snapshotToFamilyDb(opts: {
  parsed: ParsedSnapshot;
  existing?: FamilyDatabase;
  preserveExtras?: boolean;
  rootPersonId?: string;
}): {
  db: FamilyDatabase;
  rootPersonId: string;
  preservedCount: number;
  matchedCount: number;
} {
  const preserve = opts.preserveExtras !== false;
  const merged = preserve && opts.existing
    ? mergeImportedPeople(opts.parsed.people, opts.existing.people)
    : {
        people: opts.parsed.people,
        preservedCount: 0,
        matchedCount: 0,
      };

  const rootPersonId = pickRootPersonId(opts.parsed, opts.rootPersonId);
  const db: FamilyDatabase = {
    meta: {
      title: opts.existing?.meta.title || "Drzewo rodziny Potrykus",
      rootPersonId,
      creator: opts.existing?.meta.creator || "Adam Lieske",
      updatedAt: new Date().toISOString(),
      description:
        "Dane z snapshota Markdown (ID-based). Numery telefonów i zdjęcia zachowane przy dopasowaniu osób.",
    },
    people: merged.people,
  };

  return {
    db,
    rootPersonId,
    preservedCount: merged.preservedCount,
    matchedCount: merged.matchedCount,
  };
}

export function summarizeSnapshot(
  parsed: ParsedSnapshot,
  merged: { preservedCount: number; matchedCount: number; rootPersonId: string },
): {
  personCount: number;
  errorCount: number;
  warningCount: number;
  starredName?: string;
  rootPersonId: string;
  preservedCount: number;
  matchedCount: number;
  sample: string[];
} {
  const errors = parsed.issues.filter((i) => i.level === "error");
  const warnings = parsed.issues.filter((i) => i.level === "warning");
  const starred = parsed.people.find((p) => p.id === parsed.starredId);
  return {
    personCount: parsed.people.length,
    errorCount: errors.length,
    warningCount: warnings.length,
    starredName: starred ? displayName(starred) : undefined,
    rootPersonId: merged.rootPersonId,
    preservedCount: merged.preservedCount,
    matchedCount: merged.matchedCount,
    sample: parsed.people.slice(0, 8).map((p) => `${p.id}: ${displayName(p)}`),
  };
}
