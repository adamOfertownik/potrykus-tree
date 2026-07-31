import { readFile, writeFile } from "fs/promises";
import path from "path";
import type { FamilyConfig, FamilyDatabase } from "@/types/family";
export { getChildrenIds, getPersonMap } from "@/lib/tree";
export { formatPolishDate, displayName, lifespan } from "@/lib/db-client";

const DATA_DIR = path.join(process.cwd(), "data");
const FAMILY_PATH = path.join(DATA_DIR, "family.json");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export async function readFamilyDb(): Promise<FamilyDatabase> {
  const raw = await readFile(FAMILY_PATH, "utf-8");
  return JSON.parse(raw) as FamilyDatabase;
}

export async function writeFamilyDb(db: FamilyDatabase): Promise<void> {
  db.meta.updatedAt = new Date().toISOString();
  await writeFile(FAMILY_PATH, JSON.stringify(db, null, 2), "utf-8");
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
