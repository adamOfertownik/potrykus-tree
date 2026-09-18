import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { findAdminById } from "@/lib/adminUsers";
import type { AdminUserRole } from "@/types/admin";
import { readConfig } from "@/lib/db";
import {
  ADMIN_MAX_AGE_SEC,
  FAMILY_REMEMBER_MAX_AGE_SEC,
  FAMILY_SHORT_MAX_AGE_SEC,
} from "@/lib/sessionPolicy";

const ADMIN_COOKIE = "potrykus_admin_session";

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function verifyAccessCode(code: string): Promise<boolean> {
  const config = await readConfig();
  return compare(code.trim(), config.accessCodeHash);
}

export async function createSessionToken(opts?: {
  remember?: boolean;
}): Promise<string> {
  const remember = opts?.remember === true;
  const config = await readConfig();
  return new SignJWT({ role: "family", remember })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(remember ? `${FAMILY_REMEMBER_MAX_AGE_SEC}s` : `${FAMILY_SHORT_MAX_AGE_SEC}s`)
    .sign(secretKey(config.sessionSecret));
}

export async function createAdminSessionToken(admin: {
  id: string;
  email: string;
}): Promise<string> {
  const config = await readConfig();
  return new SignJWT({ role: "admin", adminId: admin.id, email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_MAX_AGE_SEC}s`)
    .sign(secretKey(config.sessionSecret));
}

export type FamilySession = {
  remember: boolean;
};

export async function getFamilySession(): Promise<FamilySession | null> {
  try {
    const config = await readConfig();
    const jar = await cookies();
    const token = jar.get(config.cookieName)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secretKey(config.sessionSecret));
    if (payload.role !== "family") return null;
    // Older tokens without the claim behaved like long sessions.
    const remember = payload.remember !== false;
    return { remember };
  } catch {
    return null;
  }
}

export async function isSessionValid(): Promise<boolean> {
  return (await getFamilySession()) !== null;
}

export type AdminSession = {
  adminId: string;
  email: string;
  role: AdminUserRole;
};

export async function getAdminSession(): Promise<AdminSession | null> {
  try {
    const config = await readConfig();
    const jar = await cookies();
    const token = jar.get(ADMIN_COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secretKey(config.sessionSecret));
    if (payload.role !== "admin" || typeof payload.adminId !== "string") {
      return null;
    }
    const user = await findAdminById(payload.adminId);
    if (!user) return null;
    return {
      adminId: user.id,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}

export async function isAdminSessionValid(): Promise<boolean> {
  return (await getAdminSession()) !== null;
}

export async function attachSessionCookie(
  response: NextResponse,
  token: string,
  opts?: { remember?: boolean },
): Promise<void> {
  const config = await readConfig();
  const remember = opts?.remember === true;
  response.cookies.set(
    config.cookieName,
    token,
    sessionCookieOptions(false, {
      maxAgeSec: remember
        ? FAMILY_REMEMBER_MAX_AGE_SEC
        : FAMILY_SHORT_MAX_AGE_SEC,
    }),
  );
}

export async function attachAdminSessionCookie(
  response: NextResponse,
  token: string,
): Promise<void> {
  response.cookies.set(
    ADMIN_COOKIE,
    token,
    sessionCookieOptions(false, { maxAgeSec: ADMIN_MAX_AGE_SEC }),
  );
}

function sessionCookieOptions(
  expired: boolean,
  opts?: { maxAgeSec?: number },
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expired
      ? { maxAge: 0, expires: new Date(0) }
      : opts?.maxAgeSec != null
        ? { maxAge: opts.maxAgeSec }
        : {}),
  };
}

function expireCookie(response: NextResponse, name: string) {
  const base = sessionCookieOptions(true);
  response.cookies.set(name, "", base);
  response.cookies.set(name, "", { ...base, secure: !base.secure });
  response.cookies.delete(name);
}

export async function clearSessionOnResponse(
  response: NextResponse,
): Promise<void> {
  const config = await readConfig();
  expireCookie(response, config.cookieName);
}

export async function clearAdminSessionOnResponse(
  response: NextResponse,
): Promise<void> {
  expireCookie(response, ADMIN_COOKIE);
}
