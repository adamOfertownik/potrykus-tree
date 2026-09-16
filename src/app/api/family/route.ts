import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { readFamilyDb, toFamilyPayload } from "@/lib/db";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json(
      { error: "Wymagany kod rodzinny.", unlocked: false },
      { status: 401 },
    );
  }

  const db = await readFamilyDb();
  return NextResponse.json(toFamilyPayload(db));
}
