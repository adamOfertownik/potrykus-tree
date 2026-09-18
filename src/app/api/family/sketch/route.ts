import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { graphMutateRequestSchema } from "@/lib/validation";
import {
  discardSketchesForReporter,
  upsertSketch,
} from "@/lib/submissions";
import type { ChangeSubmission, GraphEditPayload } from "@/types/submissions";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const limited = rateLimit(`sketch:${clientIp(request)}`, 40, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const json = await request.json();
    const reporterName = sanitizePlainText(
      (json as { reporterName?: string })?.reporterName?.trim() || "Gość",
      120,
    );
    const reporterPersonId = (json as { reporterPersonId?: string })
      ?.reporterPersonId;
    const discarded = Boolean((json as { discarded?: boolean })?.discarded);

    if (discarded) {
      await discardSketchesForReporter({ reporterName, reporterPersonId });
      return NextResponse.json({ ok: true, discarded: true });
    }

    const parsed = graphMutateRequestSchema.safeParse(json);
    if (!parsed.success || !parsed.data.edits?.length) {
      return NextResponse.json({ ok: true, empty: true });
    }

    const graphEdits: GraphEditPayload[] = parsed.data.edits.map((edit) => ({
      op: edit.op!,
      anchorPersonId: edit.anchorPersonId!,
      relatedPersonId: edit.relatedPersonId,
      secondParentId: edit.secondParentId,
      replaceParentIds: edit.replaceParentIds,
      newPerson: edit.newPerson,
      summary: undefined,
    }));

    const messageRaw =
      typeof (json as { message?: string }).message === "string"
        ? (json as { message: string }).message
        : "";
    const message =
      sanitizePlainText(messageRaw, 4000) ||
      "Szkic zmian w drzewie (jeszcze nie wysłany).";

    const submission: ChangeSubmission = {
      id: `sketch-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: "graph_edit",
      reporterName,
      reporterPersonId,
      targetPersonId: graphEdits[0]?.anchorPersonId,
      message,
      graphEdit: graphEdits[0],
      graphEdits: graphEdits.length > 1 ? graphEdits : undefined,
      status: "sketch",
    };

    const saved = await upsertSketch(submission);
    return NextResponse.json({ ok: true, id: saved.id });
  } catch {
    return NextResponse.json({ ok: true, skipped: true });
  }
}
