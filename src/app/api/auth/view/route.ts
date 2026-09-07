import { NextResponse } from "next/server";
import { attachSessionCookie, createGuestSessionToken } from "@/lib/auth";
import { applySchemaMigrations } from "@/lib/bootstrap";
import { hasDb } from "@/lib/sql";
import { getAccessLinksStatus, matchAccessCode } from "@/lib/invite";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const viewSchema = z.object({
  code: z.string().trim().min(1).max(200),
});

export async function GET() {
  const status = await getAccessLinksStatus();
  return NextResponse.json({
    enabled: status.view.enabled && hasDb(),
  });
}

export async function POST(request: Request) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        { ok: false, error: "Podgląd drzewa wymaga bazy Neon." },
        { status: 503 },
      );
    }

    try {
      await applySchemaMigrations();
    } catch {
      /* hashes may already exist */
    }

    const ip = clientIp(request);
    const limited = rateLimit(`view:${ip}`, 12, 10 * 60 * 1000);
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

    const parsed = viewSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Podaj hasło albo klucz z linku." },
        { status: 400 },
      );
    }

    const kind = await matchAccessCode(parsed.data.code);
    if (kind === "member" || kind === "admin") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "To jest link do założenia konta. Otwórz rejestrację, nie hasło do drzewa.",
        },
        { status: 400 },
      );
    }
    if (kind !== "view") {
      const status = await getAccessLinksStatus();
      return NextResponse.json(
        {
          ok: false,
          error: status.view.enabled
            ? "Nieprawidłowe hasło do drzewa."
            : "Podgląd bez konta jest wyłączony. Poproś administratora o hasło.",
        },
        { status: 401 },
      );
    }

    const token = await createGuestSessionToken();
    const response = NextResponse.json({ ok: true, role: "guest" });
    await attachSessionCookie(response, token);
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się otworzyć drzewa.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
