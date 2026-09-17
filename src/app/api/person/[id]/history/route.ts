import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { readFamilyDb } from "@/lib/db";
import {
  PERSON_HISTORY_NOTE,
  describePersonHistory,
} from "@/lib/submissionHistory";
import { readSubmissions } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isSessionValid())) {
    return NextResponse.json(
      { error: "Wymagany kod rodzinny.", unlocked: false },
      { status: 401 },
    );
  }

  const { id } = await params;
  const personId = decodeURIComponent(id);
  const db = await readFamilyDb();
  const person = db.people.find((p) => p.id === personId);
  if (!person) {
    return NextResponse.json({ error: "Nie znaleziono osoby." }, { status: 404 });
  }

  const submissions = await readSubmissions();
  return NextResponse.json(
    {
      items: describePersonHistory(submissions, person, db.people),
      note: PERSON_HISTORY_NOTE,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
