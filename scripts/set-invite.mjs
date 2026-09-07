#!/usr/bin/env node
/**
 * Set the family invite key (stored as bcrypt hash).
 * Usage: node scripts/set-invite.mjs "klucz-min-8-znakow"
 */
import { hash } from "bcryptjs";
import { Pool } from "@neondatabase/serverless";
import { resolveDirectDatabaseUrl } from "./db-url.mjs";

const code = process.argv.slice(2).join(" ").trim();
const { url } = resolveDirectDatabaseUrl();

if (!url) {
  console.error("Neon URL is missing.");
  process.exit(1);
}
if (code.length < 8) {
  console.error("Invite key must be at least 8 characters.");
  process.exit(1);
}

const pool = new Pool({ connectionString: url });
try {
  const inviteHash = await hash(code, 12);
  await pool.query(
    `INSERT INTO app_settings (id, invite_code_hash, invite_updated_at)
     VALUES ('default', $1, now())
     ON CONFLICT (id) DO UPDATE
       SET invite_code_hash = EXCLUDED.invite_code_hash,
           invite_updated_at = now()`,
    [inviteHash],
  );
  console.log("Invite key saved (hash only). Tell the family the plaintext privately.");
} finally {
  await pool.end();
}
