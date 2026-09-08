import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { FamilyConfig, FamilyDatabase } from "@/types/family";
import { getSql, hasDb } from "@/lib/sql";
export { getChildrenIds, getPersonMap } from "@/lib/tree";
export { formatPolishDate, displayName, lifespan } from "@/lib/db-client";

const DATA_DIR = path.join(process.cwd(), "data");
const FAMILY_PATH = path.join(DATA_DIR, "family.json");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

type FamilyRow = {
  meta: FamilyDatabase["meta"] | string;
  people: FamilyDatabase["people"] | string;
};

function parseFamilyRow(row: FamilyRow): FamilyDatabase {
  const meta = typeof row.meta === "string" ? JSON.parse(row.meta) : row.meta;
  const people =
    typeof row.people === "string" ? JSON.parse(row.people) : row.people;
  if (!meta || typeof meta !== "object" || !Array.isArray(people)) {
    throw new Error("Nieprawidłowy dokument drzewa w Neonie.");
  }
  return { meta, people };
}

function isMissingFamilyTable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /family_tree/i.test(message) && /does not exist|42P01/i.test(message);
}

export async function readFamilyFile(): Promise<FamilyDatabase> {
  const raw = await readFile(FAMILY_PATH, "utf-8");
  return JSON.parse(raw) as FamilyDatabase;
}

async function writeFamilyFile(db: FamilyDatabase): Promise<void> {
  await writeFile(FAMILY_PATH, JSON.stringify(db, null, 2) + "\n", "utf-8");
}

async function selectFamily(): Promise<FamilyDatabase | null> {
  const sql = getSql();
  const rows = (await sql`
    SELECT meta, people FROM family_tree WHERE id = 'current' LIMIT 1
  `) as FamilyRow[];
  if (!rows[0]) return null;
  return parseFamilyRow(rows[0]);
}

async function upsertFamily(db: FamilyDatabase): Promise<void> {
  const sql = getSql();
  const metaJson = JSON.stringify(db.meta);
  const peopleJson = JSON.stringify(db.people);
  await sql`
    INSERT INTO family_tree (id, meta, people, updated_at)
    VALUES ('current', ${metaJson}::jsonb, ${peopleJson}::jsonb, now())
    ON CONFLICT (id) DO UPDATE SET
      meta = EXCLUDED.meta,
      people = EXCLUDED.people,
      updated_at = now()
  `;
}

async function bootstrapFamilyIfEmpty(): Promise<FamilyDatabase> {
  const existing = await selectFamily();
  if (existing) return existing;
  const fromFile = await readFamilyFile();
  try {
    await sqlInsertIfEmpty(fromFile);
  } catch {
    // Concurrent bootstrap — another request may have inserted first.
  }
  return (await selectFamily()) ?? fromFile;
}

async function sqlInsertIfEmpty(db: FamilyDatabase): Promise<void> {
  const sql = getSql();
  const metaJson = JSON.stringify(db.meta);
  const peopleJson = JSON.stringify(db.people);
  await sql`
    INSERT INTO family_tree (id, meta, people, updated_at)
    VALUES ('current', ${metaJson}::jsonb, ${peopleJson}::jsonb, now())
    ON CONFLICT (id) DO NOTHING
  `;
}

export async function readFamilyDb(): Promise<FamilyDatabase> {
  if (!hasDb()) return readFamilyFile();
  try {
    return await bootstrapFamilyIfEmpty();
  } catch (err) {
    if (isMissingFamilyTable(err)) return readFamilyFile();
    throw err;
  }
}

export async function writeFamilyDb(db: FamilyDatabase): Promise<void> {
  db.meta.updatedAt = new Date().toISOString();
  if (!hasDb()) {
    await writeFamilyFile(db);
    return;
  }
  try {
    await upsertFamily(db);
  } catch (err) {
    if (isMissingFamilyTable(err)) {
      await writeFamilyFile(db);
      throw new Error(
        "Tabela family_tree nie istnieje. Uruchom `npm run db:migrate`, potem zapisz ponownie.",
      );
    }
    throw err;
  }
}

export async function replaceFamilyFromFile(): Promise<FamilyDatabase> {
  const db = await readFamilyFile();
  db.meta.updatedAt = new Date().toISOString();
  if (!hasDb()) {
    throw new Error("Brak DATABASE_URL — nie można zapisać drzewa do Neona.");
  }
  await upsertFamily(db);
  return db;
}

/**
 * Env wins in production; data/config.json is the local/dev fallback.
 * Prefer SESSION_SECRET + ACCESS_CODE_HASH so the file can stay out of prod secrets.
 */
export async function readConfig(): Promise<FamilyConfig> {
  const file = JSON.parse(
    await readFile(CONFIG_PATH, "utf-8"),
  ) as FamilyConfig;

  return {
    accessCodeHash:
      process.env.ACCESS_CODE_HASH?.trim() || file.accessCodeHash,
    sessionSecret: process.env.SESSION_SECRET?.trim() || file.sessionSecret,
    cookieName:
      process.env.COOKIE_NAME?.trim() ||
      file.cookieName ||
      "potrykus_family_session",
  };
}
