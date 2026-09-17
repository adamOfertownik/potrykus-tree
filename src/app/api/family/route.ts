import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { readFamilyDb, toFamilyPayload } from "@/lib/db";
import { readRsvps } from "@/lib/event";
import { resolveAttendingPersonIds } from "@/lib/eventAttending";

export const dynamic = "force-dynamic";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json(
      { error: "Wymagany kod rodzinny.", unlocked: false },
      { status: 401 },
    );
  }

  const db = await readFamilyDb();
  const payload = toFamilyPayload(db);
  let attendingPersonIds: string[] = [];
  try {
    attendingPersonIds = resolveAttendingPersonIds(await readRsvps(), db.people);
  } catch {
    attendingPersonIds = [];
  }
  return NextResponse.json(
    { ...payload, attendingPersonIds },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
