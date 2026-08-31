import { NextResponse } from "next/server";
import {
  attachAdminSessionCookie,
  createAdminSessionToken,
} from "@/lib/auth";
import { touchAdminLogin, verifyAdminPassword } from "@/lib/adminUsers";
import { hasDb } from "@/lib/sql";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        { ok: false, error: "Logowanie admina wymaga DATABASE_URL (Neon)." },
        { status: 503 },
      );
    }

    const ip = clientIp(request);
    const limited = rateLimit(`admin-login:${ip}`, 5, 10 * 60 * 1000);
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

    const admin = await verifyAdminPassword(email, password);
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy e-mail lub hasło." },
        { status: 401 },
      );
    }

    await touchAdminLogin(admin.id);
    const token = await createAdminSessionToken(admin);
    const response = NextResponse.json({ ok: true, email: admin.email });
    await attachAdminSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nie udało się zalogować." },
      { status: 500 },
    );
  }
}
