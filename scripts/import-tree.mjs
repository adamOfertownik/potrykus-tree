/**
 * Import drzewa z pliku ID-based (data/drzewo-potrykus.md) do data/family.json.
 *
 * Nie rusza data/config.json (kod rodzinny / sekret sesji).
 *
 * Użycie:
 *   npm run seed
 *   node scripts/import-tree.mjs [ścieżka.md]
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const DEFAULT_SOURCE = join(root, "data", "drzewo-potrykus.md");
const FAMILY_PATH = join(root, "data", "family.json");

const PERSON_RE =
  /^[ \t]*- \[(P[0-9]+)\] (.+?) \| ([mk?]) \| (.+)$/;

const ISO_DATE_RE = /^\d{4}(?:-\d{2})?(?:-\d{2})?$/;

const GENDER = { m: "male", k: "female", "?": "unknown" };

/** Wincenty — tytuł oryginalnego raportu PDF. */
const ROOT_PERSON_ID = "P015";

function splitName(full) {
  const trimmed = full.trim();
  const i = trimmed.lastIndexOf(" ");
  if (i <= 0) return { firstName: trimmed, lastName: trimmed };
  return {
    firstName: trimmed.slice(0, i).trim(),
    lastName: trimmed.slice(i + 1).trim(),
  };
}

function parseIdList(raw) {
  if (!raw) return [];
  const t = raw.trim();
  if (!t || t === "—" || t === "-" || t === "–") return [];
  return t
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^P\d+$/.test(s));
}

function parseDateValue(raw) {
  const t = raw.trim();
  if (ISO_DATE_RE.test(t)) return { date: t, extra: null };
  return { date: undefined, extra: t };
}

function parseFields(rest) {
  const parts = rest.split(" | ").map((s) => s.trim());
  /** @type {{ birthDate?: string, deathDate?: string, parentIds: string[], spouseIds: string[], notes?: string }} */
  const out = { parentIds: [], spouseIds: [] };
  const noteBits = [];

  for (const part of parts) {
    if (part.startsWith("ur. ")) {
      const { date, extra } = parseDateValue(part.slice(4));
      if (date) out.birthDate = date;
      if (extra) noteBits.push(`ur. ${extra}`);
      continue;
    }
    if (part.startsWith("zm. ")) {
      const { date, extra } = parseDateValue(part.slice(4));
      if (date) out.deathDate = date;
      if (extra) noteBits.push(`zm. ${extra}`);
      continue;
    }
    if (part.startsWith("rodzic:")) {
      out.parentIds = parseIdList(part.slice("rodzic:".length));
      continue;
    }
    if (part.startsWith("małżonek:")) {
      out.spouseIds = parseIdList(part.slice("małżonek:".length));
      continue;
    }
    if (part.startsWith("notatka:")) {
      const n = part.slice("notatka:".length).trim();
      if (n) noteBits.push(n);
      continue;
    }
    noteBits.push(part);
  }

  if (noteBits.length) out.notes = noteBits.join(" — ");
  return out;
}

export function parseTreeMarkdown(markdown) {
  const daneIdx = markdown.indexOf("## DANE");
  const body = daneIdx >= 0 ? markdown.slice(daneIdx) : markdown;
  /** @type {Map<string, any>} */
  const byId = new Map();

  for (const line of body.split(/\r?\n/)) {
    const m = line.match(PERSON_RE);
    if (!m) continue;
    const id = m[1];
    const genderKey = m[3];
    const { firstName, lastName } = splitName(m[2]);
    const fields = parseFields(m[4]);
    if (byId.has(id)) {
      throw new Error(`Duplikat ID: ${id}`);
    }
    const person = {
      id,
      firstName,
      lastName,
      gender: GENDER[genderKey] || "unknown",
      parentIds: fields.parentIds,
      spouseIds: fields.spouseIds,
    };
    if (fields.birthDate) person.birthDate = fields.birthDate;
    if (fields.deathDate) person.deathDate = fields.deathDate;
    if (fields.notes) person.notes = fields.notes;
    byId.set(id, person);
  }

  const people = [...byId.values()].sort(
    (a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)),
  );

  const errors = [];
  for (const p of people) {
    for (const pid of p.parentIds) {
      if (!byId.has(pid)) errors.push(`${p.id}: brak rodzica ${pid}`);
    }
    const uniqueSpouses = [...new Set(p.spouseIds)];
    p.spouseIds = uniqueSpouses;
    for (const sid of uniqueSpouses) {
      if (!byId.has(sid)) {
        errors.push(`${p.id}: brak małżonka ${sid}`);
        continue;
      }
      const other = byId.get(sid);
      if (!other.spouseIds.includes(p.id)) other.spouseIds.push(p.id);
    }
  }

  if (errors.length) {
    throw new Error(`Błędy spójności (${errors.length}):\n${errors.join("\n")}`);
  }

  return people;
}

function buildFamily(people, sourceLabel) {
  if (!people.some((p) => p.id === ROOT_PERSON_ID)) {
    throw new Error(`Brak osoby głównej ${ROOT_PERSON_ID} w imporcie.`);
  }
  return {
    meta: {
      title: "Drzewo rodziny Potrykus",
      rootPersonId: ROOT_PERSON_ID,
      creator: "Adam Lieske",
      updatedAt: new Date().toISOString(),
      description:
        `Potomkowie Wincentego Potrykusa (${ROOT_PERSON_ID}) — import z pliku ${sourceLabel} (${people.length} osób). Identyfikatory P001… wg źródła. Numery telefonów i zdjęcia uzupełniaj lokalnie.`,
    },
    people,
  };
}

async function main() {
  const source = resolve(process.argv[2] || DEFAULT_SOURCE);
  const markdown = readFileSync(source, "utf8");
  const people = parseTreeMarkdown(markdown);
  if (people.length !== 418) {
    console.warn(
      `Ostrzeżenie: oczekiwano 418 osób, sparsowano ${people.length}.`,
    );
  }
  mkdirSync(join(root, "data"), { recursive: true });
  const family = buildFamily(people, source.replace(root + "/", ""));
  writeFileSync(FAMILY_PATH, JSON.stringify(family, null, 2) + "\n", "utf8");
  console.log(`Zapisano ${people.length} osób → ${FAMILY_PATH}`);
  console.log(`Korzeń listy/drzewa: ${ROOT_PERSON_ID}`);
  console.log("config.json nie został zmieniony.");

  if (process.env.DATABASE_URL?.trim()) {
    const { upsertFamilyToNeon } = await import("./seed-family-neon.mjs");
    await upsertFamilyToNeon(family);
    console.log("Zapisano to samo drzewo do Neon (family_tree).");
  }
}

const isDirect =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
