import { NextResponse } from "next/server";
import { isSessionValid } from "@/lib/auth";
import { appendRsvp, readEvent, readRsvps } from "@/lib/event";
import {
  amountDuePln,
  totalGuests,
} from "@/lib/eventPricing";
import { storageMode } from "@/lib/sql";
import { rsvpPayloadSchema } from "@/lib/validation";
import type { EventRsvp } from "@/types/event";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const [event, rsvps] = await Promise.all([readEvent(), readRsvps()]);
  const appGuests = rsvps.reduce((sum, r) => sum + (r.guests || 1), 0);
  const guestTotal = event.registeredCount + appGuests;
  const spotsLeft = Math.max(0, event.capacity - guestTotal);
  const amountTotal = rsvps.reduce((sum, r) => sum + (r.amountPln || 0), 0);
  const mode = storageMode();

  return NextResponse.json({
    storage: mode,
    event,
    stats: {
      rsvpCount: event.registeredCount + rsvps.length,
      guestTotal,
      capacity: event.capacity,
      spotsLeft,
      amountTotal,
    },
    rsvps: rsvps.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      fullName: r.fullName,
      guests: r.guests,
      adults: r.adults,
      children3to12: r.children3to12,
      childrenUnder3: r.childrenUnder3,
      amountPln: r.amountPln,
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
    const [event, existing] = await Promise.all([readEvent(), readRsvps()]);
    const breakdown = {
      adults: body.adults,
      children3to12: body.children3to12,
      childrenUnder3: body.childrenUnder3,
    };
    const guests = totalGuests(breakdown);
    const appGuests = existing.reduce((sum, r) => sum + (r.guests || 1), 0);
    const taken = event.registeredCount + appGuests;
    if (taken + guests > event.capacity) {
      const left = Math.max(0, event.capacity - taken);
      return NextResponse.json(
        {
          error:
            left === 0
              ? `Brak wolnych miejsc (limit ${event.capacity} osób).`
              : `Zostało tylko ${left} miejsc (limit ${event.capacity}).`,
        },
        { status: 409 },
      );
    }
    const amountPln = amountDuePln(breakdown, event.pricePerPersonPln);

    const draft: EventRsvp = {
      id: `rsvp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      fullName: body.fullName,
      personId: body.personId,
      phone: body.phone || undefined,
      guests,
      adults: body.adults,
      children3to12: body.children3to12,
      childrenUnder3: body.childrenUnder3,
      amountPln,
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
      amountPln: saved.amountPln,
      guests: saved.guests,
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
