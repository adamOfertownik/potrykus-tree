import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  AdminUserError,
  createAdminUser,
  listAdminUsers,
} from "@/lib/adminUsers";
import { hasDb } from "@/lib/sql";
import { adminUserCreateSchema } from "@/lib/validation";

function deny() {
  return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
}

function forbid() {
  return NextResponse.json(
    { error: "Tylko administrator może zarządzać użytkownikami." },
    { status: 403 },
  );
}

export async function GET() {
  const session = await getAdminSession();
  if (!session) return deny();
  if (session.role !== "admin") return forbid();
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Zarządzanie kontami wymaga bazy (Neon)." },
      { status: 503 },
    );
  }
  const users = await listAdminUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return deny();
  if (session.role !== "admin") return forbid();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = adminUserCreateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    const user = await createAdminUser(parsed.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Nie udało się utworzyć konta." },
      { status: 500 },
    );
  }
}
