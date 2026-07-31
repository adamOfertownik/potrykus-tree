import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventRsvp, FamilyEvent } from "@/types/event";
import { DEFAULT_PRICE_PER_PERSON_PLN } from "@/lib/eventPricing";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENT_PATH = path.join(DATA_DIR, "event.json");
const RSVP_PATH = path.join(DATA_DIR, "event-rsvps.json");

export async function readEvent(): Promise<FamilyEvent> {
  const raw = await readFile(EVENT_PATH, "utf-8");
  const parsed = JSON.parse(raw) as FamilyEvent;
  return {
    ...parsed,
    pricePerPersonPln:
      parsed.pricePerPersonPln ?? DEFAULT_PRICE_PER_PERSON_PLN,
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

function normalizeRsvp(r: EventRsvp): EventRsvp {
  const adults = r.adults ?? r.guests ?? 1;
  const children3to12 = r.children3to12 ?? 0;
  const childrenUnder3 = r.childrenUnder3 ?? 0;
  const guests = r.guests ?? adults + children3to12 + childrenUnder3;
  return {
    ...r,
    adults,
    children3to12,
    childrenUnder3,
    guests,
    amountPln: r.amountPln ?? 0,
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
  status: string;
};

function rowToRsvp(row: Row): EventRsvp {
  const adults = row.adults ?? row.guests ?? 1;
  const children3to12 = row.children_3_12 ?? 0;
  const childrenUnder3 = row.children_under_3 ?? 0;
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
    notes: row.notes || undefined,
    willTransfer: row.will_transfer,
    status: row.status as EventRsvp["status"],
  };
}

export async function readRsvps(): Promise<EventRsvp[]> {
  if (!hasDb()) return readFileRsvps();
  const sql = getSql();
  try {
    const rows = (await sql`
      SELECT id, created_at, full_name, person_id, phone, guests,
             adults, children_3_12, children_under_3, amount_pln,
             notes, will_transfer, status
      FROM event_rsvps
      ORDER BY created_at DESC
    `) as Row[];
    return rows.map(rowToRsvp);
  } catch {
    // Pre-migration schema: columns may be missing
    const rows = (await sql`
      SELECT id, created_at, full_name, person_id, phone, guests, notes,
             will_transfer, status
      FROM event_rsvps
      ORDER BY created_at DESC
    `) as Row[];
    return rows.map(rowToRsvp);
  }
}

export async function appendRsvp(rsvp: EventRsvp): Promise<EventRsvp> {
  if (!hasDb()) {
    const existing = await readFileRsvps();
    const saved = { ...rsvp, status: "local_only" as const };
    existing.push(saved);
    await writeFileRsvps(existing);
    return saved;
  }

  const sql = getSql();
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
        ${rsvp.notes ?? null},
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
        ${rsvp.notes ?? null},
        ${rsvp.willTransfer},
        ${"new"}
      )
      RETURNING id, created_at, full_name, person_id, phone, guests, notes,
                will_transfer, status
    `) as Row[];
    return rowToRsvp(rows[0]);
  }
}
