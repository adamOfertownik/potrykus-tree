import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { displayName, readFamilyDb } from "@/lib/db";
import {
  createAdminPayment,
  readEvent,
  readRsvps,
  setRsvpPaid,
  updateAdminPayment,
} from "@/lib/event";
import { isActiveRsvp } from "@/lib/eventAttending";
import { formatPln, ticketSummary } from "@/lib/eventPricing";
import { adminEventWriteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const [event, rsvps, db] = await Promise.all([
    readEvent(),
    readRsvps(),
    readFamilyDb(),
  ]);
  const byId = new Map(db.people.map((p) => [p.id, p]));
  const active = rsvps.filter(isActiveRsvp);
  const paid = active.filter((r) => r.paid);
  return NextResponse.json({
    event: {
      title: event.title,
      dateLabel: event.dateLabel,
      capacity: event.capacity,
      pricePerPersonPln: event.pricePerPersonPln,
      priceUnder7Pln: event.priceUnder7Pln ?? 120,
    },
    stats: {
      rsvpCount: active.length,
      guestTotal: active.reduce((sum, r) => sum + (r.guests || 1), 0),
      amountTotal: active.reduce((sum, r) => sum + (r.amountPln || 0), 0),
      paidCount: paid.length,
      paidTotal: paid.reduce((sum, r) => sum + (r.amountPln || 0), 0),
    },
    rsvps: active.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      personId: r.personId,
      guests: r.guests,
      adults: r.adults,
      children3to12: r.children3to12,
      childrenUnder3: r.childrenUnder3,
      ticketLabel: ticketSummary({
        adults: r.adults,
        children3to12: r.children3to12,
        childrenUnder3: r.childrenUnder3,
      }),
      amountPln: r.amountPln,
      amountLabel: formatPln(r.amountPln || 0),
      willTransfer: r.willTransfer,
      paid: Boolean(r.paid),
      coveredPersonIds: r.coveredPersonIds ?? [],
      coveredNames: (r.coveredPersonIds ?? [])
        .map((id) => {
          const p = byId.get(id);
          return p ? displayName(p, db.people) : null;
        })
        .filter((name): name is string => Boolean(name)),
      source: r.source ?? "form",
    })),
  });
}

export async function POST(request: Request) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Brak uprawnień admina." }, { status: 401 });
  }
  const parsed = adminEventWriteSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Nieprawidłowe dane." },
      { status: 400 },
    );
  }
  try {
    if (parsed.data.action === "paid") {
      const saved = await setRsvpPaid(parsed.data.rsvpId, parsed.data.paid);
      if (!saved) {
        return NextResponse.json(
          { error: "Nie znaleziono zgłoszenia." },
          { status: 404 },
        );
      }
    } else if (parsed.data.action === "create") {
      const body = parsed.data;
      const db = await readFamilyDb();
      const person = db.people.find((p) => p.id === body.personId);
      if (!person) {
        return NextResponse.json({ error: "Nie znaleziono osoby." }, { status: 404 });
      }
      await createAdminPayment({
        fullName: displayName(person, db.people),
        personId: person.id,
        coveredPersonIds: body.coveredPersonIds,
        willTransfer: body.willTransfer,
        paid: body.paid,
        people: db.people,
        adults: body.adults,
        children3to12: body.children3to12,
        childrenUnder3: body.childrenUnder3,
        amountPln: body.amountPln,
      });
    } else if (parsed.data.action === "update") {
      const saved = await updateAdminPayment(parsed.data);
      if (!saved) {
        return NextResponse.json(
          { error: "Nie znaleziono zgłoszenia." },
          { status: 404 },
        );
      }
    }
    return GET();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Nie udało się zapisać.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
