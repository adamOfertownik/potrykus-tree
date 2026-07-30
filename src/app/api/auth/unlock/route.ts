import { NextResponse } from "next/server";
import {
  attachSessionCookie,
  createSessionToken,
  verifyAccessCode,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
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
