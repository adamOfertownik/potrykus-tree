import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { readFamilyDb } from "@/lib/db";
import { snapshotPeople } from "@/lib/familyMutations";
import { appendSubmission } from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { submissionPayloadSchema } from "@/lib/validation";
import {
  sanitizeMultiline,
  sanitizePlainText,
} from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { ChangeSubmission } from "@/types/submissions";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  return NextResponse.json(
    { error: "Lista zgłoszeń jest dostępna tylko dla admina." },
    { status: 403 },
  );
}

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const limited = rateLimit(`sub:${clientIp(request)}`, 15, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Za dużo zgłoszeń. Spróbuj za ${limited.retryAfterSec} s.` },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSec) },
      },
    );
  }

  try {
    const json = await request.json();
    const parsed = submissionPayloadSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Nieprawidłowe dane zgłoszenia.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    const db = await readFamilyDb();
    const targetIds = [
      body.targetPersonId,
      body.graphEdit?.anchorPersonId,
      body.graphEdit?.relatedPersonId,
      ...(body.graphEdits ?? []).flatMap((edit) => [
        edit.anchorPersonId,
        edit.relatedPersonId,
      ]),
    ].filter((id): id is string => Boolean(id));

    const draft: ChangeSubmission = {
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: body.kind,
      reporterName: sanitizePlainText(body.reporterName, 120),
      reporterPersonId: body.reporterPersonId,
      reporterPhone: body.reporterPhone || undefined,
      reporterEmail: body.reporterEmail,
      targetPersonId: body.targetPersonId,
      targetPersonName: body.targetPersonName
        ? sanitizePlainText(body.targetPersonName, 160)
        : undefined,
      message: sanitizeMultiline(body.message || "", 4000),
      self: body.self,
      relatives: body.relatives?.filter((r) => r.firstName?.trim()),
      graphEdit: body.graphEdit,
      graphEdits: body.graphEdits,
      correction: body.correction,
      photoUrl: body.photoUrl,
      photoAction: body.photoAction,
      before: snapshotPeople(db.people, targetIds),
      status: "new",
    };

    const saved = await appendSubmission(draft);
    const mode = storageMode();

    return NextResponse.json({
      ok: true,
      storage: mode,
      id: saved.id,
      warning:
        mode === "file"
          ? "Zapisano lokalnie (brak DATABASE_URL). Na produkcji ustaw Neon."
          : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }
}
