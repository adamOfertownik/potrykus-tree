import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";
import { isReservedAdminEmail } from "@/lib/validation";

const HASH_COST = 12;

export type AdminRole = "admin" | "pay";

export type AdminUser = {
  id: string;
  email: string;
  role: AdminRole;
};

export type AdminUserPublic = {
  id: string;
  email: string;
  role: AdminRole;
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
  role?: string | null;
};

type PublicRow = {
  id: string;
  email: string;
  role?: string | null;
  created_at: string | Date;
  last_login_at: string | Date | null;
};

export function parseAdminRole(value: string | null | undefined): AdminRole {
  return value === "pay" ? "pay" : "admin";
}

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
    role: parseAdminRole(row.role),
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
    SELECT id, email, password_hash, role
    FROM admin_users
    WHERE lower(email) = lower(${email.trim()})
    LIMIT 1
  `) as Row[];
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    role: parseAdminRole(rows[0].role),
    passwordHash: rows[0].password_hash,
  };
}

export async function findAdminById(
  id: string,
): Promise<(AdminUser & { passwordHash: string }) | null> {
  if (!hasDb() || !id.trim()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, role
    FROM admin_users
    WHERE id = ${id}::uuid
    LIMIT 1
  `) as Row[];
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    email: rows[0].email,
    role: parseAdminRole(rows[0].role),
    passwordHash: rows[0].password_hash,
  };
}

export async function deleteReservedAdmins(): Promise<number> {
  if (!hasDb()) return 0;
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM admin_users
    WHERE lower(split_part(email, '@', 1)) LIKE 'crud.%'
       OR lower(split_part(email, '@', 2)) IN (
         'example.com', 'example.org', 'example.net', 'localhost'
       )
       OR lower(split_part(email, '@', 2)) LIKE '%.invalid'
       OR lower(split_part(email, '@', 2)) LIKE '%.test'
       OR lower(split_part(email, '@', 2)) LIKE '%.localhost'
    RETURNING id
  `) as { id: string }[];
  return rows.length;
}

export async function verifyAdminPassword(
  email: string,
  password: string,
): Promise<AdminUser | null> {
  if (isReservedAdminEmail(email)) return null;
  const admin = await findAdminByEmail(email);
  if (!admin) return null;
  if (isReservedAdminEmail(admin.email)) {
    await deleteReservedAdmins();
    return null;
  }
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

export async function listAdmins(): Promise<AdminUserPublic[]> {
  if (!hasDb()) return [];
  await deleteReservedAdmins();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, role, created_at, last_login_at
    FROM admin_users
    ORDER BY created_at ASC
  `) as PublicRow[];
  return rows.map(toPublic);
}

export async function createAdmin(
  email: string,
  password: string,
  role: AdminRole = "pay",
): Promise<AdminUserPublic> {
  if (!hasDb()) {
    throw new AdminUserError("Baza danych jest niedostępna.", 503);
  }
  const normalized = normalizeEmail(email);
  if (isReservedAdminEmail(normalized)) {
    throw new AdminUserError(
      "Ten adres jest zarezerwowany na testy — podaj prawdziwy e-mail osoby.",
      400,
    );
  }
  const existing = await findAdminByEmail(normalized);
  if (existing) {
    throw new AdminUserError("Ten e-mail już ma konto administratora.", 409);
  }
  const passwordHash = await hash(password, HASH_COST);
  const sql = getSql();
  try {
    const rows = (await sql`
      INSERT INTO admin_users (email, password_hash, role)
      VALUES (${normalized}, ${passwordHash}, ${role})
      RETURNING id, email, role, created_at, last_login_at
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
    RETURNING id, email, role, created_at, last_login_at
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
  const target = await findAdminById(id);
  const countRows = (await sql`
    SELECT count(*)::int AS n FROM admin_users
    WHERE coalesce(role, 'admin') = 'admin'
  `) as { n: number }[];
  if (target?.role === "admin" && (countRows[0]?.n ?? 0) <= 1) {
    throw new AdminUserError(
      "Nie można usunąć ostatniego pełnego administratora.",
      400,
    );
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
