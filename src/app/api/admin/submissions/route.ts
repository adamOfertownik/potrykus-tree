import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import {
  readSubmissions,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { z } from "zod";
import type { ChangeSubmission } from "@/types/submissions";

async function requireAdmin() {
  const ctx = await getAuthContext();
  if (!ctx.unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  if (!ctx.canEdit) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const submissions = await readSubmissions();
  return NextResponse.json({ storage: storageMode(), submissions });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "reviewed", "accepted", "rejected", "local_only"]),
});

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

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
