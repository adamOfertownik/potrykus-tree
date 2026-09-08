import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Neon / Vercel Postgres connection string.
 * Marketplace integration often injects POSTGRES_URL instead of DATABASE_URL.
 */
const URL_KEYS = [
  "DATABASE_URL",
  "potrykus_DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_POOLED",
  "POSTGRES_PRISMA_URL",
  "NEON_DATABASE_URL",
  "potrykus_DATABASE_URL_UNPOOLED",
];

export function databaseUrl(): string {
  for (const key of URL_KEYS) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

let sql: NeonQueryFunction<false, false> | null | undefined;

export function hasDb(): boolean {
  return Boolean(databaseUrl());
}

export function getSql(): NeonQueryFunction<false, false> {
  const url = databaseUrl();
  if (!url) {
    throw new Error(
      "Brak connection string do Neona (DATABASE_URL / potrykus_DATABASE_URL).",
    );
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
