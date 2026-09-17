import { NextResponse } from "next/server";
import { getAdminSession, isSessionValid } from "@/lib/auth";
import { appendRsvp, readEvent, readRsvps } from "@/lib/event";
import { isActiveRsvp } from "@/lib/eventAttending";
import { amountDuePln, totalGuests } from "@/lib/eventPricing";
import { storageMode } from "@/lib/sql";
import { rsvpPayloadSchema } from "@/lib/validation";
import type { EventRsvp } from "@/types/event";

export const dynamic = "force-dynamic";

export async function GET() {
  const unlocked = await isSessionValid();
  if (!unlocked) {
    return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
  }

  const [event, rsvps, admin] = await Promise.all([
    readEvent(),
    readRsvps(),
    getAdminSession(),
  ]);
  const active = rsvps.filter(isActiveRsvp);
  const guestTotal = active.reduce((sum, r) => sum + (r.guests || 1), 0);
  const spotsLeft = Math.max(0, event.capacity - guestTotal);
  const amountTotal = active.reduce((sum, r) => sum + (r.amountPln || 0), 0);
  const paidTotal = active
    .filter((r) => r.paid)
    .reduce((sum, r) => sum + (r.amountPln || 0), 0);
  const mode = storageMode();
  const isAdmin = Boolean(admin);

  return NextResponse.json({
    storage: mode,
    event,
    stats: {
      rsvpCount: active.length,
      guestTotal,
      capacity: event.capacity,
      spotsLeft,
      amountTotal,
      ...(isAdmin
        ? {
            paidCount: active.filter((r) => r.paid).length,
            paidTotal,
          }
        : {}),
    },
    rsvps: active.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      fullName: r.fullName,
      personId: r.personId,
      guests: r.guests,
      adults: r.adults,
      children3to12: r.children3to12,
      childrenUnder3: r.childrenUnder3,
      amountPln: r.amountPln,
      earlyArrival: r.earlyArrival,
      coveredPersonIds: r.coveredPersonIds ?? [],
      source: r.source ?? "form",
      ...(isAdmin
        ? { willTransfer: r.willTransfer, paid: Boolean(r.paid) }
        : {}),
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
    const early = {
      earlyArrival: body.earlyArrival,
      earlyArrivalOver7: body.earlyArrivalOver7,
      earlyArrivalUnder7: body.earlyArrivalUnder7,
    };
    const guests = totalGuests(breakdown);
    const taken = existing
      .filter(isActiveRsvp)
      .reduce((sum, r) => sum + (r.guests || 1), 0);
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
    const amountPln = amountDuePln(
      breakdown,
      event.pricePerPersonPln,
      early,
      event.priceUnder7Pln,
    );
    const coveredPersonIds = [
      ...new Set([
        ...(body.coveredPersonIds ?? []),
        ...(body.personId ? [body.personId] : []),
      ]),
    ];

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
      earlyArrival: body.earlyArrival,
      earlyArrivalOver7: body.earlyArrivalOver7,
      earlyArrivalUnder7: body.earlyArrivalUnder7,
      coveredPersonIds,
      source: "form",
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
      transferTitleHint:
        `IMPREZA RODZINNA, dorosłych- ${body.adults} dzieci do lat 7- ${body.children3to12}.`,
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
