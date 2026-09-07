import { NextResponse } from "next/server";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { hasDb } from "@/lib/sql";
import { createUser, findUserByEmail, touchUserLogin } from "@/lib/users";
import { getAccessLinksStatus, matchAccessCode } from "@/lib/invite";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  inviteCode: z.string().trim().min(1).max(200),
  displayName: z.string().trim().max(120).optional(),
});

export async function GET() {
  const status = await getAccessLinksStatus();
  const enabled = hasDb() && (status.member.enabled || status.admin.enabled);
  return NextResponse.json({
    enabled,
    memberEnabled: status.member.enabled,
    adminEnabled: status.admin.enabled,
    viewEnabled: status.view.enabled,
  });
}

export async function POST(request: Request) {
  try {
    if (!hasDb()) {
      return NextResponse.json(
        { ok: false, error: "Rejestracja wymaga bazy Neon." },
        { status: 503 },
      );
    }

    const ip = clientIp(request);
    const limited = rateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
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

    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Podaj e-mail, hasło i klucz.";
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const kind = await matchAccessCode(parsed.data.inviteCode);
    if (kind === "view") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "To hasło otwiera drzewo bez konta. Wejdź przez stronę „Wejście do drzewa”, nie rejestrację.",
        },
        { status: 400 },
      );
    }
    if (kind !== "member" && kind !== "admin") {
      const status = await getAccessLinksStatus();
      const anyInvite = status.member.enabled || status.admin.enabled;
      return NextResponse.json(
        {
          ok: false,
          error: anyInvite
            ? "Nieprawidłowy klucz zaproszenia."
            : "Rejestracja jest wyłączona. Poproś administratora o link.",
        },
        { status: 401 },
      );
    }

    const existing = await findUserByEmail(parsed.data.email);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Konto z tym e-mailem już istnieje." },
        { status: 409 },
      );
    }

    let user;
    try {
      user = await createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        role: kind,
        displayName: parsed.data.displayName,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("już istnieje")) {
        return NextResponse.json(
          { ok: false, error: "Konto z tym e-mailem już istnieje." },
          { status: 409 },
        );
      }
      throw err;
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
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się założyć konta.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
