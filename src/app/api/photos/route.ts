import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendPhoto, readPhotos } from "@/lib/photos";
import { storageMode } from "@/lib/sql";
import { eventPhotoPayloadSchema } from "@/lib/validation";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const photos = await readPhotos();
  return NextResponse.json({
    storage: storageMode(),
    photos,
  });
}

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = eventPhotoPayloadSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Nieprawidłowe dane zdjęcia.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const saved = await appendPhoto(parsed.data);
    const mode = storageMode();

    return NextResponse.json({
      ok: true,
      storage: mode,
      photo: saved,
      warning:
        mode === "file"
          ? "Zapisano lokalnie (brak DATABASE_URL). Na produkcji ustaw Neon."
          : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać zdjęcia." },
      { status: 500 },
    );
  }
}
