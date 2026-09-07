import { NextResponse } from "next/server";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { applySchemaMigrations, getSchemaHealth } from "@/lib/bootstrap";
import { hasDb } from "@/lib/sql";
import { createUser, touchUserLogin } from "@/lib/users";
import { ensureFamilySeeded } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const setupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().max(120).optional(),
});

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({
      hasDb: false,
      needsFirstAdmin: false,
      missingTables: false,
    });
  }
  try {
    const health = await getSchemaHealth();
    return NextResponse.json({
      hasDb: true,
      needsFirstAdmin: health.userCount === 0,
      missingTables: health.missingTables,
    });
  } catch {
    return NextResponse.json({
      hasDb: true,
      needsFirstAdmin: false,
      missingTables: false,
      error: "Baza nie odpowiada.",
    });
  }
}

export async function POST(request: Request) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        { ok: false, error: "Brak Neona na Vercel. Integracja Storage → Neon." },
        { status: 503 },
      );
    }

    const ip = clientIp(request);
    const limited = rateLimit(`setup:${ip}`, 5, 15 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Za dużo prób. Spróbuj za ${limited.retryAfterSec} s.`,
        },
        { status: 429 },
      );
    }

    const parsed = setupSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Podaj e-mail i hasło (min. 8 znaków)." },
        { status: 400 },
      );
    }

    await applySchemaMigrations();
    await ensureFamilySeeded();
    const health = await getSchemaHealth();
    if (health.userCount > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Konto administratora już istnieje. Zaloguj się e-mailem i hasłem.",
        },
        { status: 409 },
      );
    }

    const user = await createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      role: "admin",
      displayName: parsed.data.displayName,
    });
    await touchUserLogin(user.id);
    const token = await createSessionToken(user);
    const response = NextResponse.json({
      ok: true,
      email: user.email,
      role: user.role,
    });
    await attachSessionCookie(response, token);
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się utworzyć tabel / konta.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
