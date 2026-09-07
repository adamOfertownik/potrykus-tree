import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { hasDb } from "@/lib/sql";
import {
  clearInviteCode,
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
  code: z.string().trim().min(8).max(200),
});

export async function PUT(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Klucz musi mieć co najmniej 8 znaków." },
      { status: 400 },
    );
  }
  try {
    await setInviteCode(parsed.data.code);
    return NextResponse.json({ ok: true, enabled: true });
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
