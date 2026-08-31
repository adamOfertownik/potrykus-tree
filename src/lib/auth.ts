import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";
import { readConfig } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

const SESSION_TTL = "30d";

export type AppRole = "viewer" | "admin";

export type AuthContext = {
  unlocked: boolean;
  role: AppRole;
  method: "supabase" | "code" | null;
  email?: string;
  canEdit: boolean;
};

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminCode(): string {
  return process.env.ADMIN_CODE?.trim() || "PotrykusAdmin";
}

export function isAdminCode(code: string): boolean {
  const expected = getAdminCode();
  return Boolean(expected && code.trim() === expected);
}

function metadataRole(user: User): string {
  const app = user.app_metadata?.role;
  const usr = user.user_metadata?.role;
  return String(app ?? usr ?? "").toLowerCase();
}

export function supabaseUserIsAdmin(user: User): boolean {
  if (metadataRole(user) === "admin") return true;
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  return getAdminEmails().includes(email);
}

export async function verifyAccessCode(code: string): Promise<boolean> {
  const config = await readConfig();
  return compare(code.trim(), config.accessCodeHash);
}

export async function createSessionToken(
  role: AppRole = "viewer",
): Promise<string> {
  const config = await readConfig();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey(config.sessionSecret));
}

async function readLegacySession(): Promise<{
  valid: boolean;
  role: AppRole;
}> {
  try {
    const config = await readConfig();
    const jar = await cookies();
    const token = jar.get(config.cookieName)?.value;
    if (!token) return { valid: false, role: "viewer" };
    const { payload } = await jwtVerify(token, secretKey(config.sessionSecret));
    const role = payload.role === "admin" ? "admin" : "viewer";
    return { valid: true, role };
  } catch {
    return { valid: false, role: "viewer" };
  }
}

export async function getSupabaseUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

export async function getAuthContext(): Promise<AuthContext> {
  const user = await getSupabaseUser();
  if (user) {
    const role: AppRole = supabaseUserIsAdmin(user) ? "admin" : "viewer";
    return {
      unlocked: true,
      role,
      method: "supabase",
      email: user.email ?? undefined,
      canEdit: role === "admin",
    };
  }

  const legacy = await readLegacySession();
  if (legacy.valid) {
    return {
      unlocked: true,
      role: legacy.role,
      method: "code",
      canEdit: legacy.role === "admin",
    };
  }

  return {
    unlocked: false,
    role: "viewer",
    method: null,
    canEdit: false,
  };
}

export async function isSupabaseSessionValid(): Promise<boolean> {
  return Boolean(await getSupabaseUser());
}

export async function isSessionValid(): Promise<boolean> {
  const ctx = await getAuthContext();
  return ctx.unlocked;
}

export async function isAdmin(): Promise<boolean> {
  const ctx = await getAuthContext();
  return ctx.canEdit;
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
    maxAge: 60 * 60 * 24 * 30,
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
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // ignore — legacy cookie may still be cleared separately
  }
}
