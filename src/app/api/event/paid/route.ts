import { NextResponse } from "next/server";
import { getAdminSession, isSessionValid } from "@/lib/auth";
import { setRsvpPaid } from "@/lib/event";
import { adminRsvpPaidSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json(
      { error: "Brak uprawnień administratora." },
      { status: 401 },
    );
  }
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const parsed = adminRsvpPaidSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }

  try {
    const saved = await setRsvpPaid(parsed.data.rsvpId, parsed.data.paid);
    if (!saved) {
      return NextResponse.json(
        { error: "Nie znaleziono zgłoszenia." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ok: true,
      rsvpId: saved.id,
      paid: Boolean(saved.paid),
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać płatności." },
      { status: 500 },
    );
  }
}
