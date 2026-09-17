import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventRsvp, FamilyEvent } from "@/types/event";
import {
  DEFAULT_EVENT_CAPACITY,
  DEFAULT_PRICE_PER_PERSON_PLN,
} from "@/lib/eventPricing";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENT_PATH = path.join(DATA_DIR, "event.json");
const RSVP_PATH = path.join(DATA_DIR, "event-rsvps.json");

const EARLY_NOTE_PREFIX = "Wczesny przyjazd:";

export async function readEvent(): Promise<FamilyEvent> {
  const raw = await readFile(EVENT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as FamilyEvent;
  return {
    ...parsed,
    pricePerPersonPln:
      parsed.pricePerPersonPln ?? DEFAULT_PRICE_PER_PERSON_PLN,
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
  if (rsvp.notes?.trim()) parts.push(rsvp.notes.trim());
  return parts.length ? parts.join("\n") : null;
}

function normalizeRsvp(r: EventRsvp): EventRsvp {
  const adults = r.adults ?? r.guests ?? 1;
  const children3to12 = r.children3to12 ?? 0;
  const childrenUnder3 = r.childrenUnder3 ?? 0;
  const guests = r.guests ?? adults + children3to12 + childrenUnder3;
  const parsed = parseEarlyArrivalNote(r.notes);
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
    notes: r.earlyArrival ? r.notes : parsed.notes,
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
    notes: earlyFromCol ? row.notes || undefined : parsed.notes,
    willTransfer: row.will_transfer,
    earlyArrival: earlyFromCol ? Boolean(row.early_arrival) : parsed.earlyArrival,
    earlyArrivalOver7: earlyFromCol
      ? row.early_arrival_over_7 ?? 0
      : parsed.earlyArrivalOver7,
    earlyArrivalUnder7: earlyFromCol
      ? row.early_arrival_under_7 ?? 0
      : parsed.earlyArrivalUnder7,
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
