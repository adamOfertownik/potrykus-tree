#!/usr/bin/env node
/**
 * Import ID-based genealogical Markdown into data/family.json.
 *
 *   node scripts/import-md.mjs [plik.md] [--out data/family.json] [--merge] [--dry-run]
 *
 * Without arguments:
 *   node scripts/import-md.mjs
 * uses data/snapshots/drzewo-potrykus.md → data/family.json with --merge.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PERSON_LINE = /^(\s*)-\s*\[([A-Za-z][A-Za-z0-9]*)\]\s+(.+)$/;
const ISO_DATE = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/;

function normalizeId(raw) {
  return raw.trim().toLowerCase();
}

function isBlankRef(value) {
  const v = value.trim();
  return !v || v === "—" || v === "–" || v === "-" || v === "–";
}

function parseIdList(raw) {
  if (isBlankRef(raw)) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => !isBlankRef(part))
    .map(normalizeId);
}

function splitName(raw) {
  const cleaned = raw
    .replace(/[★☆*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–—]+|[-–—]+$/g, "")
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

function parseGender(raw) {
  const g = (raw || "").trim().toLowerCase();
  if (g === "k" || g === "f" || g === "female") return "female";
  if (g === "m" || g === "male") return "male";
  return "unknown";
}

function parseFlexibleDate(raw) {
  const value = raw.trim();
  if (!value) return {};
  const approx = value.match(/^ok\.?\s*(\d{4})$/i);
  if (approx) return { iso: approx[1], leftover: `ok. ${approx[1]}` };
  if (ISO_DATE.test(value)) return { iso: value };
  return { leftover: value };
}

function parseFieldChunks(chunks) {
  const notes = [];
  let birthDate;
  let deathDate;
  let parentIds = [];
  let spouseIds = [];

  for (const chunk of chunks) {
    const text = chunk.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const take = (n) => text.slice(n).trim().replace(/^:\s*/, "");

    if (lower.startsWith("ur.") || lower.startsWith("ur:")) {
      const parsed = parseFlexibleDate(take(3));
      if (parsed.iso) birthDate = parsed.iso;
      if (parsed.leftover) notes.push(`ur. ${parsed.leftover}`);
      continue;
    }
    if (lower.startsWith("zm.") || lower.startsWith("zm:")) {
      const parsed = parseFlexibleDate(take(3));
      if (parsed.iso) deathDate = parsed.iso;
      if (parsed.leftover) notes.push(`zm. ${parsed.leftover}`);
      continue;
    }
    if (lower.startsWith("rodzic")) {
      parentIds = parseIdList(take("rodzic".length).replace(/^:/, ""));
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

export function parseFamilyMarkdown(markdown) {
  const issues = [];
  const people = [];
  const byId = new Map();
  let starredId;
  const lines = markdown.split(/\r?\n/);
  let lineCount = 0;

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
    lineCount += 1;
    const rawId = match[2];
    const id = normalizeId(rawId);
    const chunks = match[3].trim().split(/\s*\|\s*/);
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
    const starred = /[★☆]/.test(nameRaw) || /szukana/i.test(nameRaw);
    nameRaw = nameRaw.replace(/[★☆*]+/g, " ").replace(/\s+/g, " ").trim();
    const szukana = nameRaw.match(/\(([^)]*SZUKANA[^)]*)\)/i);
    if (szukana) {
      fields.notes.unshift(szukana[1].trim());
      nameRaw = nameRaw.replace(szukana[0], "").replace(/\s+/g, " ").trim();
    }
    if (
      starred ||
      fields.notes.some((n) => /szukana/i.test(n))
    ) {
      starredId = id;
      if (!fields.notes.some((n) => /szukana/i.test(n))) {
        fields.notes.unshift("SZUKANA OSOBA");
      }
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
    if (!lastName || lastName === "★" || lastName === "*") {
      issues.push({
        level: "warning",
        line: lineNo,
        message: `${rawId}: podejrzane nazwisko „${lastName}” — usuń dekoracje z linii.`,
      });
    }

    const notes = fields.notes.filter(Boolean).join(" ").trim() || undefined;
    const person = {
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
    person.spouseIds = [...new Set(person.spouseIds)];
    for (const spouseId of person.spouseIds) {
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
        "Brak osób w pliku. Format: - [P001] Imię Nazwisko | m | rodzic: — | małżonek: —",
    });
  }

  return { people, issues, starredId, lineCount };
}

function pickRootPersonId(parsed, preferred) {
  if (preferred && parsed.people.some((p) => p.id === preferred)) return preferred;
  const wincenty = parsed.people.find(
    (p) =>
      p.firstName.toLowerCase().includes("wincenty") ||
      p.firstName.toLowerCase().includes("vincentius"),
  );
  if (wincenty) return wincenty.id;
  if (parsed.starredId) return parsed.starredId;
  const sought = parsed.people.find((p) => /szukana/i.test(p.notes || ""));
  if (sought) return sought.id;
  return parsed.people.find((p) => p.parentIds.length === 0)?.id || parsed.people[0]?.id || "";
}

