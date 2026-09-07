import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { hasDb } from "@/lib/sql";
import {
  clearInviteCode,
  generateInviteToken,
  getInviteStatus,
  setInviteCode,
} from "@/lib/invite";
import { z } from "zod";

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const status = await getInviteStatus();
  return NextResponse.json({
    enabled: status.enabled,
    updatedAt: status.updatedAt,
    storage: hasDb() ? "neon" : "file",
  });
}

const putSchema = z.object({
  generate: z.boolean().optional(),
  code: z.string().trim().min(8).max(200).optional(),
});

export async function PUT(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Podaj klucz (min. 8 znaków) albo wygeneruj link." },
      { status: 400 },
    );
  }
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
    await setInviteCode(token);
    return NextResponse.json({
      ok: true,
      enabled: true,
      token,
      path: `/register?k=${encodeURIComponent(token)}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać klucza.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  await clearInviteCode();
  return NextResponse.json({ ok: true, enabled: false });
}
