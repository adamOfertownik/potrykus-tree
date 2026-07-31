import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendRsvp, readEvent, readRsvps } from "@/lib/event";
import { storageMode } from "@/lib/sql";
import { rsvpPayloadSchema } from "@/lib/validation";
import type { EventRsvp } from "@/types/event";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const [event, rsvps] = await Promise.all([readEvent(), readRsvps()]);
  const guestTotal = rsvps.reduce((sum, r) => sum + (r.guests || 1), 0);
  const mode = storageMode();

  return NextResponse.json({
    storage: mode,
    event,
    stats: {
      rsvpCount: rsvps.length,
      guestTotal,
    },
    rsvps: rsvps.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      fullName: r.fullName,
      guests: r.guests,
      willTransfer: r.willTransfer,
    })),
  });
}

export async function POST(request: Request) {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  try {
    const json = await request.json();
    const parsed = rsvpPayloadSchema.safeParse(json);
    if (!parsed.success) {
      const msg =
        parsed.error.issues[0]?.message || "Nieprawidłowe dane zapisu.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;

    const draft: EventRsvp = {
      id: `rsvp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      fullName: body.fullName,
      personId: body.personId,
      phone: body.phone || undefined,
      guests: body.guests,
      notes: body.notes || undefined,
      willTransfer: body.willTransfer,
      status: "new",
    };

    const saved = await appendRsvp(draft);
    const mode = storageMode();

    return NextResponse.json({
      ok: true,
      storage: mode,
      id: saved.id,
      warning:
        mode === "file"
          ? "Zapisano lokalnie (brak DATABASE_URL). Na produkcji ustaw Neon."
          : undefined,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }
}
