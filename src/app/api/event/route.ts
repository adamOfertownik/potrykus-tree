import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendRsvp, readEvent, readRsvps } from "@/lib/event";
import type { EventRsvp, RsvpPayload } from "@/types/event";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const [event, rsvps] = await Promise.all([readEvent(), readRsvps()]);
  const guestTotal = rsvps.reduce((sum, r) => sum + (r.guests || 1), 0);

  return NextResponse.json({
    prototype: true,
    warning:
      "Prototyp: zapisy nie trafiają do trwałej bazy — damy znać po podłączeniu.",
    event,
    stats: {
      rsvpCount: rsvps.length,
      guestTotal,
    },
    // Don't expose full phone list publicly in list — only counts for family
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
    const body = (await request.json()) as RsvpPayload;
    if (!body.fullName?.trim()) {
      return NextResponse.json(
        { error: "Podaj imię i nazwisko." },
        { status: 400 },
      );
    }
    const guests = Number(body.guests);
    if (!Number.isFinite(guests) || guests < 1 || guests > 20) {
      return NextResponse.json(
        { error: "Podaj liczbę osób (1–20)." },
        { status: 400 },
      );
    }

    const rsvp: EventRsvp = {
      id: `rsvp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      fullName: body.fullName.trim(),
      personId: body.personId,
      phone: body.phone?.trim() || undefined,
      guests,
      notes: body.notes?.trim() || undefined,
      willTransfer: Boolean(body.willTransfer),
      status: "local_only",
    };

    await appendRsvp(rsvp);

    return NextResponse.json({
      ok: true,
      prototype: true,
      warning:
        "Zapisano lokalnie na prototypie. Zapisy NIE trafiają jeszcze do trwałej bazy.",
      id: rsvp.id,
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać zgłoszenia." },
      { status: 500 },
    );
  }
}
