import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import {
  readSubmissions,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { z } from "zod";
import type { ChangeSubmission } from "@/types/submissions";

const ADMIN_CODE = process.env.ADMIN_CODE?.trim() || "PotrykusAdmin";

function adminOk(request: Request): boolean {
  const header = request.headers.get("x-admin-code")?.trim();
  return Boolean(header && header === ADMIN_CODE);
}

export async function GET(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  if (!adminOk(request)) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 403 });
  }
  const submissions = await readSubmissions();
  return NextResponse.json({ storage: storageMode(), submissions });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "reviewed", "accepted", "rejected", "local_only"]),
});

export async function PATCH(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  if (!adminOk(request)) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const updated = await updateSubmissionStatus(
    parsed.data.id,
    parsed.data.status as ChangeSubmission["status"],
  );
  if (!updated) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, submission: updated });
}
