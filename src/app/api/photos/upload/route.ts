import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Upload zdjęć wymaga BLOB_READ_WRITE_TOKEN (Vercel Blob).",
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
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Dozwolone tylko obrazy." },
        { status: 400 },
      );
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Maksymalny rozmiar to 4 MB." },
        { status: 400 },
      );
    }

    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const blob = await put(`photos/${Date.now()}-${safeName}`, file, {
      access: "public",
      contentType: file.type,
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się wgrać zdjęcia." },
      { status: 500 },
    );
  }
}
