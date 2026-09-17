import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  AdminUserError,
  createAdmin,
  deleteAdmin,
  listAdmins,
  updateAdminPassword,
} from "@/lib/adminUsers";
import { hasDb } from "@/lib/sql";
import {
  adminUserCreateSchema,
  adminUserDeleteSchema,
  adminUserPasswordSchema,
} from "@/lib/validation";

function errorResponse(err: unknown) {
  if (err instanceof AdminUserError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json(
    { error: "Nie udało się zapisać zmian." },
    { status: 500 },
  );
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  if (!hasDb()) {
    return NextResponse.json(
      { error: "Baza danych jest niedostępna." },
      { status: 503 },
    );
  }
  const users = await listAdmins();
  return NextResponse.json({ users, currentAdminId: admin.adminId });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  const parsed = adminUserCreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    const user = await createAdmin(parsed.data.email, parsed.data.password);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  const parsed = adminUserPasswordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    const user = await updateAdminPassword(parsed.data.id, parsed.data.password);
    return NextResponse.json({ ok: true, user });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }

  const parsed = adminUserDeleteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    await deleteAdmin(parsed.data.id, admin.adminId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
