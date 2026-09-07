/**
 * Resolve a Neon pooled URL without printing it.
 * Vercel Marketplace may inject potrykus_DATABASE_URL instead of DATABASE_URL.
 */
const DB_URL_KEYS = [
  "DATABASE_URL",
  "potrykus_DATABASE_URL",
  "POSTGRES_URL",
  "potrykus_POSTGRES_URL",
];

export function resolveDatabaseUrl() {
  for (const key of DB_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return { key, url: value };
  }
  return { key: null, url: "" };
}
