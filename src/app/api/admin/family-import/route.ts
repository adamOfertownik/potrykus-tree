import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { importFamilyMarkdown } from "@/lib/db";

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  try {
    const contentType = request.headers.get("content-type") || "";
    let markdown = "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (file instanceof File) markdown = await file.text();
    } else {
      const body = (await request.json()) as { markdown?: string };
      markdown = body.markdown ?? "";
    }
    if (markdown.trim().length < 20) {
      return NextResponse.json(
        { error: "Wklej albo wgraj plik Markdown z drzewem." },
        { status: 400 },
      );
    }
    const db = await importFamilyMarkdown(markdown);
    return NextResponse.json({
      ok: true,
      people: db.people.length,
      rootPersonId: db.meta.rootPersonId,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się wczytać Markdowna.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
