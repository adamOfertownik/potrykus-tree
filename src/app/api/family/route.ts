import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { getChildrenIds, readFamilyDb } from "@/lib/db";
import type { FamilyPayload, PersonPublic } from "@/types/family";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json(
      { error: "Wymagany kod rodzinny.", unlocked: false },
      { status: 401 },
    );
  }

  const db = await readFamilyDb();
  const people: PersonPublic[] = db.people.map((p) => ({
    ...p,
    childrenIds: getChildrenIds(db.people, p.id),
  }));

  const payload: FamilyPayload = {
    meta: db.meta,
    people,
    unlocked: true,
  };

  return NextResponse.json(payload);
}
