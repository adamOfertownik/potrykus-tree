import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";

type SettingsRow = {
  invite_code_hash: string | null;
  invite_updated_at: string | null;
};

export type InviteStatus = {
  enabled: boolean;
  updatedAt: string | null;
};

export async function getInviteStatus(): Promise<InviteStatus> {
  if (!hasDb()) return { enabled: false, updatedAt: null };
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT invite_code_hash, invite_updated_at
      FROM app_settings
      WHERE id = 'default'
      LIMIT 1
    `) as SettingsRow[];
    const row = rows[0];
    return {
      enabled: Boolean(row?.invite_code_hash),
      updatedAt: row?.invite_updated_at ?? null,
    };
  } catch {
    return { enabled: false, updatedAt: null };
  }
}

export async function verifyInviteCode(code: string): Promise<boolean> {
  if (!hasDb()) return false;
  const trimmed = code.trim();
  if (!trimmed) return false;
  const sql = getSql();
  const rows = (await sql`
    SELECT invite_code_hash
    FROM app_settings
    WHERE id = 'default'
    LIMIT 1
  `) as SettingsRow[];
  const stored = rows[0]?.invite_code_hash;
  if (!stored) return false;
  return compare(trimmed, stored);
}

export async function setInviteCode(code: string): Promise<void> {
  if (!hasDb()) {
    throw new Error("Klucz zaproszenia wymaga Neona.");
  }
  const trimmed = code.trim();
  if (trimmed.length < 8) {
    throw new Error("Klucz musi mieć co najmniej 8 znaków.");
  }
  const inviteHash = await hash(trimmed, 12);
  const sql = getSql();
  await sql`
    INSERT INTO app_settings (id, invite_code_hash, invite_updated_at)
    VALUES ('default', ${inviteHash}, now())
    ON CONFLICT (id) DO UPDATE
      SET invite_code_hash = EXCLUDED.invite_code_hash,
          invite_updated_at = now()
  `;
}

export async function clearInviteCode(): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  await sql`
    UPDATE app_settings
    SET invite_code_hash = NULL, invite_updated_at = now()
    WHERE id = 'default'
  `;
}
