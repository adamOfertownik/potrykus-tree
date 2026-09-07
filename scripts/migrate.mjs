#!/usr/bin/env node
/**
 * Apply SQL migrations against DATABASE_URL (Neon pooled connection preferred).
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "./db-url.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const { key, url } = resolveDatabaseUrl();

if (!url) {
  console.error(
    "Neon URL is missing (DATABASE_URL or potrykus_DATABASE_URL).",
  );
  process.exit(1);
}
console.log(`Migrating against Neon via ${key}…`);

const pool = new Pool({ connectionString: url });
const dir = join(root, "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Migrating ${files.length} file(s)…`);

try {
  for (const file of files) {
    const body = readFileSync(join(dir, file), "utf8");
    console.log(`→ ${file}`);
    await pool.query(body);
  }
  console.log("Done.");
} finally {
  await pool.end();
}
