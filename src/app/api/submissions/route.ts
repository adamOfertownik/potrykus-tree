import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendSubmission, readSubmissions } from "@/lib/submissions";
import type { ChangeSubmission, SubmissionPayload } from "@/types/submissions";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  const submissions = await readSubmissions();
  return NextResponse.json({
    prototype: true,
    warning:
      "Prototyp: zgłoszenia nie trafiają do trwałej bazy — damy znać, gdy podłączymy.",
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
    const body = (await request.json()) as SubmissionPayload;
    if (!body.reporterName?.trim()) {
      return NextResponse.json(
        { error: "Podaj, kto zgłasza zmianę." },
        { status: 400 },
      );
    }
    if (!body.message?.trim() && !body.self?.firstName) {
      return NextResponse.json(
        { error: "Dodaj opis zmiany albo swoje dane." },
        { status: 400 },
      );
    }

    const submission: ChangeSubmission = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      kind: body.kind || "other",
      reporterName: body.reporterName.trim(),
      reporterPersonId: body.reporterPersonId,
      reporterPhone: body.reporterPhone?.trim() || undefined,
      targetPersonId: body.targetPersonId,
      targetPersonName: body.targetPersonName?.trim() || undefined,
      message: (body.message || "").trim(),
      self: body.self,
      relatives: body.relatives?.filter((r) => r.firstName?.trim()),
      status: "local_only",
    };

    await appendSubmission(submission);

    return NextResponse.json({
      ok: true,
      prototype: true,
      warning:
        "Zapisano lokalnie na serwerze prototypu. Zgłoszenie NIE trafia jeszcze do trwałej bazy — damy znać.",
      id: submission.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }
}
