import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { FamilyConfig, FamilyDatabase } from "@/types/family";
import { hasDb, getSql } from "@/lib/sql";
import { parsePotrykusMarkdown } from "@/lib/parsePotrykusMd";
import { POTRYKUS_MARKDOWN } from "@/lib/potrykusSource";

export { getChildrenIds, getPersonMap } from "@/lib/tree";
export { formatPolishDate, displayName, lifespan } from "@/lib/db-client";

const DATA_DIR = path.join(process.cwd(), "data");
const FAMILY_PATH = path.join(DATA_DIR, "family.json");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export function familyFromMarkdown(markdown: string): FamilyDatabase {
  return parsePotrykusMarkdown(markdown);
}

export function bundledFamilyFromMarkdown(): FamilyDatabase {
  return parsePotrykusMarkdown(POTRYKUS_MARKDOWN);
}

async function readFamilyFromNeon(): Promise<FamilyDatabase | null> {
  if (!hasDb()) return null;
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT payload FROM family_graph WHERE id = 'default' LIMIT 1
    `) as { payload: FamilyDatabase }[];
    const payload = rows[0]?.payload;
    if (payload?.people?.length) return payload;
    return null;
  } catch {
    return null;
  }
}

async function writeFamilyToNeon(db: FamilyDatabase): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  await sql`
    INSERT INTO family_graph (id, payload, updated_at)
    VALUES ('default', ${db as never}, now())
    ON CONFLICT (id) DO UPDATE
      SET payload = EXCLUDED.payload,
          updated_at = now()
  `;
}

export async function ensureFamilySeeded(): Promise<void> {
  if (!hasDb()) return;
  const existing = await readFamilyFromNeon();
  if (existing) return;
  const seeded = bundledFamilyFromMarkdown();
  try {
    await writeFamilyToNeon(seeded);
  } catch {
    // table might not exist yet — caller should migrate first
  }
}

export type FamilyStorageInfo = {
  source: "neon" | "markdown";
  peopleCount: number;
  graphTable: boolean;
};

export async function inspectFamilyStorage(): Promise<FamilyStorageInfo> {
  const bundled = bundledFamilyFromMarkdown();
  if (!hasDb()) {
    return {
      source: "markdown",
      peopleCount: bundled.people.length,
      graphTable: false,
    };
  }
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT payload FROM family_graph WHERE id = 'default' LIMIT 1
    `) as { payload: FamilyDatabase }[];
    const payload = rows[0]?.payload;
    if (payload?.people?.length) {
      return {
        source: "neon",
        peopleCount: payload.people.length,
        graphTable: true,
      };
    }
    return {
      source: "markdown",
      peopleCount: bundled.people.length,
      graphTable: true,
    };
  } catch {
    return {
      source: "markdown",
      peopleCount: bundled.people.length,
      graphTable: false,
    };
  }
}

export async function persistBundledFamilyToNeon(): Promise<FamilyStorageInfo> {
  if (!hasDb()) {
    throw new Error("Brak połączenia z Neon.");
  }
  const { applySchemaMigrations } = await import("@/lib/bootstrap");
  await applySchemaMigrations();
  const existing = await readFamilyFromNeon();
  if (!existing) {
    await writeFamilyToNeon(bundledFamilyFromMarkdown());
  }
  return inspectFamilyStorage();
}

export async function readFamilyDb(): Promise<FamilyDatabase> {
  const fromNeon = await readFamilyFromNeon();
  if (fromNeon) return fromNeon;
  if (hasDb()) {
    try {
      const { applySchemaMigrations } = await import("@/lib/bootstrap");
      await applySchemaMigrations();
      await ensureFamilySeeded();
      const again = await readFamilyFromNeon();
      if (again) return again;
    } catch {
      /* still return parsed markdown */
    }
    return bundledFamilyFromMarkdown();
  }
  try {
    const raw = await readFile(FAMILY_PATH, "utf-8");
    const parsed = JSON.parse(raw) as FamilyDatabase;
    if (parsed.people?.length) return parsed;
  } catch {
    /* ignore */
  }
  return bundledFamilyFromMarkdown();
}

export async function writeFamilyDb(db: FamilyDatabase): Promise<void> {
  db.meta.updatedAt = new Date().toISOString();
  if (hasDb()) {
    await writeFamilyToNeon(db);
    return;
  }
  await writeFile(FAMILY_PATH, JSON.stringify(db, null, 2), "utf-8");
}

export async function importFamilyMarkdown(markdown: string): Promise<FamilyDatabase> {
  const db = familyFromMarkdown(markdown);
  await writeFamilyDb(db);
  return db;
}

/**
 * SESSION_SECRET must come from the environment — never from git.
 * Cookie name may fall back to data/config.json.
 */
export async function readConfig(): Promise<FamilyConfig> {
  const file = JSON.parse(await readFile(CONFIG_PATH, "utf-8")) as {
    cookieName?: string;
  };

  return {
    sessionSecret: process.env.SESSION_SECRET?.trim() || "",
    cookieName:
      process.env.COOKIE_NAME?.trim() ||
      file.cookieName ||
      "potrykus_family_session",
  };
}
