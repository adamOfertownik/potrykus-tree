import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth";
import { hasDb, storageMode } from "@/lib/sql";
import {
  createUser,
  listUsers,
  updateUserRole,
  type UserRole,
} from "@/lib/users";
import { z } from "zod";

const createSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["member", "admin"]).default("member"),
  displayName: z.string().trim().max(120).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["member", "admin"]),
});

export async function GET() {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Konta wymagają DATABASE_URL (Neon)." },
      { status: 503 },
    );
  }
  const users = await listUsers();
  return NextResponse.json({ storage: storageMode(), users });
}

export async function POST(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || "Nieprawidłowe dane konta.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  try {
    const user = await createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      role: parsed.data.role as UserRole,
      displayName: parsed.data.displayName,
    });
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się utworzyć konta.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdminSession())) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }
  try {
    const user = await updateUserRole(parsed.data.id, parsed.data.role);
    if (!user) {
      return NextResponse.json({ error: "Nie znaleziono konta." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zmienić roli.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
