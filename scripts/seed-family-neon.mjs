#!/usr/bin/env node
/**
 * Upsert data/family.json into Neon family_tree.
 * Usage: npm run db:seed-family
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { databaseUrl } from "./db-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const FAMILY_PATH = join(root, "data", "family.json");

export async function upsertFamilyToNeon(family) {
  const url = databaseUrl();
  if (!url) {
    throw new Error("Brak DATABASE_URL / POSTGRES_URL.");
  }
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(
      `INSERT INTO family_tree (id, meta, people, updated_at)
       VALUES ('current', $1::jsonb, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET
         meta = EXCLUDED.meta,
         people = EXCLUDED.people,
         updated_at = now()`,
      [JSON.stringify(family.meta), JSON.stringify(family.people)],
    );
  } finally {
    await pool.end();
  }
}

async function main() {
  const family = JSON.parse(readFileSync(FAMILY_PATH, "utf8"));
  const n = Array.isArray(family.people) ? family.people.length : 0;
  await upsertFamilyToNeon(family);
  console.log(`Zapisano ${n} osób do Neon (family_tree).`);
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
