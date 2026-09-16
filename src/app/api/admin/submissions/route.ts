import { NextResponse } from "next/server";
import { getAdminSession, isAdminSessionValid } from "@/lib/auth";
import {
  getSubmissionById,
  readSubmissions,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { storageMode } from "@/lib/sql";
import { z } from "zod";
import type { ChangeSubmission } from "@/types/submissions";
import { readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import { applySubmission, previewSubmission } from "@/lib/applySubmission";
import { deleteBlobUrl, isPendingPhotoUrl } from "@/lib/blobPhotos";

export async function GET() {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
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
});

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const current = await getSubmissionById(parsed.data.id);
  if (!current) {
    return NextResponse.json({ error: "Nie znaleziono." }, { status: 404 });
  }

  if (parsed.data.status === current.status) {
    const db = await readFamilyDb();
    return NextResponse.json({
      ok: true,
      submission: { ...current, preview: previewSubmission(db, current) },
    });
  }

  let family = undefined;

  if (parsed.data.status === "accepted" && current.status !== "accepted") {
    try {
      const db = await readFamilyDb();
      const preview = previewSubmission(db, current);
      if (current.graphEdit && preview.warnings.length && !preview.autoApply) {
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
