import { NextResponse } from "next/server";
import { getAdminSession, isFamilyEditor } from "@/lib/auth";
import {
  getSubmissionById,
  readSubmissions,
  saveSubmission,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { z } from "zod";
import type { ChangeSubmission } from "@/types/submissions";
import { readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import {
  applySubmission,
  leftoverSubmission,
  previewSubmission,
  selectSubmissionParts,
  submissionGraphEdits,
} from "@/lib/applySubmission";
import { deleteBlobUrl, isPendingPhotoUrl } from "@/lib/blobPhotos";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (!isFamilyEditor(admin)) {
    return NextResponse.json(
      { error: "To konto może tylko oznaczać wpłaty." },
      { status: 403 },
    );
  }
  const db = await readFamilyDb();
  const submissions = await readSubmissions();
  return NextResponse.json({
    storage: storageMode(),
    submissions: submissions.map((s) => ({
      ...s,
      preview: previewSubmission(db, s),
    })),
  });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "reviewed", "accepted", "rejected", "local_only"]),
  graphEditIndexes: z.array(z.number().int().min(0).max(40)).max(40).optional(),
  correctionFields: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
});

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (!isFamilyEditor(admin)) {
    return NextResponse.json(
      { error: "To konto może tylko oznaczać wpłaty." },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const current = await getSubmissionById(parsed.data.id);
  if (!current) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }

  const graphEditIndexes = parsed.data.graphEditIndexes;
  const correctionFields = parsed.data.correctionFields;
  const isPartial = Boolean(
    graphEditIndexes?.length || correctionFields?.length,
  );
  const allEdits = submissionGraphEdits(current);
  if (graphEditIndexes?.some((i) => i >= allEdits.length)) {
    return NextResponse.json(
      { error: "Nieprawidłowy numer zmiany." },
      { status: 400 },
    );
  }

  if (parsed.data.status === current.status && !isPartial) {
    const db = await readFamilyDb();
    return NextResponse.json({
      ok: true,
      submission: { ...current, preview: previewSubmission(db, current) },
    });
  }

  let family = undefined;
  const reviewedAt = new Date().toISOString();
  let partialFinished = false;

  if (
    isPartial &&
    (parsed.data.status === "accepted" || parsed.data.status === "rejected") &&
    (current.status === "new" || current.status === "reviewed")
  ) {
    try {
      let idMap: Record<string, string> = {};
      if (parsed.data.status === "accepted") {
        const slice = selectSubmissionParts(current, {
          graphEditIndexes,
          correctionFields,
        });
        const db = await readFamilyDb();
        const preview = previewSubmission(db, slice);
        if (preview.warnings.length && !preview.autoApply) {
          return NextResponse.json(
            { error: preview.warnings[0] || "Nie można zastosować zaznaczonych zmian." },
            { status: 409 },
          );
        }
        const applied = applySubmission(db, slice);
        await writeFamilyDb(applied.db, admin.adminId);
        family = toFamilyPayload(applied.db);
        idMap = applied.idMap;
      }

      const leftover = leftoverSubmission(current, {
        dropGraphIndexes: graphEditIndexes ?? [],
        dropFields: correctionFields ?? [],
        idMap,
      });

      if (leftover) {
        const saved = await saveSubmission({
          ...leftover,
          status: current.status === "reviewed" ? "reviewed" : "new",
          reviewedAt,
          reviewedByAdminId: admin.adminId,
        });
        if (!saved) {
          return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
        }
        const db = await readFamilyDb();
        return NextResponse.json({
          ok: true,
          partial: true,
          submission: { ...saved, preview: previewSubmission(db, saved) },
          family,
        });
      }

      partialFinished = true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nie udało się zastosować zmiany.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  if (
    !partialFinished &&
    parsed.data.status === "accepted" &&
    current.status !== "accepted"
  ) {
    try {
      const db = await readFamilyDb();
      const preview = previewSubmission(db, current);
      if (
        (current.graphEdits?.length || current.graphEdit) &&
        preview.warnings.length &&
        !preview.autoApply
      ) {
        return NextResponse.json(
          { error: preview.warnings[0] || "Nie można zastosować zgłoszenia." },
          { status: 409 },
        );
      }
      const applied = applySubmission(db, current);
      await writeFamilyDb(applied.db, admin.adminId);
      family = toFamilyPayload(applied.db);
      if (
        current.photoAction === "remove" &&
        current.photoUrl &&
        !isPendingPhotoUrl(current.photoUrl)
      ) {
        await deleteBlobUrl(current.photoUrl);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Nie udało się zastosować zmiany.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }

  if (parsed.data.status === "rejected" && current.status !== "rejected") {
    if (isPendingPhotoUrl(current.photoUrl) && current.photoAction !== "remove") {
      await deleteBlobUrl(current.photoUrl);
    }
  }

  const updated = await updateSubmissionStatus(
    parsed.data.id,
    parsed.data.status as ChangeSubmission["status"],
    admin.adminId,
  );
  if (!updated) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }

  const db = await readFamilyDb();
  return NextResponse.json({
    ok: true,
    submission: { ...updated, preview: previewSubmission(db, updated) },
    family,
  });
}
