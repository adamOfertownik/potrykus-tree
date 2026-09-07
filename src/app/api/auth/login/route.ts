import { NextResponse } from "next/server";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { hasDb } from "@/lib/sql";
import { touchUserLogin, verifyUserPassword } from "@/lib/users";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        {
          ok: false,
          error: "Logowanie wymaga bazy Neon (DATABASE_URL).",
        },
        { status: 503 },
      );
    }

    const ip = clientIp(request);
    const limited = rateLimit(`login:${ip}`, 5, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Za dużo prób. Spróbuj za ${limited.retryAfterSec} s.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }

    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim() ?? "";
    const password = body.password ?? "";
    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Podaj e-mail i hasło." },
        { status: 400 },
      );
    }

    const user = await verifyUserPassword(email, password);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy e-mail lub hasło." },
        { status: 401 },
      );
    }

    await touchUserLogin(user.id);
    const token = await createSessionToken(user);
    const response = NextResponse.json({
      ok: true,
      email: user.email,
      role: user.role,
    });
    await attachSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nie udało się zalogować." },
      { status: 500 },
    );
  }
}
