import { SignJWT, jwtVerify } from "jose";
import { compare } from "bcryptjs";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { readConfig } from "@/lib/db";

const SESSION_TTL = "30d";

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
