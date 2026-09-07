import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSchemaHealth, needsFirstAdmin } from "@/lib/bootstrap";
import { storageMode } from "@/lib/sql";

export async function GET() {
  const session = await getSession();
  let setup = {
    needsFirstAdmin: false,
    missingTables: false,
  };
  try {
    const health = await getSchemaHealth();
    setup = {
      needsFirstAdmin: needsFirstAdmin(health),
      missingTables: health.missingTables,
    };
  } catch {
    setup = { needsFirstAdmin: false, missingTables: false };
  }
  return NextResponse.json({
    unlocked: Boolean(session),
    role: session?.role ?? null,
    email: session?.email ?? null,
    storage: storageMode(),
    ...setup,
  });
}
