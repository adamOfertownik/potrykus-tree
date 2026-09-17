import { NextResponse } from "next/server";
import { getAdminSession, isFamilyEditor } from "@/lib/auth";
import { readFamilyDb, toFamilyPayload, writeFamilyDb } from "@/lib/db";
import {
  addStandalonePerson,
  applyGraphMutation,
  deletePersonFromTree,
  patchPerson,
} from "@/lib/familyMutations";
import { deleteBlobUrl } from "@/lib/blobPhotos";
import { adminPersonWriteSchema } from "@/lib/validation";
import {
  sanitizeMultiline,
  sanitizePlainText,
} from "@/lib/sanitize";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const db = await readFamilyDb();
  return NextResponse.json(toFamilyPayload(db));
}

export async function POST(request: Request) {
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

  const parsed = adminPersonWriteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  const body = parsed.data;
  try {
    const db = await readFamilyDb();

    if (body.action === "update") {
      if (!body.personId || !body.fields) {
        return NextResponse.json(
          { error: "Podaj osobę i pola do zmiany." },
          { status: 400 },
        );
      }
      const fields = { ...body.fields };
      if (fields.firstName) fields.firstName = sanitizePlainText(fields.firstName, 80);
      if (fields.lastName) fields.lastName = sanitizePlainText(fields.lastName, 80);
      if (fields.maidenName) {
        fields.maidenName = sanitizePlainText(fields.maidenName, 80);
      }
      if (fields.notes) fields.notes = sanitizeMultiline(fields.notes, 2000);
      const next = patchPerson(db, body.personId, fields);
      await writeFamilyDb(next, admin.adminId);
      return NextResponse.json({
        ok: true,
        family: toFamilyPayload(next),
      });
    }

    if (body.action === "create") {
      if (!body.newPerson) {
        return NextResponse.json({ error: "Podaj dane nowej osoby." }, { status: 400 });
      }
      const created = addStandalonePerson(db, {
        ...body.newPerson,
        firstName: sanitizePlainText(body.newPerson.firstName, 80),
        lastName: sanitizePlainText(body.newPerson.lastName, 80),
        notes: body.newPerson.notes
          ? sanitizeMultiline(body.newPerson.notes, 2000)
          : undefined,
      });
      await writeFamilyDb(created.db, admin.adminId);
      return NextResponse.json({
        ok: true,
        family: toFamilyPayload(created.db),
        createdPersonId: created.person.id,
      });
    }

    if (body.action === "delete") {
      if (!body.personId) {
        return NextResponse.json({ error: "Podaj osobę do usunięcia." }, { status: 400 });
      }
      const person = db.people.find((p) => p.id === body.personId);
      const photoUrl = person?.photoUrl;
      const result = deletePersonFromTree(db, body.personId);
      await writeFamilyDb(result.db, admin.adminId);
      await deleteBlobUrl(photoUrl);
      return NextResponse.json({
        ok: true,
        family: toFamilyPayload(result.db),
        affectedNames: result.affectedNames,
      });
    }

    if (body.action === "graph") {
      if (!body.graphEdit) {
        return NextResponse.json({ error: "Brak danych mutacji." }, { status: 400 });
      }
      const result = applyGraphMutation(db, body.graphEdit);
      await writeFamilyDb(result.db, admin.adminId);
      return NextResponse.json({
        ok: true,
        family: toFamilyPayload(result.db),
        summary: result.summary,
        createdPersonId: result.createdPerson?.id,
      });
    }

    return NextResponse.json({ error: "Nieznana operacja." }, { status: 400 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
