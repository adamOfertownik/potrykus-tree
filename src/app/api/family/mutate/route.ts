import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { getChildrenIds, readFamilyDb, writeFamilyDb } from "@/lib/db";
import { applyGraphMutation } from "@/lib/familyMutations";
import { appendSubmission } from "@/lib/submissions";
import { graphMutationSchema } from "@/lib/validation";
import type { FamilyPayload, PersonPublic } from "@/types/family";
import type { ChangeSubmission } from "@/types/submissions";

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx.unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  if (!ctx.canEdit) {
    return NextResponse.json(
      { error: "Tylko administrator może zmieniać drzewo." },
      { status: 403 },
    );
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

    let applied = false;
    let applyWarning: string | undefined;
    try {
      await writeFamilyDb(result.db);
      applied = true;
    } catch {
      applyWarning =
        "Nie udało się zapisać drzewa na dysku (np. Vercel EROFS). Zmiana jest w zgłoszeniu i w tej sesji.";
    }

    const reporterName =
      body.reporterName?.trim() || "Edycja grafu (aplikacja)";
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
      status: "new",
    };
    const saved = await appendSubmission(submission);

    const people: PersonPublic[] = result.db.people.map((p) => ({
      ...p,
      childrenIds: getChildrenIds(result.db.people, p.id),
    }));
    const family: FamilyPayload = {
      meta: result.db.meta,
      people,
      unlocked: true,
    };

    return NextResponse.json({
      ok: true,
      applied,
      applyWarning,
      summary: result.summary,
      submissionId: saved.id,
      family,
      createdPersonId: result.createdPerson?.id,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać zmiany.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
