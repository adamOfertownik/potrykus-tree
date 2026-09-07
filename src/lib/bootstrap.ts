import { Pool } from "@neondatabase/serverless";
import { getDatabaseUrl, hasDb } from "@/lib/sql";
import { SCHEMA_MIGRATIONS } from "@/lib/schemaMigrations";

function isMissingRelation(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /does not exist|42P01/i.test(msg);
}

export type SchemaHealth = {
  hasDb: boolean;
  missingTables: boolean;
  userCount: number;
};

export async function getSchemaHealth(): Promise<SchemaHealth> {
  if (!hasDb()) {
    return { hasDb: false, missingTables: false, userCount: 0 };
  }
  try {
    const { getSql } = await import("@/lib/sql");
    const sql = getSql();
    const rows = (await sql`
      SELECT count(*)::int AS n FROM app_users
    `) as { n: number }[];
    return {
      hasDb: true,
      missingTables: false,
      userCount: Number(rows[0]?.n ?? 0),
    };
  } catch (err) {
    if (isMissingRelation(err)) {
      return { hasDb: true, missingTables: true, userCount: 0 };
    }
    throw err;
  }
}

function splitSql(sql: string): string[] {
  return sql
    .split(";")
    .map((part) =>
      part
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

export async function applySchemaMigrations(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("Brak połączenia z Neon.");
  }
  const pool = new Pool({ connectionString: url });
  try {
    for (const step of SCHEMA_MIGRATIONS) {
      for (const statement of splitSql(step.sql)) {
        await pool.query(statement);
      }
    }
  } finally {
    await pool.end();
  }
}

export function needsFirstAdmin(health: SchemaHealth): boolean {
  return health.hasDb && health.userCount === 0;
}
