#!/usr/bin/env node
/**
 * Create an admin user in Neon.
 * Usage: DATABASE_URL=... node scripts/create-admin.mjs <email> <password>
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const [email, password] = process.argv.slice(2);
const script = join(dirname(fileURLToPath(import.meta.url)), "create-user.mjs");
const child = spawn(process.execPath, [script, email, password, "admin"], {
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
