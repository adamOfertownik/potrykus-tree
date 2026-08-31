import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/auth";
import {
  readSubmissions,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { z } from "zod";
import type { ChangeSubmission } from "@/types/submissions";

export async function GET() {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const submissions = await readSubmissions();
  return NextResponse.json({ storage: storageMode(), submissions });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "reviewed", "accepted", "rejected", "local_only"]),
});

export async function PATCH(request: Request) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
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
