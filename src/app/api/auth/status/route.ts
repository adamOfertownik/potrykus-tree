import { NextResponse } from "next/server";
import { getFamilySession } from "@/lib/auth";
import { storageMode } from "@/lib/sql";

export async function GET() {
  const session = await getFamilySession();
  return NextResponse.json({
    unlocked: session !== null,
    remember: session?.remember ?? false,
    storage: storageMode(),
  });
}
