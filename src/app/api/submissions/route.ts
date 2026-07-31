import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendSubmission, readSubmissions } from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { submissionPayloadSchema } from "@/lib/validation";
import type { ChangeSubmission } from "@/types/submissions";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  const submissions = await readSubmissions();
  const mode = storageMode();
  return NextResponse.json({
    storage: mode,
    count: submissions.length,
    submissions,
  });
}

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
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

    const draft: ChangeSubmission = {
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: body.kind,
      reporterName: body.reporterName,
      reporterPersonId: body.reporterPersonId,
      reporterPhone: body.reporterPhone || undefined,
      targetPersonId: body.targetPersonId,
      targetPersonName: body.targetPersonName || undefined,
      message: body.message || "",
      self: body.self,
      relatives: body.relatives?.filter((r) => r.firstName?.trim()),
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
