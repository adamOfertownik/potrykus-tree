#!/usr/bin/env node
/**
 * Check that DATABASE_URL reaches Neon. Does not print the URL or secrets.
 * Usage: DATABASE_URL=... npm run db:check
 */
import { Pool } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Neon: DATABASE_URL is not set.");
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
  console.log(`Neon: connected (database reachable, ${rows[0].db}).`);
} catch (err) {
  const message = err instanceof Error ? err.message : "unknown error";
  console.error(`Neon: connection failed (${message.split("\n")[0]}).`);
  process.exit(1);
} finally {
  await pool.end();
}
