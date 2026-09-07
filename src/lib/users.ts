import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";
import { isUserRole, type UserRole } from "@/types/auth";

export type { UserRole };
export { isUserRole };

export type AppUser = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string | null;
  personId: string | null;
};

export type AppUserListItem = AppUser & {
  createdAt: string;
  lastLoginAt: string | null;
};

type AuthRow = {
  id: string;
  email: string;
  password_hash: string;
  role: string;
  display_name: string | null;
  person_id: string | null;
};

type ListRow = {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  person_id: string | null;
  created_at: string;
  last_login_at: string | null;
};

function mapUser(row: {
  id: string;
  email: string;
  role: string;
  display_name: string | null;
  person_id: string | null;
}): AppUser {
  return {
    id: row.id,
    email: row.email,
    role: isUserRole(row.role) ? row.role : "member",
    displayName: row.display_name,
    personId: row.person_id,
  };
}

export async function findUserByEmail(
  email: string,
): Promise<(AppUser & { passwordHash: string }) | null> {
  if (!hasDb()) return null;
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, password_hash, role, display_name, person_id
    FROM app_users
    WHERE lower(email) = lower(${email.trim()})
    LIMIT 1
  `) as AuthRow[];
  if (!rows[0]) return null;
  return {
    ...mapUser(rows[0]),
    passwordHash: rows[0].password_hash,
  };
}

export async function verifyUserPassword(
  email: string,
  password: string,
): Promise<AppUser | null> {
  const user = await findUserByEmail(email);
  if (!user) return null;
  const ok = await compare(password, user.passwordHash);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    personId: user.personId,
  };
}

export async function touchUserLogin(id: string): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  await sql`
    UPDATE app_users SET last_login_at = now() WHERE id = ${id}::uuid
  `;
}

export async function listUsers(): Promise<AppUserListItem[]> {
  if (!hasDb()) return [];
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, role, display_name, person_id, created_at, last_login_at
    FROM app_users
    ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, email
  `) as ListRow[];
  return rows.map((row) => ({
    ...mapUser(row),
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

export async function countAdmins(): Promise<number> {
  if (!hasDb()) return 0;
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS n FROM app_users WHERE role = 'admin'
  `) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

export async function createUser(input: {
  email: string;
  password: string;
  role: UserRole;
  displayName?: string;
}): Promise<AppUser> {
  if (!hasDb()) {
    throw new Error("Tworzenie kont wymaga DATABASE_URL (Neon).");
  }
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;
  const passwordHash = await hash(input.password, 12);
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO app_users (email, password_hash, role, display_name)
    VALUES (${email}, ${passwordHash}, ${input.role}, ${displayName})
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, role, display_name, person_id
  `) as AuthRow[];
  if (!rows[0]) {
    throw new Error("Konto z tym e-mailem już istnieje.");
  }
  return mapUser(rows[0]);
}

export async function updateUserRole(
  id: string,
  role: UserRole,
): Promise<AppUser | null> {
  if (!hasDb()) return null;
  if (role !== "admin") {
    const admins = await countAdmins();
    const sql = getSql();
    const current = (await sql`
      SELECT role FROM app_users WHERE id = ${id}::uuid LIMIT 1
    `) as { role: string }[];
    if (current[0]?.role === "admin" && admins <= 1) {
      throw new Error("Nie można zdjąć roli admina z ostatniego administratora.");
    }
  }
  const sql = getSql();
  const rows = (await sql`
    UPDATE app_users
    SET role = ${role}
    WHERE id = ${id}::uuid
    RETURNING id, email, role, display_name, person_id
  `) as AuthRow[];
  return rows[0] ? mapUser(rows[0]) : null;
}
