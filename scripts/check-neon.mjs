#!/usr/bin/env node
/**
 * Check that a Neon URL is set and reachable. Does not print the URL or secrets.
 * Usage: npm run db:check
 */
import { Pool } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "./db-url.mjs";

const { key, url } = resolveDatabaseUrl();
if (!url) {
  console.error(
    "Neon: no database URL (DATABASE_URL or potrykus_DATABASE_URL).",
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  const { rows } = await pool.query(
    "select 1 as ok, current_database() as db, now() as ts",
  );
  if (rows[0]?.ok !== 1) {
    console.error("Neon: unexpected ping result.");
    process.exit(1);
  }
  console.log(`Neon: connected via ${key} (database ${rows[0].db}).`);
} catch (err) {
  const message = err instanceof Error ? err.message : "unknown error";
  console.error(`Neon: connection failed (${message.split("\n")[0]}).`);
  process.exit(1);
} finally {
  await pool.end();
}
