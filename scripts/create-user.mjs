#!/usr/bin/env node
/**
 * Create a family/admin user in Neon (app_users).
 * Usage: DATABASE_URL=... node scripts/create-user.mjs <email> <password> [member|admin]
 */
import { hash } from "bcryptjs";
import { Pool } from "@neondatabase/serverless";
import { resolveDatabaseUrl } from "./db-url.mjs";

const [email, password, roleArg] = process.argv.slice(2);
const { url } = resolveDatabaseUrl();
const role = roleArg === "admin" ? "admin" : "member";

if (!url) {
  console.error("Neon URL is missing (DATABASE_URL or potrykus_DATABASE_URL).");
  process.exit(1);
}
if (!email || !password) {
  console.error(
    "Usage: node scripts/create-user.mjs <email> <password> [member|admin]",
  );
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });

try {
  const passwordHash = await hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO app_users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role
     RETURNING id, email, role, created_at`,
    [email.trim().toLowerCase(), passwordHash, role],
  );
  const user = rows[0];
  console.log(`User ready: ${user.email} (${user.role}, ${user.id})`);
} finally {
  await pool.end();
}
