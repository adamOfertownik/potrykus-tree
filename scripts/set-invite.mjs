#!/usr/bin/env node
/**
 * Set an access key (stored as bcrypt hash).
 * Usage: node scripts/set-invite.mjs [member|admin|view] "klucz-min-8-znakow"
 */
import { hash } from "bcryptjs";
import { Pool } from "@neondatabase/serverless";
import { resolveDirectDatabaseUrl } from "./db-url.mjs";

const args = process.argv.slice(2);
const kinds = new Set(["member", "admin", "view"]);
let kind = "member";
let rest = args;
if (args[0] && kinds.has(args[0])) {
  kind = args[0];
  rest = args.slice(1);
}
const code = rest.join(" ").trim();
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
  const digest = await hash(code, 12);
  await pool.query(
    `INSERT INTO app_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`,
  );
  if (kind === "admin") {
    await pool.query(
      `UPDATE app_settings
       SET admin_invite_hash = $1, admin_invite_updated_at = now()
       WHERE id = 'default'`,
      [digest],
    );
  } else if (kind === "view") {
    await pool.query(
      `UPDATE app_settings
       SET family_view_hash = $1, family_view_updated_at = now()
       WHERE id = 'default'`,
      [digest],
    );
  } else {
    await pool.query(
      `UPDATE app_settings
       SET member_invite_hash = $1,
           member_invite_updated_at = now(),
           invite_code_hash = $1,
           invite_updated_at = now()
       WHERE id = 'default'`,
      [digest],
    );
  }
  console.log("Key saved (hash only). Share the plaintext privately.");
} finally {
  await pool.end();
}
