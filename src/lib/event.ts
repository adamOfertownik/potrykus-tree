import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventRsvp, FamilyEvent } from "@/types/event";
import { getSql, hasDb } from "@/lib/sql";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENT_PATH = path.join(DATA_DIR, "event.json");
const RSVP_PATH = path.join(DATA_DIR, "event-rsvps.json");

export async function readEvent(): Promise<FamilyEvent> {
  const raw = await readFile(EVENT_PATH, "utf-8");
  return JSON.parse(raw) as FamilyEvent;
}

async function readFileRsvps(): Promise<EventRsvp[]> {
  try {
    const raw = await readFile(RSVP_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { rsvps?: EventRsvp[] };
    return parsed.rsvps ?? [];
  } catch {
    return [];
  }
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
  notes: string | null;
  will_transfer: boolean;
  status: string;
};

function rowToRsvp(row: Row): EventRsvp {
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
    notes: row.notes || undefined,
    willTransfer: row.will_transfer,
    status: row.status as EventRsvp["status"],
  };
}

export async function readRsvps(): Promise<EventRsvp[]> {
  if (!hasDb()) return readFileRsvps();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, created_at, full_name, person_id, phone, guests, notes,
           will_transfer, status
    FROM event_rsvps
    ORDER BY created_at DESC
  `) as Row[];
  return rows.map(rowToRsvp);
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
