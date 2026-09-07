import { randomBytes } from "node:crypto";
import { compare, hash } from "bcryptjs";
import { getSql, hasDb } from "@/lib/sql";

export type AccessLinkKind = "member" | "admin" | "view";

export function generateInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

export function pathForAccessLink(kind: AccessLinkKind, token: string): string {
  const k = encodeURIComponent(token);
  if (kind === "admin") return `/register?k=${k}&rola=admin`;
  if (kind === "view") return `/wejscie?k=${k}`;
  return `/register?k=${k}`;
}

type SettingsRow = {
  invite_code_hash: string | null;
  invite_updated_at: string | null;
  member_invite_hash: string | null;
  admin_invite_hash: string | null;
  family_view_hash: string | null;
  member_invite_updated_at: string | null;
  admin_invite_updated_at: string | null;
  family_view_updated_at: string | null;
};

export type LinkStatus = {
  enabled: boolean;
  updatedAt: string | null;
};

export type AccessLinksStatus = {
  member: LinkStatus;
  admin: LinkStatus;
  view: LinkStatus;
};

const EMPTY: AccessLinksStatus = {
  member: { enabled: false, updatedAt: null },
  admin: { enabled: false, updatedAt: null },
  view: { enabled: false, updatedAt: null },
};

function memberHash(row: Partial<SettingsRow> | undefined): string | null {
  return row?.member_invite_hash || row?.invite_code_hash || null;
}

function memberUpdated(row: Partial<SettingsRow> | undefined): string | null {
  return row?.member_invite_updated_at || row?.invite_updated_at || null;
}

export async function getAccessLinksStatus(): Promise<AccessLinksStatus> {
  if (!hasDb()) return EMPTY;
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT
        invite_code_hash,
        invite_updated_at,
        member_invite_hash,
        admin_invite_hash,
        family_view_hash,
        member_invite_updated_at,
        admin_invite_updated_at,
        family_view_updated_at
      FROM app_settings
      WHERE id = 'default'
      LIMIT 1
    `) as SettingsRow[];
    const row = rows[0];
    const member = memberHash(row);
    return {
      member: { enabled: Boolean(member), updatedAt: memberUpdated(row) },
      admin: {
        enabled: Boolean(row?.admin_invite_hash),
        updatedAt: row?.admin_invite_updated_at ?? null,
      },
      view: {
        enabled: Boolean(row?.family_view_hash),
        updatedAt: row?.family_view_updated_at ?? null,
      },
    };
  } catch {
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
        ...EMPTY,
        member: {
          enabled: Boolean(row?.invite_code_hash),
          updatedAt: row?.invite_updated_at ?? null,
        },
      };
    } catch {
      return EMPTY;
    }
  }
}

/** @deprecated Use getAccessLinksStatus().member */
export async function getInviteStatus(): Promise<LinkStatus> {
  const status = await getAccessLinksStatus();
  return status.member;
}

async function loadHashes(): Promise<{
  member: string | null;
  admin: string | null;
  view: string | null;
}> {
  if (!hasDb()) return { member: null, admin: null, view: null };
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT
        invite_code_hash,
        member_invite_hash,
        admin_invite_hash,
        family_view_hash
      FROM app_settings
      WHERE id = 'default'
      LIMIT 1
    `) as SettingsRow[];
    const row = rows[0];
    return {
      member: memberHash(row),
      admin: row?.admin_invite_hash ?? null,
      view: row?.family_view_hash ?? null,
    };
  } catch {
    const rows = (await sql`
      SELECT invite_code_hash
      FROM app_settings
      WHERE id = 'default'
      LIMIT 1
    `) as SettingsRow[];
    return {
      member: rows[0]?.invite_code_hash ?? null,
      admin: null,
      view: null,
    };
  }
}

export async function matchAccessCode(
  code: string,
): Promise<AccessLinkKind | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const hashes = await loadHashes();
  if (hashes.admin && (await compare(trimmed, hashes.admin))) return "admin";
  if (hashes.member && (await compare(trimmed, hashes.member))) return "member";
  if (hashes.view && (await compare(trimmed, hashes.view))) return "view";
  return null;
}

export async function verifyInviteCode(code: string): Promise<boolean> {
  const kind = await matchAccessCode(code);
  return kind === "member" || kind === "admin";
}

export async function setAccessLink(
  kind: AccessLinkKind,
  code: string,
): Promise<void> {
  if (!hasDb()) {
    throw new Error("Klucz wymaga Neona.");
  }
  const trimmed = code.trim();
  if (trimmed.length < 8) {
    throw new Error("Klucz musi mieć co najmniej 8 znaków.");
  }
  const digest = await hash(trimmed, 12);
  const sql = getSql();
  await sql`INSERT INTO app_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING`;
  if (kind === "admin") {
    await sql`
      UPDATE app_settings
      SET admin_invite_hash = ${digest}, admin_invite_updated_at = now()
      WHERE id = 'default'
    `;
    return;
  }
  if (kind === "view") {
    await sql`
      UPDATE app_settings
      SET family_view_hash = ${digest}, family_view_updated_at = now()
      WHERE id = 'default'
    `;
    return;
  }
  await sql`
    UPDATE app_settings
    SET
      member_invite_hash = ${digest},
      member_invite_updated_at = now(),
      invite_code_hash = ${digest},
      invite_updated_at = now()
    WHERE id = 'default'
  `;
}

export async function setInviteCode(code: string): Promise<void> {
  await setAccessLink("member", code);
}

export async function clearAccessLink(kind: AccessLinkKind): Promise<void> {
  if (!hasDb()) return;
  const sql = getSql();
  if (kind === "admin") {
    await sql`
      UPDATE app_settings
      SET admin_invite_hash = NULL, admin_invite_updated_at = now()
      WHERE id = 'default'
    `;
    return;
  }
  if (kind === "view") {
    await sql`
      UPDATE app_settings
      SET family_view_hash = NULL, family_view_updated_at = now()
      WHERE id = 'default'
    `;
    return;
  }
  await sql`
    UPDATE app_settings
    SET
      member_invite_hash = NULL,
      member_invite_updated_at = now(),
      invite_code_hash = NULL,
      invite_updated_at = now()
    WHERE id = 'default'
  `;
}

export async function clearInviteCode(): Promise<void> {
  await clearAccessLink("member");
}
