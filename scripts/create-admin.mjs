#!/usr/bin/env node
/**
 * Create an admin user in Neon.
 * Usage: DATABASE_URL=... node scripts/create-admin.mjs <email> <password>
 */
import { hash } from "bcryptjs";
import { Pool } from "@neondatabase/serverless";

const [email, password] = process.argv.slice(2);
const url = process.env.DATABASE_URL?.trim();

if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}
if (!email || !password) {
  console.error("Usage: node scripts/create-admin.mjs <email> <password>");
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
    `INSERT INTO admin_users (email, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id, email, created_at`,
    [email.trim().toLowerCase(), passwordHash],
  );
  const admin = rows[0];
  console.log(`Admin ready: ${admin.email} (${admin.id})`);
} finally {
  await pool.end();
}
