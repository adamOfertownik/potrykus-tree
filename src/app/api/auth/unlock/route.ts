import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  createSessionToken,
  verifyAccessCode,
} from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const ip = clientIp(request);
    const limited = rateLimit(`unlock:${ip}`, 5, 10 * 60 * 1000);
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

    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim() ?? "";
    if (!code) {
      return NextResponse.json(
        { ok: false, error: "Podaj kod rodzinny." },
        { status: 400 },
      );
    }

    const valid = await verifyAccessCode(code);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "Nieprawidłowy kod rodzinny." },
        { status: 401 },
      );
    }

    const token = await createSessionToken();
    const response = NextResponse.json({ ok: true });
    await attachSessionCookie(response, token);
    return response;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Nie udało się odblokować dostępu." },
      { status: 500 },
    );
  }
}
