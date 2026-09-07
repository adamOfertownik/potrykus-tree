/**
 * Resolve a Neon URL without printing it.
 * Vercel Marketplace may inject potrykus_DATABASE_URL instead of DATABASE_URL.
 */
const POOLED_KEYS = [
  "DATABASE_URL",
  "potrykus_DATABASE_URL",
  "POSTGRES_URL",
  "potrykus_POSTGRES_URL",
];

const DIRECT_KEYS = [
  "DATABASE_URL_UNPOOLED",
  "potrykus_DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "potrykus_POSTGRES_URL_NON_POOLING",
  ...POOLED_KEYS,
];

function firstUrl(keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return { key, url: value };
  }
  return { key: null, url: "" };
}

/** Pooled URL for the Next.js app. */
export function resolveDatabaseUrl() {
  return firstUrl(POOLED_KEYS);
}

/** Direct URL for migrations and admin scripts. */
export function resolveDirectDatabaseUrl() {
  return firstUrl(DIRECT_KEYS);
}
