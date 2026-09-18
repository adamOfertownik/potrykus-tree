import { NextResponse } from "next/server";
import { getAdminSession, isSessionValid } from "@/lib/auth";
import { displayName, readFamilyDb } from "@/lib/db";
import {
  cancelRsvp,
  readEvent,
  readRsvps,
  setPersonAttendance,
} from "@/lib/event";
import { isActiveRsvp, resolveAttendingPersonIds } from "@/lib/eventAttending";
import { ageGroupFromBirth, totalGuests } from "@/lib/eventPricing";
import { adminAttendSchema } from "@/lib/validation";

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

  const parsed = adminAttendSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message || "Nieprawidłowe dane.",
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  try {
    if (body.rsvpId && !body.attending) {
      const cancelled = await cancelRsvp(body.rsvpId);
      if (!cancelled) {
        return NextResponse.json(
          { error: "Nie znaleziono zgłoszenia." },
          { status: 404 },
        );
      }
      const [event, rsvps, db] = await Promise.all([
        readEvent(),
        readRsvps(),
        readFamilyDb(),
      ]);
      return NextResponse.json({
        ok: true,
        attending: false,
        attendingPersonIds: resolveAttendingPersonIds(rsvps, db.people),
        guestTotal: rsvps
          .filter(isActiveRsvp)
          .reduce((sum, r) => sum + (r.guests || 1), 0),
        capacity: event.capacity,
      });
    }

    if (!body.personId) {
      return NextResponse.json({ error: "Podaj osobę." }, { status: 400 });
    }

    const [event, existing, db] = await Promise.all([
      readEvent(),
      readRsvps(),
      readFamilyDb(),
    ]);
    const person = db.people.find((p) => p.id === body.personId);
    const fullName =
      body.fullName || (person ? displayName(person, db.people) : undefined);
    if (!fullName) {
      return NextResponse.json(
        { error: "Nie znaleziono osoby w drzewie." },
        { status: 404 },
      );
    }

    if (body.attending) {
      const taken = existing
        .filter(isActiveRsvp)
        .reduce((sum, r) => sum + (r.guests || 1), 0);
      const already = existing.some(
        (r) => isActiveRsvp(r) && (r.personId === body.personId ||
          (r.coveredPersonIds ?? []).includes(body.personId!)),
      );
      if (!already && taken + 1 > event.capacity) {
        return NextResponse.json(
          { error: `Brak wolnych miejsc (limit ${event.capacity} osób).` },
          { status: 409 },
        );
      }
    }

    const result = await setPersonAttendance({
      personId: body.personId,
      attending: body.attending,
      fullName,
      ageGroup: ageGroupFromBirth(person?.birthDate),
      people: db.people,
    });

    const [rsvps] = await Promise.all([readRsvps()]);
    return NextResponse.json({
      ok: true,
      attending: body.attending,
      already: result.already ?? false,
      attendingPersonIds: resolveAttendingPersonIds(rsvps, db.people),
      guestTotal: rsvps
        .filter(isActiveRsvp)
        .reduce((sum, r) => sum + totalGuests(r), 0),
    });
  } catch {
    return NextResponse.json(
      { error: "Nie udało się zapisać obecności." },
      { status: 500 },
    );
  }
}
