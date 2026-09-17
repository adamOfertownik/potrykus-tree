import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";
import type { AdminUserPublic, AdminUserRole } from "@/types/admin";

export type { AdminUserPublic, AdminUserRole };

export type AdminUser = {
  id: string;
  email: string;
  role: AdminUserRole;
};

type Row = {
  id: string;
  email: string;
  password_hash: string;
  role: string;
};

type PublicRow = {
  id: string;
  email: string;
  role: string;
  created_at: string | Date;
  last_login_at: string | Date | null;
};

const BCRYPT_COST = 12;

export class AdminUserError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminUserError";
  }
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.toISOString();
}

function asRole(value: string): AdminUserRole {
  return value === "editor" ? "editor" : "admin";
}

function toPublic(row: PublicRow): AdminUserPublic {
  return {
    id: row.id,
    email: row.email,
    role: asRole(row.role),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; constraint?: string; message?: string };
  return (
    e.code === "23505" ||
    e.constraint === "admin_users_email_unique" ||
    (e.message ?? "").includes("admin_users_email_unique")
  );
}

export async function hashAdminPassword(password: string): Promise<string> {
  return hash(password, BCRYPT_COST);
}

export async function findAdminByEmail(
  email: string,
): Promise<(AdminUser & { passwordHash: string }) | null> {
  if (!hasDb()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, role
    FROM admin_users
    WHERE lower(email) = lower(${email.trim()})
    LIMIT 1
  `) as Row[];
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    role: asRole(rows[0].role),
    passwordHash: rows[0].password_hash,
  };
}

export async function findAdminById(id: string): Promise<AdminUser | null> {
  if (!hasDb()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, role
    FROM admin_users
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as Array<{ id: string; email: string; role: string }>;
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    role: asRole(rows[0].role),
  };
}

export async function verifyAdminPassword(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  const admin = await findAdminByEmail(email);
  if (!admin) return null;
  const ok = await compare(password, admin.passwordHash);
  if (!ok) return null;
  return { id: admin.id, email: admin.email, role: admin.role };
}

export async function touchAdminLogin(id: string): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  await sql`
    UPDATE admin_users SET last_login_at = now() WHERE id = ${id}::uuid
  `;
}

export async function listAdminUsers(): Promise<AdminUserPublic[]> {
  if (!hasDb()) return [];
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, role, created_at, last_login_at
    FROM admin_users
    ORDER BY email ASC
  `) as PublicRow[];
  return rows.map(toPublic);
}

export async function countAdmins(): Promise<number> {
  if (!hasDb()) return 0;
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS n FROM admin_users WHERE role = 'admin'
  `) as Array<{ n: number }>;
  return Number(rows[0]?.n ?? 0);
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  role: AdminUserRole;
}): Promise<AdminUserPublic> {
  if (!hasDb()) {
    throw new AdminUserError("Zarządzanie kontami wymaga bazy (Neon).", 503);
  }
  const sql = getSql();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashAdminPassword(input.password);
  try {
    const rows = (await sql`
      INSERT INTO admin_users (email, password_hash, role)
      VALUES (${email}, ${passwordHash}, ${input.role})
      RETURNING id, email, role, created_at, last_login_at
    `) as PublicRow[];
    return toPublic(rows[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AdminUserError("Konto z tym e-mailem już istnieje.", 409);
    }
    throw error;
  }
}

export async function updateAdminUser(
  id: string,
  patch: {
    email?: string;
    role?: AdminUserRole;
    password?: string;
  },
): Promise<AdminUserPublic> {
  if (!hasDb()) {
    throw new AdminUserError("Zarządzanie kontami wymaga bazy (Neon).", 503);
  }
  const current = await findAdminById(id);
  if (!current) {
    throw new AdminUserError("Nie znaleziono użytkownika.", 404);
  }

  if (patch.role && patch.role !== current.role && current.role === "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      throw new AdminUserError(
        "Nie można zmienić roli ostatniego administratora.",
        409,
      );
    }
  }

  const sql = getSql();
  const email = patch.email?.trim().toLowerCase() ?? current.email;
  const role = patch.role ?? current.role;
  const passwordHash = patch.password
    ? await hashAdminPassword(patch.password)
    : null;

  try {
    const rows = passwordHash
      ? ((await sql`
          UPDATE admin_users
          SET email = ${email},
              role = ${role},
              password_hash = ${passwordHash}
          WHERE id = ${id}::uuid
          RETURNING id, email, role, created_at, last_login_at
        `) as PublicRow[])
      : ((await sql`
          UPDATE admin_users
          SET email = ${email},
              role = ${role}
          WHERE id = ${id}::uuid
          RETURNING id, email, role, created_at, last_login_at
        `) as PublicRow[]);
    if (!rows[0]) {
      throw new AdminUserError("Nie znaleziono użytkownika.", 404);
    }
    return toPublic(rows[0]);
  } catch (error) {
    if (error instanceof AdminUserError) throw error;
    if (isUniqueViolation(error)) {
      throw new AdminUserError("Konto z tym e-mailem już istnieje.", 409);
    }
    throw error;
  }
}

export async function deleteAdminUser(
  id: string,
  actorId: string,
): Promise<void> {
  if (!hasDb()) {
    throw new AdminUserError("Zarządzanie kontami wymaga bazy (Neon).", 503);
  }
  if (id === actorId) {
    throw new AdminUserError("Nie możesz usunąć własnego konta.", 409);
  }
  const current = await findAdminById(id);
  if (!current) {
    throw new AdminUserError("Nie znaleziono użytkownika.", 404);
  }
  if (current.role === "admin") {
    const admins = await countAdmins();
    if (admins <= 1) {
      throw new AdminUserError(
        "Nie można usunąć ostatniego administratora.",
        409,
      );
    }
  }
  const sql = getSql();
  await sql`DELETE FROM admin_users WHERE id = ${id}::uuid`;
}
