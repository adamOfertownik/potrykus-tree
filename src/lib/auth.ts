import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { readConfig } from "@/lib/db";
import type { AppUser } from "@/lib/users";
import { isAuthRole, type AuthRole } from "@/types/auth";

const SESSION_TTL = "30d";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

async function signingKey() {
  const config = await readConfig();
  if (!config.sessionSecret || config.sessionSecret.length < 16) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }
  return { config, key: secretKey(config.sessionSecret) };
}

export const GUEST_USER_ID = "guest";

export type SessionUser = {
  userId: string;
  email: string;
  role: AuthRole;
};

export async function createSessionToken(user: AppUser): Promise<string> {
  const { key } = await signingKey();
  return new SignJWT({
    role: user.role,
    userId: user.id,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(key);
}

export async function createGuestSessionToken(): Promise<string> {
  const { key } = await signingKey();
  return new SignJWT({
    role: "guest",
    userId: GUEST_USER_ID,
    email: "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(GUEST_USER_ID)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(key);
}

export async function getSession(): Promise<SessionUser | null> {
  try {
    const { config, key } = await signingKey();
    const jar = await cookies();
    const token = jar.get(config.cookieName)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, key);
    if (!isAuthRole(payload.role) || typeof payload.userId !== "string") {
      return null;
    }
    return {
      userId: payload.userId,
      email: typeof payload.email === "string" ? payload.email : "",
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export async function isSessionValid(): Promise<boolean> {
  return (await getSession()) !== null;
}

export async function requireAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session || session.role !== "admin") return null;
  return session;
}

export async function isAdminSessionValid(): Promise<boolean> {
  return (await requireAdminSession()) !== null;
}

/** @deprecated Use getSession() + role === "admin" */
export async function getAdminSession(): Promise<{
  adminId: string;
  email: string;
} | null> {
  const session = await requireAdminSession();
  if (!session) return null;
  return { adminId: session.userId, email: session.email };
}

export async function attachSessionCookie(
  response: NextResponse,
  token: string,
): Promise<void> {
  const config = await readConfig();
  response.cookies.set(config.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionOnResponse(
  response: NextResponse,
): Promise<void> {
  const config = await readConfig();
  response.cookies.set(config.cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  // Drop the previous dual-cookie admin session if it is still around.
  response.cookies.set("potrykus_admin_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
