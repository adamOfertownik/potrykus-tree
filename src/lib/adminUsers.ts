import { compare } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";

export type AdminUser = {
  id: string;
  email: string;
};

type Row = {
  id: string;
  email: string;
  password_hash: string;
};

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
