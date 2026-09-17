import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventRsvp, FamilyEvent } from "@/types/event";
import type { Person } from "@/types/family";
import { rsvpCoversPerson } from "@/lib/eventAttending";
import {
  ageGroupFromBirth,
  amountDuePln,
  breakdownFromAgeGroups,
  DEFAULT_EVENT_CAPACITY,
  DEFAULT_PRICE_PER_PERSON_PLN,
  DEFAULT_PRICE_UNDER_7_PLN,
  totalGuests,
  type GuestAgeGroup,
  type GuestBreakdown,
} from "@/lib/eventPricing";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENT_PATH = path.join(DATA_DIR, "event.json");
const RSVP_PATH = path.join(DATA_DIR, "event-rsvps.json");

const EARLY_NOTE_PREFIX = "Wczesny przyjazd:";
const PEOPLE_NOTE_PREFIX = "Osoby:";
const ADMIN_NOTE_MARKER = "Źródło: admin";
const PAID_NOTE_MARKER = "Zapłacono";

export async function readEvent(): Promise<FamilyEvent> {
  const raw = await readFile(EVENT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as FamilyEvent;
  return {
    ...parsed,
    pricePerPersonPln:
      parsed.pricePerPersonPln ?? DEFAULT_PRICE_PER_PERSON_PLN,
    priceUnder7Pln: parsed.priceUnder7Pln ?? DEFAULT_PRICE_UNDER_7_PLN,
    registeredCount: parsed.registeredCount ?? 0,
    capacity: parsed.capacity ?? DEFAULT_EVENT_CAPACITY,
    amenities: parsed.amenities ?? [],
    schedule: parsed.schedule ?? [],
  };
}

async function readFileRsvps(): Promise<EventRsvp[]> {
  try {
    const raw = await readFile(RSVP_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { rsvps?: EventRsvp[] };
    return (parsed.rsvps ?? []).map(normalizeRsvp);
  } catch {
    return [];
  }
}

function formatEarlyArrivalNote(over7: number, under7: number): string {
  const parts: string[] = [];
  if (over7 > 0) parts.push(`${over7} os. 7+`);
  if (under7 > 0) parts.push(`${under7} os. do 7 lat`);
  return parts.length ? `${EARLY_NOTE_PREFIX} ${parts.join(", ")}.` : "";
}

function parseEarlyArrivalNote(notes?: string): {
  earlyArrival: boolean;
  earlyArrivalOver7: number;
  earlyArrivalUnder7: number;
  notes?: string;
} {
  if (!notes) {
    return { earlyArrival: false, earlyArrivalOver7: 0, earlyArrivalUnder7: 0 };
  }
  const lines = notes.split("\n");
  const marker = lines.find((line) => line.startsWith(EARLY_NOTE_PREFIX));
  if (!marker) {
    return {
      earlyArrival: false,
      earlyArrivalOver7: 0,
      earlyArrivalUnder7: 0,
      notes,
    };
  }
  const over7 = Number(/(\d+)\s*os\.\s*7\+/.exec(marker)?.[1] ?? 0);
  const under7 = Number(/(\d+)\s*os\.\s*do 7 lat/.exec(marker)?.[1] ?? 0);
  const rest = lines
    .filter((line) => !line.startsWith(EARLY_NOTE_PREFIX))
    .join("\n")
    .trim();
  return {
    earlyArrival: over7 > 0 || under7 > 0,
    earlyArrivalOver7: over7,
    earlyArrivalUnder7: under7,
    notes: rest || undefined,
  };
}

function parseCoveredIds(notes?: string): string[] {
  if (!notes) return [];
  const line = notes.split("\n").find((l) => l.startsWith(PEOPLE_NOTE_PREFIX));
  if (!line) return [];
  return line
    .slice(PEOPLE_NOTE_PREFIX.length)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function stripStructuredNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const rest = notes
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith(EARLY_NOTE_PREFIX) &&
        !line.startsWith(PEOPLE_NOTE_PREFIX) &&
        line.trim() !== ADMIN_NOTE_MARKER &&
        line.trim() !== PAID_NOTE_MARKER,
    )
    .join("\n")
    .trim();
  return rest || undefined;
}

function composeNotes(rsvp: EventRsvp, includeEarlyInNotes: boolean): string | null {
  const parts: string[] = [];
  if (
    includeEarlyInNotes &&
    rsvp.earlyArrival &&
    ((rsvp.earlyArrivalOver7 ?? 0) > 0 || (rsvp.earlyArrivalUnder7 ?? 0) > 0)
  ) {
    parts.push(
      formatEarlyArrivalNote(
        rsvp.earlyArrivalOver7 ?? 0,
        rsvp.earlyArrivalUnder7 ?? 0,
      ),
    );
  }
  const covered = [...new Set(rsvp.coveredPersonIds ?? [])].filter(Boolean);
  if (covered.length) parts.push(`${PEOPLE_NOTE_PREFIX} ${covered.join(",")}`);
  if (rsvp.source === "admin") parts.push(ADMIN_NOTE_MARKER);
  if (rsvp.paid) parts.push(PAID_NOTE_MARKER);
  const userNotes = stripStructuredNotes(rsvp.notes);
  if (userNotes) parts.push(userNotes);
  return parts.length ? parts.join("\n") : null;
}

function normalizeRsvp(r: EventRsvp): EventRsvp {
  const adults = r.adults ?? r.guests ?? 1;
  const children3to12 = r.children3to12 ?? 0;
  const childrenUnder3 = r.childrenUnder3 ?? 0;
  const guests = r.guests ?? adults + children3to12 + childrenUnder3;
  const parsed = parseEarlyArrivalNote(r.notes);
  const covered = r.coveredPersonIds?.length
    ? r.coveredPersonIds
    : parseCoveredIds(r.notes);
  const source =
    r.source ??
    (r.notes?.includes(ADMIN_NOTE_MARKER) ? "admin" : "form");
  const paid =
    r.paid === true ||
    Boolean(r.notes?.split("\n").some((line) => line.trim() === PAID_NOTE_MARKER));
  return {
    ...r,
    adults,
    children3to12,
    childrenUnder3,
    guests,
    amountPln: r.amountPln ?? 0,
    earlyArrival: r.earlyArrival ?? parsed.earlyArrival,
    earlyArrivalOver7: r.earlyArrivalOver7 ?? parsed.earlyArrivalOver7,
    earlyArrivalUnder7: r.earlyArrivalUnder7 ?? parsed.earlyArrivalUnder7,
    coveredPersonIds: covered,
    source,
    paid,
    notes: stripStructuredNotes(r.notes) ?? parsed.notes,
  };
}

async function writeFileRsvps(rsvps: EventRsvp[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(
    RSVP_PATH,
    JSON.stringify(
      {
        note: "Fallback lokalny — ustaw DATABASE_URL, żeby pisać do Neona",
        rsvps,
      },
      null,
      2,
    ),
    "utf-8",
  );
}

type Row = {
  id: string;
  created_at: string | Date;
  full_name: string;
  person_id: string | null;
  phone: string | null;
  guests: number;
  adults: number | null;
  children_3_12: number | null;
  children_under_3: number | null;
  amount_pln: number | null;
  notes: string | null;
  will_transfer: boolean;
  paid?: boolean | null;
  early_arrival?: boolean | null;
  early_arrival_over_7?: number | null;
  early_arrival_under_7?: number | null;
  status: string;
};

function rowToRsvp(row: Row): EventRsvp {
  const adults = row.adults ?? row.guests ?? 1;
  const children3to12 = row.children_3_12 ?? 0;
  const childrenUnder3 = row.children_under_3 ?? 0;
  const parsed = parseEarlyArrivalNote(row.notes || undefined);
  const earlyFromCol = row.early_arrival != null;
  const covered = parseCoveredIds(row.notes || undefined);
  const source = row.notes?.includes(ADMIN_NOTE_MARKER) ? "admin" : "form";
  const paid =
    row.paid === true ||
    Boolean(
      row.notes
        ?.split("\n")
        .some((line) => line.trim() === PAID_NOTE_MARKER),
    );
  return {
    id: row.id,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : row.created_at.toISOString(),
    fullName: row.full_name,
    personId: row.person_id || undefined,
    phone: row.phone || undefined,
    guests: row.guests,
    adults,
    children3to12,
    childrenUnder3,
    amountPln: row.amount_pln ?? 0,
    notes: stripStructuredNotes(row.notes || undefined),
    willTransfer: row.will_transfer,
    earlyArrival: earlyFromCol ? Boolean(row.early_arrival) : parsed.earlyArrival,
    earlyArrivalOver7: earlyFromCol
      ? row.early_arrival_over_7 ?? 0
      : parsed.earlyArrivalOver7,
    earlyArrivalUnder7: earlyFromCol
      ? row.early_arrival_under_7 ?? 0
      : parsed.earlyArrivalUnder7,
    coveredPersonIds: covered,
    source,
    paid,
    status: row.status as EventRsvp["status"],
  };
}

type RsvpReadSchema = "full" | "breakdown" | "min";
let rsvpReadSchema: RsvpReadSchema | undefined;

async function selectRsvps(
  sql: ReturnType<typeof getSql>,
  schema: RsvpReadSchema,
): Promise<Row[]> {
  if (schema === "full") {
    return (await sql`
      SELECT id, created_at, full_name, person_id, phone, guests,
             adults, children_3_12, children_under_3, amount_pln,
             notes, will_transfer, early_arrival, early_arrival_over_7,
             early_arrival_under_7, status
      FROM event_rsvps
      ORDER BY created_at DESC
    `) as Row[];
  }
  if (schema === "breakdown") {
    return (await sql`
      SELECT id, created_at, full_name, person_id, phone, guests,
             adults, children_3_12, children_under_3, amount_pln,
             notes, will_transfer, status
      FROM event_rsvps
      ORDER BY created_at DESC
    `) as Row[];
  }
  return (await sql`
    SELECT id, created_at, full_name, person_id, phone, guests, notes,
           will_transfer, status
    FROM event_rsvps
    ORDER BY created_at DESC
  `) as Row[];
}

export async function readRsvps(): Promise<EventRsvp[]> {
  if (!hasDb()) return readFileRsvps();
  const sql = getSql();
  const order: RsvpReadSchema[] = rsvpReadSchema
    ? [rsvpReadSchema]
    : ["breakdown", "min"];
  let lastError: unknown;
  for (const schema of order) {
    try {
      const rows = await selectRsvps(sql, schema);
      rsvpReadSchema = schema;
      return rows.map(rowToRsvp);
    } catch (err) {
      lastError = err;
      if (rsvpReadSchema === schema) rsvpReadSchema = undefined;
    }
  }
  throw lastError;
}

export async function appendRsvp(rsvp: EventRsvp): Promise<EventRsvp> {
  if (!hasDb()) {
    const existing = await readFileRsvps();
    const saved = { ...normalizeRsvp(rsvp), status: "local_only" as const };
    existing.push(saved);
    await writeFileRsvps(existing);
    return saved;
  }

  const sql = getSql();
  const earlyOver7 = rsvp.earlyArrival ? rsvp.earlyArrivalOver7 ?? 0 : 0;
  const earlyUnder7 = rsvp.earlyArrival ? rsvp.earlyArrivalUnder7 ?? 0 : 0;
  const notesWithEarly = composeNotes(
    { ...rsvp, earlyArrivalOver7: earlyOver7, earlyArrivalUnder7: earlyUnder7 },
    true,
  );

  try {
    const rows = (await sql`
      INSERT INTO event_rsvps (
        full_name, person_id, phone, guests,
        adults, children_3_12, children_under_3, amount_pln,
        notes, will_transfer, early_arrival, early_arrival_over_7,
        early_arrival_under_7, status
      ) VALUES (
        ${rsvp.fullName},
        ${rsvp.personId ?? null},
        ${rsvp.phone ?? null},
        ${rsvp.guests},
        ${rsvp.adults},
        ${rsvp.children3to12},
        ${rsvp.childrenUnder3},
        ${rsvp.amountPln},
        ${notesWithEarly},
        ${rsvp.willTransfer},
        ${Boolean(rsvp.earlyArrival)},
        ${earlyOver7},
        ${earlyUnder7},
        ${"new"}
      )
      RETURNING id, created_at, full_name, person_id, phone, guests,
                adults, children_3_12, children_under_3, amount_pln,
                notes, will_transfer, early_arrival, early_arrival_over_7,
                early_arrival_under_7, status
    `) as Row[];
    return rowToRsvp(rows[0]);
  } catch {
    try {
      const rows = (await sql`
        INSERT INTO event_rsvps (
          full_name, person_id, phone, guests,
          adults, children_3_12, children_under_3, amount_pln,
          notes, will_transfer, status
        ) VALUES (
          ${rsvp.fullName},
          ${rsvp.personId ?? null},
          ${rsvp.phone ?? null},
          ${rsvp.guests},
          ${rsvp.adults},
          ${rsvp.children3to12},
          ${rsvp.childrenUnder3},
          ${rsvp.amountPln},
          ${notesWithEarly},
          ${rsvp.willTransfer},
          ${"new"}
        )
        RETURNING id, created_at, full_name, person_id, phone, guests,
                  adults, children_3_12, children_under_3, amount_pln,
                  notes, will_transfer, status
      `) as Row[];
      return rowToRsvp(rows[0]);
    } catch {
      const rows = (await sql`
        INSERT INTO event_rsvps (
          full_name, person_id, phone, guests, notes, will_transfer, status
        ) VALUES (
          ${rsvp.fullName},
          ${rsvp.personId ?? null},
          ${rsvp.phone ?? null},
          ${rsvp.guests},
          ${notesWithEarly},
          ${rsvp.willTransfer},
          ${"new"}
        )
        RETURNING id, created_at, full_name, person_id, phone, guests, notes,
                  will_transfer, status
      `) as Row[];
      return rowToRsvp(rows[0]);
    }
  }
}

export async function cancelRsvp(id: string): Promise<EventRsvp | null> {
  if (!hasDb()) {
    const existing = await readFileRsvps();
    const idx = existing.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    existing[idx] = { ...existing[idx], status: "cancelled" };
    await writeFileRsvps(existing);
    return existing[idx];
  }

  const sql = getSql();
  try {
    const rows = (await sql`
      UPDATE event_rsvps
      SET status = 'cancelled'
      WHERE id = ${id} AND status <> 'cancelled'
      RETURNING id, created_at, full_name, person_id, phone, guests,
                adults, children_3_12, children_under_3, amount_pln,
                notes, will_transfer, early_arrival, early_arrival_over_7,
                early_arrival_under_7, status
    `) as Row[];
    return rows[0] ? rowToRsvp(rows[0]) : null;
  } catch {
    try {
      const rows = (await sql`
        UPDATE event_rsvps
        SET status = 'cancelled'
        WHERE id = ${id} AND status <> 'cancelled'
        RETURNING id, created_at, full_name, person_id, phone, guests,
                  adults, children_3_12, children_under_3, amount_pln,
                  notes, will_transfer, status
      `) as Row[];
      return rows[0] ? rowToRsvp(rows[0]) : null;
    } catch {
      const rows = (await sql`
        UPDATE event_rsvps
        SET status = 'cancelled'
        WHERE id = ${id} AND status <> 'cancelled'
        RETURNING id, created_at, full_name, person_id, phone, guests, notes,
                  will_transfer, status
      `) as Row[];
      return rows[0] ? rowToRsvp(rows[0]) : null;
    }
  }
}

export async function updateRsvp(rsvp: EventRsvp): Promise<EventRsvp> {
  const normalized = normalizeRsvp(rsvp);
  if (!hasDb()) {
    const existing = await readFileRsvps();
    const idx = existing.findIndex((r) => r.id === normalized.id);
    if (idx < 0) throw new Error("Brak zgłoszenia.");
    existing[idx] = normalized;
    await writeFileRsvps(existing);
    return normalized;
  }

  const sql = getSql();
  const earlyOver7 = normalized.earlyArrival
    ? normalized.earlyArrivalOver7 ?? 0
    : 0;
  const earlyUnder7 = normalized.earlyArrival
    ? normalized.earlyArrivalUnder7 ?? 0
    : 0;
  const notes = composeNotes(
    {
      ...normalized,
      earlyArrivalOver7: earlyOver7,
      earlyArrivalUnder7: earlyUnder7,
    },
    true,
  );

  try {
    const rows = (await sql`
      UPDATE event_rsvps SET
        full_name = ${normalized.fullName},
        person_id = ${normalized.personId ?? null},
        phone = ${normalized.phone ?? null},
        guests = ${normalized.guests},
        adults = ${normalized.adults},
        children_3_12 = ${normalized.children3to12},
        children_under_3 = ${normalized.childrenUnder3},
        amount_pln = ${normalized.amountPln},
        notes = ${notes},
        will_transfer = ${normalized.willTransfer},
        early_arrival = ${Boolean(normalized.earlyArrival)},
        early_arrival_over_7 = ${earlyOver7},
        early_arrival_under_7 = ${earlyUnder7},
        status = ${normalized.status}
      WHERE id = ${normalized.id}
      RETURNING id, created_at, full_name, person_id, phone, guests,
                adults, children_3_12, children_under_3, amount_pln,
                notes, will_transfer, early_arrival, early_arrival_over_7,
                early_arrival_under_7, status
    `) as Row[];
    if (!rows[0]) throw new Error("Brak zgłoszenia.");
    return rowToRsvp(rows[0]);
  } catch (err) {
    if (err instanceof Error && err.message === "Brak zgłoszenia.") throw err;
    try {
      const rows = (await sql`
        UPDATE event_rsvps SET
          full_name = ${normalized.fullName},
          person_id = ${normalized.personId ?? null},
          phone = ${normalized.phone ?? null},
          guests = ${normalized.guests},
          adults = ${normalized.adults},
          children_3_12 = ${normalized.children3to12},
          children_under_3 = ${normalized.childrenUnder3},
          amount_pln = ${normalized.amountPln},
          notes = ${notes},
          will_transfer = ${normalized.willTransfer},
          status = ${normalized.status}
        WHERE id = ${normalized.id}
        RETURNING id, created_at, full_name, person_id, phone, guests,
                  adults, children_3_12, children_under_3, amount_pln,
                  notes, will_transfer, status
      `) as Row[];
      if (!rows[0]) throw new Error("Brak zgłoszenia.");
      return rowToRsvp(rows[0]);
    } catch (inner) {
      if (inner instanceof Error && inner.message === "Brak zgłoszenia.") {
        throw inner;
      }
      const rows = (await sql`
        UPDATE event_rsvps SET
          full_name = ${normalized.fullName},
          person_id = ${normalized.personId ?? null},
          phone = ${normalized.phone ?? null},
          guests = ${normalized.guests},
          notes = ${notes},
          will_transfer = ${normalized.willTransfer},
          status = ${normalized.status}
        WHERE id = ${normalized.id}
        RETURNING id, created_at, full_name, person_id, phone, guests, notes,
                  will_transfer, status
      `) as Row[];
      if (!rows[0]) throw new Error("Brak zgłoszenia.");
      return rowToRsvp(rows[0]);
    }
  }
}

function decrementBreakdown(
  rsvp: EventRsvp,
  group: GuestAgeGroup,
): GuestBreakdown {
  let adults = rsvp.adults;
  let children3to12 = rsvp.children3to12;
  let childrenUnder3 = rsvp.childrenUnder3;
  if (group === "over7" && adults > 0) adults -= 1;
  else if (group === "under7" && children3to12 > 0) children3to12 -= 1;
  else if (group === "under3" && childrenUnder3 > 0) childrenUnder3 -= 1;
  else if (adults > 0) adults -= 1;
  else if (children3to12 > 0) children3to12 -= 1;
  else if (childrenUnder3 > 0) childrenUnder3 -= 1;
  return { adults, children3to12, childrenUnder3 };
}

export async function setPersonAttendance(opts: {
  personId: string;
  attending: boolean;
  fullName: string;
  ageGroup?: GuestAgeGroup;
}): Promise<{ already?: boolean; rsvp?: EventRsvp; cancelledIds: string[] }> {
  const existing = await readRsvps();
  const covering = existing.filter((r) => rsvpCoversPerson(r, opts.personId));

  if (opts.attending) {
    if (covering.length) return { already: true, cancelledIds: [] };
    const event = await readEvent();
    const breakdown = breakdownFromAgeGroups([opts.ageGroup ?? "over7"]);
    const guests = totalGuests(breakdown);
    const amountPln = amountDuePln(
      breakdown,
      event.pricePerPersonPln,
      null,
      event.priceUnder7Pln,
    );
    const draft: EventRsvp = {
      id: `rsvp-${Date.now()}`,
      createdAt: new Date().toISOString(),
      fullName: opts.fullName,
      personId: opts.personId,
      guests,
      adults: breakdown.adults,
      children3to12: breakdown.children3to12,
      childrenUnder3: breakdown.childrenUnder3,
      amountPln,
      willTransfer: false,
      coveredPersonIds: [opts.personId],
      source: "admin",
      status: "new",
    };
    return { rsvp: await appendRsvp(draft), cancelledIds: [] };
  }

  const event = await readEvent();
  const cancelledIds: string[] = [];
  for (const rsvp of covering) {
    const remaining = (rsvp.coveredPersonIds ?? []).filter(
      (id) => id !== opts.personId,
    );
    const wasPayer = rsvp.personId === opts.personId;
    const onlyThisPerson =
      remaining.length === 0 && (wasPayer || !(rsvp.coveredPersonIds ?? []).length);

    if (onlyThisPerson) {
      const cancelled = await cancelRsvp(rsvp.id);
      if (cancelled) cancelledIds.push(rsvp.id);
      continue;
    }

    const nextBreakdown = decrementBreakdown(rsvp, opts.ageGroup ?? "over7");
    const guests = totalGuests(nextBreakdown);
    if (guests < 1) {
      const cancelled = await cancelRsvp(rsvp.id);
      if (cancelled) cancelledIds.push(rsvp.id);
      continue;
    }

    const earlyOver7 = Math.min(
      rsvp.earlyArrivalOver7 ?? 0,
      nextBreakdown.adults,
    );
    const earlyUnder7 = Math.min(
      rsvp.earlyArrivalUnder7 ?? 0,
      nextBreakdown.children3to12,
    );
    const early = {
      earlyArrival: Boolean(rsvp.earlyArrival) && earlyOver7 + earlyUnder7 > 0,
      earlyArrivalOver7: earlyOver7,
      earlyArrivalUnder7: earlyUnder7,
    };
    await updateRsvp({
      ...rsvp,
      personId: wasPayer ? remaining[0] : rsvp.personId,
      guests,
      adults: nextBreakdown.adults,
      children3to12: nextBreakdown.children3to12,
      childrenUnder3: nextBreakdown.childrenUnder3,
      amountPln: amountDuePln(
        nextBreakdown,
        event.pricePerPersonPln,
        early,
        event.priceUnder7Pln,
      ),
      earlyArrival: early.earlyArrival,
      earlyArrivalOver7: early.earlyArrivalOver7,
      earlyArrivalUnder7: early.earlyArrivalUnder7,
      coveredPersonIds: remaining,
    });
  }

  return { cancelledIds };
}

export async function setRsvpPaid(
  id: string,
  paid: boolean,
): Promise<EventRsvp | null> {
  const existing = await readRsvps();
  const rsvp = existing.find((r) => r.id === id);
  if (!rsvp || rsvp.status === "cancelled") return null;
  return updateRsvp({ ...rsvp, paid });
}

function ticketsFromCovered(
  coveredIds: string[],
  people: Person[],
): GuestBreakdown {
  const byId = new Map(people.map((p) => [p.id, p]));
  return breakdownFromAgeGroups(
    coveredIds.map((id) => ageGroupFromBirth(byId.get(id)?.birthDate)),
  );
}

function paymentTickets(
  event: Awaited<ReturnType<typeof readEvent>>,
  breakdown: GuestBreakdown,
  amountOverride?: number,
) {
  const guests = totalGuests(breakdown);
  if (guests < 1) {
    throw new Error("Wybierz przynajmniej jeden bilet.");
  }
  const computed = amountDuePln(
    breakdown,
    event.pricePerPersonPln,
    null,
    event.priceUnder7Pln,
  );
  return {
    ...breakdown,
    guests,
    amountPln: amountOverride != null ? amountOverride : computed,
  };
}

export async function createAdminPayment(opts: {
  fullName: string;
  personId?: string;
  coveredPersonIds: string[];
  willTransfer: boolean;
  paid: boolean;
  people: Person[];
  adults?: number;
  children3to12?: number;
  childrenUnder3?: number;
  amountPln?: number;
}): Promise<EventRsvp> {
  const event = await readEvent();
  const byId = new Map(opts.people.map((p) => [p.id, p]));
  const covered = [...new Set(opts.coveredPersonIds.filter((id) => byId.has(id)))];
  if (opts.personId && byId.has(opts.personId) && !covered.includes(opts.personId)) {
    covered.unshift(opts.personId);
  }
  if (covered.length < 1) {
    throw new Error("Wybierz, za kogo jest wpłata.");
  }
  const inferred = ticketsFromCovered(covered, opts.people);
  const hasTicketOverride =
    opts.adults != null ||
    opts.children3to12 != null ||
    opts.childrenUnder3 != null;
  const breakdown: GuestBreakdown = hasTicketOverride
    ? {
        adults: opts.adults ?? 0,
        children3to12: opts.children3to12 ?? 0,
        childrenUnder3: opts.childrenUnder3 ?? 0,
      }
    : inferred;
  const priced = paymentTickets(event, breakdown, opts.amountPln);
  return appendRsvp({
    id: `rsvp-${Date.now()}`,
    createdAt: new Date().toISOString(),
    fullName: opts.fullName,
    personId: opts.personId,
    guests: priced.guests,
    adults: priced.adults,
    children3to12: priced.children3to12,
    childrenUnder3: priced.childrenUnder3,
    amountPln: priced.amountPln,
    willTransfer: opts.willTransfer,
    paid: opts.paid,
    coveredPersonIds: covered,
    source: "admin",
    status: "new",
  });
}

export async function updateAdminPayment(opts: {
  rsvpId: string;
  adults?: number;
  children3to12?: number;
  childrenUnder3?: number;
  amountPln?: number;
  willTransfer?: boolean;
  paid?: boolean;
}): Promise<EventRsvp | null> {
  const existing = await readRsvps();
  const rsvp = existing.find((r) => r.id === opts.rsvpId);
  if (!rsvp || rsvp.status === "cancelled") return null;
  const event = await readEvent();
  const breakdown: GuestBreakdown = {
    adults: opts.adults ?? rsvp.adults,
    children3to12: opts.children3to12 ?? rsvp.children3to12,
    childrenUnder3: opts.childrenUnder3 ?? rsvp.childrenUnder3,
  };
  const priced = paymentTickets(event, breakdown, opts.amountPln);
  return updateRsvp({
    ...rsvp,
    guests: priced.guests,
    adults: priced.adults,
    children3to12: priced.children3to12,
    childrenUnder3: priced.childrenUnder3,
    amountPln: priced.amountPln,
    willTransfer: opts.willTransfer ?? rsvp.willTransfer,
    paid: opts.paid ?? rsvp.paid,
  });
}
