/** Shared with src/lib/sql.ts — keep the key list in sync. */
const URL_KEYS = [
  "DATABASE_URL",
  "potrykus_DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_POOLED",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "potrykus_DATABASE_URL_UNPOOLED",
];

export function databaseUrl() {
  for (const key of URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}
