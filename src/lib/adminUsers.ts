import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";

const HASH_COST = 12;

export type AdminUser = {
  id: string;
  email: string;
};

export type AdminUserPublic = {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export class AdminUserError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminUserError";
    this.status = status;
  }
}

type Row = {
  id: string;
  email: string;
  password_hash: string;
};

type PublicRow = {
  id: string;
  email: string;
  created_at: string | Date;
  last_login_at: string | Date | null;
};

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublic(row: PublicRow): AdminUserPublic {
  return {
    id: row.id,
    email: row.email,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    lastLoginAt: toIso(row.last_login_at),
  };
}

function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; constraint?: string; message?: string };
  return (
    e.code === "23505" ||
    e.constraint === "admin_users_email_unique" ||
    (typeof e.message === "string" &&
      e.message.includes("admin_users_email_unique"))
  );
}

export async function findAdminByEmail(
  email: string,
): Promise<(AdminUser & { passwordHash: string }) | null> {
  if (!hasDb()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash
    FROM admin_users
    WHERE lower(email) = lower(${email.trim()})
    LIMIT 1
  `) as Row[];
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    passwordHash: rows[0].password_hash,
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
  return { id: admin.id, email: admin.email };
}

export async function touchAdminLogin(id: string): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  await sql`
    UPDATE admin_users SET last_login_at = now() WHERE id = ${id}::uuid
  `;
}

export async function listAdmins(): Promise<AdminUserPublic[]> {
  if (!hasDb()) return [];
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, created_at, last_login_at
    FROM admin_users
    ORDER BY created_at ASC
  `) as PublicRow[];
  return rows.map(toPublic);
}

export async function createAdmin(
  email: string,
  password: string,
): Promise<AdminUserPublic> {
  if (!hasDb()) {
    throw new AdminUserError("Baza danych jest niedostępna.", 503);
  }
  const normalized = normalizeEmail(email);
  const existing = await findAdminByEmail(normalized);
  if (existing) {
    throw new AdminUserError("Ten e-mail już ma konto administratora.", 409);
  }
  const passwordHash = await hash(password, HASH_COST);
  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO admin_users (email, password_hash)
      VALUES (${normalized}, ${passwordHash})
      RETURNING id, email, created_at, last_login_at
    `) as PublicRow[];
    if (!rows[0]) {
      throw new AdminUserError("Nie udało się dodać administratora.", 500);
    }
    return toPublic(rows[0]);
  } catch (err) {
    if (err instanceof AdminUserError) throw err;
    if (isUniqueViolation(err)) {
      throw new AdminUserError("Ten e-mail już ma konto administratora.", 409);
    }
    throw err;
  }
}

export async function updateAdminPassword(
  id: string,
  password: string,
): Promise<AdminUserPublic> {
  if (!hasDb()) {
    throw new AdminUserError("Baza danych jest niedostępna.", 503);
  }
  const passwordHash = await hash(password, HASH_COST);
  const sql = getSql();
  const rows = (await sql`
    UPDATE admin_users
    SET password_hash = ${passwordHash}
    WHERE id = ${id}::uuid
    RETURNING id, email, created_at, last_login_at
  `) as PublicRow[];
  if (!rows[0]) {
    throw new AdminUserError("Nie znaleziono tego administratora.", 404);
  }
  return toPublic(rows[0]);
}

export async function deleteAdmin(
  id: string,
  actorId: string,
): Promise<void> {
  if (!hasDb()) {
    throw new AdminUserError("Baza danych jest niedostępna.", 503);
  }
  if (id === actorId) {
    throw new AdminUserError("Nie możesz usunąć własnego konta.", 400);
  }
  const sql = getSql();
  const countRows = (await sql`
    SELECT count(*)::int AS n FROM admin_users
  `) as { n: number }[];
  if ((countRows[0]?.n ?? 0) <= 1) {
    throw new AdminUserError("Nie można usunąć ostatniego administratora.", 400);
  }
  const rows = (await sql`
    DELETE FROM admin_users
    WHERE id = ${id}::uuid
    RETURNING id
  `) as { id: string }[];
  if (!rows[0]) {
    throw new AdminUserError("Nie znaleziono tego administratora.", 404);
  }
}
