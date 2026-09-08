import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { storageMode } from "@/lib/sql";

export const dynamic = "force-dynamic";

export async function GET() {
  const unlocked = await isSessionValid();
  return NextResponse.json({
    unlocked,
    storage: storageMode(),
  });
}
