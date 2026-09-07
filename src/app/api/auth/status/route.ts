import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { storageMode } from "@/lib/sql";

export async function GET() {
  const session = await getSession();
  return NextResponse.json({
    unlocked: Boolean(session),
    role: session?.role ?? null,
    email: session?.email ?? null,
    storage: storageMode(),
  });
}
