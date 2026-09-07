import { NextResponse } from "next/server";
import { isAdminSessionValid } from "@/lib/auth";
import { readFamilyDb, writeFamilyDb } from "@/lib/db";
import {
  parseFamilyMarkdown,
  snapshotToFamilyDb,
  summarizeSnapshot,
} from "@/lib/parseFamilyMarkdown";

const MAX_CHARS = 1_500_000;

async function readImportBody(request: Request): Promise<{
  markdown: string;
  apply: boolean;
  confirm: boolean;
  preserveExtras: boolean;
  rootPersonId?: string;
}> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    let markdown = String(form.get("markdown") || "");
    if (file && typeof file !== "string") {
      markdown = await file.text();
    }
    return {
      markdown,
      apply: form.get("apply") === "true" || form.get("apply") === "1",
      confirm: form.get("confirm") === "true" || form.get("confirm") === "1",
      preserveExtras: form.get("preserveExtras") !== "false",
      rootPersonId: String(form.get("rootPersonId") || "") || undefined,
    };
  }
  const body = (await request.json()) as {
    markdown?: string;
    apply?: boolean;
    confirm?: boolean;
    preserveExtras?: boolean;
    rootPersonId?: string;
  };
  return {
    markdown: body.markdown ?? "",
    apply: Boolean(body.apply),
    confirm: Boolean(body.confirm),
    preserveExtras: body.preserveExtras !== false,
    rootPersonId: body.rootPersonId,
  };
}

export async function POST(request: Request) {
  if (!(await isAdminSessionValid())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  try {
    const body = await readImportBody(request);
    const markdown = body.markdown ?? "";
    if (!markdown.trim()) {
      return NextResponse.json(
        { error: "Wklej lub wgraj plik Markdown." },
        { status: 400 },
      );
    }
    if (markdown.length > MAX_CHARS) {
      return NextResponse.json(
        { error: "Plik jest za duży (max ok. 1.5 MB)." },
        { status: 400 },
      );
    }

    const parsed = parseFamilyMarkdown(markdown);
    const errors = parsed.issues.filter((i) => i.level === "error");
    const existing = await readFamilyDb();
    const built = snapshotToFamilyDb({
      parsed,
      existing,
      preserveExtras: body.preserveExtras !== false,
      rootPersonId: body.rootPersonId,
    });
    const summary = summarizeSnapshot(parsed, built);

    if (body.apply) {
      if (!body.confirm) {
        return NextResponse.json(
          { error: "Potwierdź wgranie (confirm: true)." },
          { status: 400 },
        );
      }
      if (errors.length > 0) {
        return NextResponse.json(
          {
            error: "Snapshot ma błędy — popraw plik przed wgraniem.",
            summary,
            issues: parsed.issues,
          },
          { status: 400 },
        );
      }
      await writeFamilyDb(built.db);
      return NextResponse.json({
        ok: true,
        applied: true,
        summary,
        issues: parsed.issues,
      });
    }

    return NextResponse.json({
      ok: true,
      applied: false,
      summary,
      issues: parsed.issues,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się odczytać snapshota." },
      { status: 500 },
    );
  }
}
