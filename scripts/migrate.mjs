#!/usr/bin/env node
/**
 * Apply SQL migrations against DATABASE_URL (Neon pooled connection preferred).
 * Usage: DATABASE_URL=... npm run db:migrate
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.error("DATABASE_URL is missing. Set it (Neon pooled URL) and retry.");
  process.exit(1);
}

const sql = neon(url);
const dir = join(root, "migrations");
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log(`Migrating ${files.length} file(s) against Neon…`);

for (const file of files) {
  const body = readFileSync(join(dir, file), "utf8");
  // Split on semicolons that end statements; keep it simple for our migrations
  const statements = body
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith("--"));

  console.log(`→ ${file} (${statements.length} statements)`);
  for (const statement of statements) {
    await sql.query(statement.endsWith(";") ? statement : `${statement};`);
  }
}

console.log("Done.");
