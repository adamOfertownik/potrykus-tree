import { NextResponse } from "next/server";
import { getAdminSession, isSessionValid } from "@/lib/auth";
import { readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import {
  applyGraphMutations,
  snapshotPeople,
  type GraphMutationInput,
} from "@/lib/familyMutations";
import { appendSubmission, discardSketchesForReporter } from "@/lib/submissions";
import {
  graphMutationSchema,
  graphMutateRequestSchema,
} from "@/lib/validation";
import { sanitizePlainText, sanitizeConfirmEmail } from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import type { ChangeSubmission, GraphEditPayload } from "@/types/submissions";

function editsFromBody(json: unknown): GraphMutationInput[] {
  const parsed = graphMutateRequestSchema.safeParse(json);
  if (!parsed.success) {
    const msg =
      parsed.error.issues[0]?.message || "Nieprawidłowe dane mutacji.";
    throw Object.assign(new Error(msg), { status: 400 });
  }
  const body = parsed.data;
  const raw = body.edits?.length
    ? body.edits
    : [
        {
          op: body.op!,
          anchorPersonId: body.anchorPersonId!,
          relatedPersonId: body.relatedPersonId,
          newPerson: body.newPerson,
          secondParentId: body.secondParentId,
          replaceParentIds: body.replaceParentIds,
          reporterName: body.reporterName,
          reporterPersonId: body.reporterPersonId,
        },
      ];
  return raw.map((edit) => {
    const one = graphMutationSchema.safeParse(edit);
    if (!one.success) {
      const msg =
        one.error.issues[0]?.message || "Nieprawidłowe dane mutacji.";
      throw Object.assign(new Error(msg), { status: 400 });
    }
    return {
      op: one.data.op,
      anchorPersonId: one.data.anchorPersonId,
      relatedPersonId: one.data.relatedPersonId,
      newPerson: one.data.newPerson,
      secondParentId: one.data.secondParentId,
      replaceParentIds: one.data.replaceParentIds,
    };
  });
}

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
    const edits = editsFromBody(json);
    const reporterName = sanitizePlainText(
      (json as { reporterName?: string })?.reporterName?.trim() ||
        "Edycja grafu (aplikacja)",
      120,
    );
    const reporterPersonId = (json as { reporterPersonId?: string })
      ?.reporterPersonId;
    const reporterEmail = sanitizeConfirmEmail(
      (json as { reporterEmail?: string })?.reporterEmail,
    );

    const db = await readFamilyDb();
    const result = applyGraphMutations(db, edits);

    if (admin) {
      await writeFamilyDb(result.db, admin.adminId);
      return NextResponse.json({
        ok: true,
        applied: true,
        summary: result.summary,
        family: toFamilyPayload(result.db),
        createdPersonId: result.createdPeople.at(-1)?.id,
        createdPersonIds: result.createdPeople.map((p) => p.id),
      });
    }

    const graphEdits: GraphEditPayload[] = edits.map((edit, i) => ({
      ...edit,
      summary: result.summaries[i],
    }));

    const submission: ChangeSubmission = {
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: "graph_edit",
      reporterName,
      reporterPersonId,
      reporterEmail,
      targetPersonId: result.targetPersonId,
      targetPersonName: result.targetPersonName,
      message: result.summary,
      graphEdit: graphEdits[0],
      graphEdits: graphEdits.length > 1 ? graphEdits : undefined,
      before: snapshotPeople(db.people, [
        ...edits.flatMap((edit) => [
          edit.anchorPersonId,
          edit.relatedPersonId ?? "",
          edit.secondParentId ?? "",
        ]),
      ]),
      status: "new",
    };
    const saved = await appendSubmission(submission);
    await discardSketchesForReporter({
      reporterName,
      reporterPersonId,
    });

    return NextResponse.json({
      ok: true,
      applied: false,
      summary: result.summary,
      submissionId: saved.id,
      family: toFamilyPayload(db),
    });
  } catch (err) {
    const status = (err as { status?: number }).status;
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać zmiany.";
    return NextResponse.json(
      { error: message },
      { status: status === 400 ? 400 : 400 },
    );
  }
}
