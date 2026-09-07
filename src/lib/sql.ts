import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Vercel Marketplace Neon often prefixes vars with the store name
 * (`potrykus_DATABASE_URL`). Prefer the pooled URL.
 */
const DB_URL_KEYS = [
  "DATABASE_URL",
  "potrykus_DATABASE_URL",
  "POSTGRES_URL",
  "potrykus_POSTGRES_URL",
] as const;

export function getDatabaseUrl(): string {
  for (const key of DB_URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

export function getDatabaseUrlKey(): string | null {
  for (const key of DB_URL_KEYS) {
    if (process.env[key]?.trim()) return key;
  }
  return null;
}

let sql: NeonQueryFunction<false, false> | null | undefined;

export function hasDb(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Neon database URL is not set");
  }
  if (sql === undefined || sql === null) {
    sql = neon(url);
  }
  return sql;
}

export type StorageMode = "neon" | "file";

export function storageMode(): StorageMode {
  return hasDb() ? "neon" : "file";
}
