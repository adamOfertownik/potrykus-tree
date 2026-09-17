#!/usr/bin/env node
/**
 * Create an admin user in Neon.
 * Usage: DATABASE_URL=... node scripts/create-admin.mjs <email> <password>
 */
import { hash } from "bcryptjs";
import { Pool } from "@neondatabase/serverless";
import { loadEnvFiles } from "./load-env.mjs";

loadEnvFiles();

const [email, password, roleArg] = process.argv.slice(2);
const url = process.env.DATABASE_URL?.trim();
const role = roleArg === "pay" ? "pay" : "admin";

if (!url) {
  console.error("DATABASE_URL is missing.");
  process.exit(1);
}
if (!email || !password) {
  console.error(
    "Usage: node scripts/create-admin.mjs <email> <password> [admin|pay]",
  );
  process.exit(1);
}
if (email.includes("@") && /@(example\.(com|org|net)|[^@]+\.invalid)$/i.test(email)) {
  console.error("That email is reserved for tests. Use a real address.");
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
    `INSERT INTO admin_users (email, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
     RETURNING id, email, role, created_at`,
    [email.trim().toLowerCase(), passwordHash, role],
  );
  const admin = rows[0];
  console.log(`Admin ready: ${admin.email} (${admin.id}, ${admin.role})`);
} finally {
  await pool.end();
}
