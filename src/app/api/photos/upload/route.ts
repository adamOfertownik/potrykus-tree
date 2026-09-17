import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getAdminSession, isFamilyEditor, isSessionValid } from "@/lib/auth";
import { displayName, readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import { appendSubmission } from "@/lib/submissions";
import { deleteBlobUrl } from "@/lib/blobPhotos";
import { snapshotPeople, patchPerson } from "@/lib/familyMutations";
import {
  isAllowedImageType,
  sanitizeFilename,
  sanitizePlainText,
} from "@/lib/sanitize";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getAdminSession();
  const admin = isFamilyEditor(session) ? session : null;
  const unlocked = await isSessionValid();
  if (!unlocked && !admin) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }
  if (!admin) {
    const limited = rateLimit(`photo:${clientIp(request)}`, 12, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { error: `Za dużo wysyłek. Spróbuj za ${limited.retryAfterSec} s.` },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error: "Upload zdjęć wymaga BLOB_READ_WRITE_TOKEN (Vercel Blob).",
      },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Dołącz plik (field: file)." },
        { status: 400 },
      );
    }
    if (!isAllowedImageType(file.type)) {
      return NextResponse.json(
        { error: "Dozwolone formaty: JPEG, PNG, WebP, GIF." },
        { status: 400 },
      );
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Maksymalny rozmiar to 4 MB." },
        { status: 400 },
      );
    }

    const personIdRaw = form.get("personId");
    const personId =
      typeof personIdRaw === "string" && personIdRaw.trim()
        ? personIdRaw.trim()
        : undefined;
    const reporterName = sanitizePlainText(
      typeof form.get("reporterName") === "string"
        ? String(form.get("reporterName"))
        : "Zdjęcie (aplikacja)",
      120,
    );
    const reporterPersonIdRaw = form.get("reporterPersonId");
    const reporterPersonId =
      typeof reporterPersonIdRaw === "string" && reporterPersonIdRaw.trim()
        ? reporterPersonIdRaw.trim()
        : undefined;
    const skipSubmission = form.get("skipSubmission") === "1";

    const safeName = sanitizeFilename(file.name);
    const folder = admin && personId ? `photos/${personId}` : "photos/pending";
    const blob = await put(`${folder}/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: true,
    });

    if (admin && personId) {
      const db = await readFamilyDb();
      const person = db.people.find((p) => p.id === personId);
      if (!person) {
        await deleteBlobUrl(blob.url);
        return NextResponse.json(
          { error: "Nie znaleziono osoby." },
          { status: 404 },
        );
      }
      const previousUrl = person.photoUrl;
      const next = patchPerson(db, personId, { photoUrl: blob.url });
      await writeFamilyDb(next, admin.adminId);
      if (previousUrl && previousUrl !== blob.url) {
        await deleteBlobUrl(previousUrl);
      }
      return NextResponse.json({
        ok: true,
        url: blob.url,
        applied: true,
        family: toFamilyPayload(next),
      });
    }

    let targetPersonName: string | undefined;
    if (personId) {
      const db = await readFamilyDb();
      const person = db.people.find((p) => p.id === personId);
      if (!person) {
        await deleteBlobUrl(blob.url);
        return NextResponse.json(
          { error: "Nie znaleziono osoby." },
          { status: 404 },
        );
      }
      targetPersonName = displayName(person);
      if (!skipSubmission) {
        await appendSubmission({
          id: `sub-${Date.now()}`,
          createdAt: new Date().toISOString(),
          kind: "photo",
          reporterName,
          reporterPersonId,
          targetPersonId: personId,
          targetPersonName,
          message: `Propozycja zdjęcia dla ${targetPersonName}.`,
          photoUrl: blob.url,
          photoAction: "set",
          before: snapshotPeople(db.people, [personId]),
          status: "new",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      url: blob.url,
      applied: false,
      pending: true,
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Nie udało się wgrać zdjęcia.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const sessionEarly = await getAdminSession();
  const adminEarly = isFamilyEditor(sessionEarly) ? sessionEarly : null;
  const unlocked = await isSessionValid();
  if (!unlocked && !adminEarly) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const url = new URL(request.url);
  const personId = url.searchParams.get("personId")?.trim();
  if (!personId) {
    return NextResponse.json({ error: "Brak osoby." }, { status: 400 });
  }

  const reporterName = sanitizePlainText(
    url.searchParams.get("reporterName")?.trim() || "Zdjęcie (aplikacja)",
    120,
  );
  const reporterPersonId =
    url.searchParams.get("reporterPersonId")?.trim() || undefined;

  try {
    const db = await readFamilyDb();
    const person = db.people.find((p) => p.id === personId);
    if (!person) {
      return NextResponse.json(
        { error: "Nie znaleziono osoby." },
        { status: 404 },
      );
    }

    const session = adminEarly ?? (await getAdminSession());
    const admin = isFamilyEditor(session) ? session : null;
    if (admin) {
      const previousUrl = person.photoUrl;
      const next = patchPerson(db, personId, { photoUrl: "" });
      await writeFamilyDb(next, admin.adminId);
      await deleteBlobUrl(previousUrl);
      return NextResponse.json({
        ok: true,
        applied: true,
        family: toFamilyPayload(next),
      });
    }

    await appendSubmission({
      id: `sub-${Date.now()}`,
      createdAt: new Date().toISOString(),
      kind: "photo",
      reporterName,
      reporterPersonId,
      targetPersonId: personId,
      targetPersonName: displayName(person),
      message: `Propozycja usunięcia zdjęcia: ${displayName(person)}.`,
      photoUrl: person.photoUrl,
      photoAction: "remove",
      before: snapshotPeople(db.people, [personId]),
      status: "new",
    });

    return NextResponse.json({ ok: true, applied: false, pending: true });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : "Nie udało się usunąć zdjęcia.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
