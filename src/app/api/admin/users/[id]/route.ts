import { NextResponse } from "next/server";
import { getAdminSession, type AdminSession } from "@/lib/auth";
import {
  AdminUserError,
  deleteAdminUser,
  updateAdminUser,
} from "@/lib/adminUsers";
import { adminUserPatchSchema } from "@/lib/validation";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function deny() {
  return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
}

function forbid() {
  return NextResponse.json(
    { error: "Tylko administrator może zarządzać użytkownikami." },
    { status: 403 },
  );
}

async function requireManager(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: NextResponse }
> {
  const session = await getAdminSession();
  if (!session) return { ok: false, response: deny() };
  if (session.role !== "admin") return { ok: false, response: forbid() };
  return { ok: true, session };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Nieprawidłowy identyfikator." },
      { status: 400 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
  }

  const parsed = adminUserPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    const user = await updateAdminUser(id, parsed.data);
    return NextResponse.json({ user, self: user.id === auth.session.adminId });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Nie udało się zapisać konta." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireManager();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { error: "Nieprawidłowy identyfikator." },
      { status: 400 },
    );
  }

  try {
    await deleteAdminUser(id, auth.session.adminId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminUserError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Nie udało się usunąć konta." },
      { status: 500 },
    );
  }
}
