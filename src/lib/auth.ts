import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { readConfig } from "@/lib/db";
import {
  deleteReservedAdmins,
  findAdminById,
  parseAdminRole,
  type AdminRole,
} from "@/lib/adminUsers";
import { isReservedAdminEmail } from "@/lib/validation";
import { hasDb } from "@/lib/sql";

const SESSION_TTL = "30d";
const ADMIN_COOKIE = "potrykus_admin_session";

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function verifyAccessCode(code: string): Promise<boolean> {
  const config = await readConfig();
  return compare(code.trim(), config.accessCodeHash);
}

export async function createSessionToken(): Promise<string> {
  const config = await readConfig();
  return new SignJWT({ role: "family" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey(config.sessionSecret));
}

export async function createAdminSessionToken(admin: {
  id: string;
  email: string;
  role?: AdminRole;
}): Promise<string> {
  const config = await readConfig();
  return new SignJWT({
    role: "admin",
    adminId: admin.id,
    email: admin.email,
    adminRole: admin.role ?? "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey(config.sessionSecret));
}

export async function isSessionValid(): Promise<boolean> {
  try {
    const config = await readConfig();
    const jar = await cookies();
    const token = jar.get(config.cookieName)?.value;
    if (!token) return false;
    await jwtVerify(token, secretKey(config.sessionSecret));
    return true;
  } catch {
    return false;
  }
}

export type AdminSession = {
  adminId: string;
  email: string;
  adminRole: AdminRole;
};

export function isFamilyEditor(session: AdminSession | null): boolean {
  return session?.adminRole === "admin";
}

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
    const jwtEmail = typeof payload.email === "string" ? payload.email : "";
    const jwtRole = parseAdminRole(
      typeof payload.adminRole === "string" ? payload.adminRole : "admin",
    );

    if (!hasDb()) {
      return {
        adminId: payload.adminId,
        email: jwtEmail,
        adminRole: jwtRole,
      };
    }

    const live = await findAdminById(payload.adminId);
    if (!live || isReservedAdminEmail(live.email)) {
      if (live) await deleteReservedAdmins();
      return null;
    }
    return {
      adminId: live.id,
      email: live.email,
      adminRole: live.role,
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
): Promise<void> {
  const config = await readConfig();
  response.cookies.set(config.cookieName, token, sessionCookieOptions(false));
}

export async function attachAdminSessionCookie(
  response: NextResponse,
  token: string,
): Promise<void> {
  response.cookies.set(ADMIN_COOKIE, token, sessionCookieOptions(false));
}

function sessionCookieOptions(expired: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(expired
      ? { maxAge: 0, expires: new Date(0) }
      : { maxAge: 60 * 60 * 24 * 30 }),
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
