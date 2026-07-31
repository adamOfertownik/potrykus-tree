import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sql: NeonQueryFunction<false, false> | null | undefined;

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export function getSql(): NeonQueryFunction<false, false> {
  if (!hasDb()) {
    throw new Error("DATABASE_URL is not set");
  }
  if (sql === undefined || sql === null) {
    sql = neon(process.env.DATABASE_URL!);
  }
  return sql;
}

export type StorageMode = "neon" | "file";

export function storageMode(): StorageMode {
  return hasDb() ? "neon" : "file";
}
