import { NextResponse } from "next/server";
import { getAdminSession, isSessionValid } from "@/lib/auth";
import { readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import { applyGraphMutation, snapshotPeople } from "@/lib/familyMutations";
import { appendSubmission } from "@/lib/submissions";
import { graphMutationSchema } from "@/lib/validation";
import { sanitizePlainText } from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { ChangeSubmission } from "@/types/submissions";

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const admin = await getAdminSession();
  if (!admin) {
    const limited = rateLimit(`mutate:${clientIp(request)}`, 20, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: `Za dużo zgłoszeń. Spróbuj za ${limited.retryAfterSec} s.` },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }
  }

  try {
    const json = await request.json();
    const parsed = graphMutationSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Nieprawidłowe dane mutacji.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    const db = await readFamilyDb();
    const result = applyGraphMutation(db, {
      op: body.op,
      anchorPersonId: body.anchorPersonId,
      relatedPersonId: body.relatedPersonId,
      newPerson: body.newPerson,
      secondParentId: body.secondParentId,
      replaceParentIds: body.replaceParentIds,
    });

    const reporterName = sanitizePlainText(
      body.reporterName?.trim() || "Edycja grafu (aplikacja)",
      120,
    );

    if (admin) {
      await writeFamilyDb(result.db, admin.adminId);
      return NextResponse.json({
        ok: true,
        applied: true,
        summary: result.summary,
        family: toFamilyPayload(result.db),
        createdPersonId: result.createdPerson?.id,
      });
    }

    const submission: ChangeSubmission = {
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: "graph_edit",
      reporterName,
      reporterPersonId: body.reporterPersonId,
      targetPersonId: result.targetPersonId,
      targetPersonName: result.targetPersonName,
      message: result.summary,
      graphEdit: {
        op: body.op,
        anchorPersonId: body.anchorPersonId,
        relatedPersonId: body.relatedPersonId,
        secondParentId: body.secondParentId,
        replaceParentIds: body.replaceParentIds,
        newPerson: body.newPerson,
        summary: result.summary,
      },
      before: snapshotPeople(db.people, [
        body.anchorPersonId,
        body.relatedPersonId ?? "",
        body.secondParentId ?? "",
      ]),
      status: "new",
    };
    const saved = await appendSubmission(submission);

    return NextResponse.json({
      ok: true,
      applied: false,
      summary: result.summary,
      submissionId: saved.id,
      family: toFamilyPayload(db),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać zmiany.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
