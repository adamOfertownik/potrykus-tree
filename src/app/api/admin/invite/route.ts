import { NextResponse } from "next/server";
import { applySchemaMigrations } from "@/lib/bootstrap";
import { requireAdminSession } from "@/lib/auth";
import { hasDb } from "@/lib/sql";
import {
  clearAccessLink,
  generateInviteToken,
  getAccessLinksStatus,
  pathForAccessLink,
  setAccessLink,
  type AccessLinkKind,
} from "@/lib/invite";
import { z } from "zod";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (hasDb()) {
    try {
      await applySchemaMigrations();
    } catch {
      /* columns may already exist */
    }
  }
  const links = await getAccessLinksStatus();
  return NextResponse.json({
    ...links,
    enabled: links.member.enabled,
    updatedAt: links.member.updatedAt,
    storage: hasDb() ? "neon" : "file",
  });
}

const kinds = ["member", "admin", "view"] as const;

const putSchema = z.object({
  type: z.enum(kinds),
  generate: z.boolean().optional(),
  code: z.string().trim().min(8).max(200).optional(),
});

export async function PUT(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (hasDb()) {
    try {
      await applySchemaMigrations();
    } catch {
      /* continue */
    }
  }
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Wybierz typ linku i podaj klucz (min. 8 znaków) albo wygeneruj." },
      { status: 400 },
    );
  }
  const kind: AccessLinkKind = parsed.data.type;
  const token = parsed.data.generate
    ? generateInviteToken()
    : parsed.data.code?.trim();
  if (!token || token.length < 8) {
    return NextResponse.json(
      { error: "Klucz musi mieć co najmniej 8 znaków." },
      { status: 400 },
    );
  }
  try {
    await setAccessLink(kind, token);
    return NextResponse.json({
      ok: true,
      type: kind,
      enabled: true,
      token,
      path: pathForAccessLink(kind, token),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać klucza.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const type = new URL(request.url).searchParams.get("type");
  const parsed = z.enum(kinds).safeParse(type);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Podaj type=member|admin|view." },
      { status: 400 },
    );
  }
  await clearAccessLink(parsed.data);
  return NextResponse.json({ ok: true, type: parsed.data, enabled: false });
}
