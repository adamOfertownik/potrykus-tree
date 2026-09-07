import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { persistBundledFamilyToNeon } from "@/lib/db";

export async function POST() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  try {
    const tree = await persistBundledFamilyToNeon();
    return NextResponse.json({
      ok: true,
      tree,
      seeded: tree.source === "neon",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać drzewa.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