function norm(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function surnamesOf(person) {
  const names = [norm(person.lastName)];
  if (person.maidenName) names.push(norm(person.maidenName));
  return [...new Set(names.filter(Boolean))];
}

function findExistingMatch(person, existing, alreadyMatched) {
  const unused = existing.filter((p) => !alreadyMatched.has(p.id));
  if (person.birthDate) {
    const byBirth = unused.filter(
      (p) =>
        p.birthDate === person.birthDate &&
        norm(p.firstName) === norm(person.firstName),
    );
    if (byBirth.length === 1) return byBirth[0];
    const surnameHit = byBirth.filter((p) =>
      surnamesOf(p).some((s) => surnamesOf(person).includes(s)),
    );
    if (surnameHit.length === 1) return surnameHit[0];
  }
  const nameHits = unused.filter((p) =>
    surnamesOf(p).some((s) => surnamesOf(person).includes(s)) &&
    norm(p.firstName) === norm(person.firstName),
  );
  if (nameHits.length === 1) {
    const hit = nameHits[0];
    if (!person.birthDate || !hit.birthDate || person.birthDate === hit.birthDate) {
      return hit;
    }
  }
  return undefined;
}

export function mergeImportedPeople(imported, existing) {
  const oldToNew = new Map();
  const matchedOldIds = new Set();
  let matchedCount = 0;

  const people = imported.map((person) => {
    const previous = findExistingMatch(person, existing, matchedOldIds);
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
    const next = {
      ...person,
      parentIds: [...person.parentIds],
      spouseIds: [...person.spouseIds],
      photoUrl: previous.photoUrl || person.photoUrl,
      phone: previous.phone || person.phone,
    };
    if (previous.maidenName && !next.maidenName) next.maidenName = previous.maidenName;
    if (!next.notes && previous.notes) next.notes = previous.notes;
    return next;
  });

  const importedIds = new Set(people.map((p) => p.id));
  const extras = [];
  for (const person of existing) {
    if (matchedOldIds.has(person.id) || importedIds.has(person.id)) continue;
    const placeholder =
      /linia-glowna|galaz-page|branch/i.test(person.id) ||
      (person.gender === "unknown" && /linia|gałąź|galaz/i.test(person.firstName));
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
      if (spouse && !spouse.spouseIds.includes(extra.id)) spouse.spouseIds.push(extra.id);
    }
  }
  return { people: [...people, ...extras], preservedCount: extras.length, matchedCount };
}

function parseArgs(argv) {
  const args = { merge: false, dryRun: false, out: join(ROOT, "data/family.json"), file: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--merge") args.merge = true;
    else if (a === "--dry-run") args.dryRun = true;
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--help" || a === "-h") args.help = true;
    else if (a.startsWith("-")) {
      throw new Error(`Nieznana flaga: ${a}`);
    } else rest.push(a);
  }
  args.file =
    rest[0] || join(ROOT, "data/snapshots/drzewo-potrykus.md");
  if (!isAbsolute(args.file)) args.file = resolve(process.cwd(), args.file);
  if (!isAbsolute(args.out)) args.out = resolve(process.cwd(), args.out);
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (args.help) {
    console.log(`Użycie:
  node scripts/import-md.mjs [plik.md] [--out data/family.json] [--merge] [--dry-run]

Przykład:
  node scripts/import-md.mjs data/snapshots/drzewo_potrykus_ID.md --out data/family.json --merge`);
    return;
  }

  if (!existsSync(args.file)) {
    console.error(`Nie znaleziono pliku Markdown:
  ${args.file}

Uruchom z katalogu repozytorium, np.:
  node scripts/import-md.mjs data/snapshots/drzewo-potrykus.md --out data/family.json --merge

Bieżący katalog: ${process.cwd()}`);
    process.exit(1);
  }

  const markdown = readFileSync(args.file, "utf8");
  const parsed = parseFamilyMarkdown(markdown);
  const errors = parsed.issues.filter((i) => i.level === "error");
  const warnings = parsed.issues.filter((i) => i.level === "warning");
  console.log(
    `Sparsowano ${parsed.people.length} osób (${parsed.lineCount} linii), błędów: ${errors.length}, ostrzeżeń: ${warnings.length}`,
  );
  const p060 = parsed.people.find((p) => p.id === "p060");
  if (p060) {
    console.log(`P060: ${p060.firstName} ${p060.lastName}`);
    if (/[★☆*]/.test(p060.lastName) || p060.lastName === "NN") {
      console.error("P060 ma zepsute nazwisko — usuń dekoracyjne ★ z linii osoby.");
      process.exit(1);
    }
  }
  for (const issue of parsed.issues.slice(0, 30)) {
    const loc = issue.line ? `L${issue.line} ` : "";
    console.log(`  [${issue.level}] ${loc}${issue.message}`);
  }
  if (errors.length) {
    process.exit(1);
  }

  let existing = null;
  if (args.merge && existsSync(args.out)) {
    existing = JSON.parse(readFileSync(args.out, "utf8"));
  }
  const merged = args.merge && existing?.people
    ? mergeImportedPeople(parsed.people, existing.people)
    : { people: parsed.people, preservedCount: 0, matchedCount: 0 };
  const rootPersonId = pickRootPersonId(parsed);
  const db = {
    meta: {
      title: existing?.meta?.title || "Drzewo rodziny Potrykus",
      rootPersonId,
      creator: existing?.meta?.creator || "Adam Lieske",
      updatedAt: new Date().toISOString(),
      description:
        "Dane z snapshota Markdown (ID-based). Numery telefonów i zdjęcia zachowane przy dopasowaniu osób.",
    },
    people: merged.people,
  };
  console.log(
    `Korzeń: ${rootPersonId}; dopasowano ${merged.matchedCount}; extra: ${merged.preservedCount}; łącznie ${db.people.length}`,
  );
  if (args.dryRun) {
    console.log("Dry-run — nie zapisano pliku.");
    return;
  }
  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(db, null, 2)}\n`);
  console.log(`Zapisano ${args.out}`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) main();
