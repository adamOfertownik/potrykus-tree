import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { EventRsvp, FamilyEvent } from "@/types/event";

const DATA_DIR = path.join(process.cwd(), "data");
const EVENT_PATH = path.join(DATA_DIR, "event.json");
const RSVP_PATH = path.join(DATA_DIR, "event-rsvps.json");

export async function readEvent(): Promise<FamilyEvent> {
  const raw = await readFile(EVENT_PATH, "utf-8");
  return JSON.parse(raw) as FamilyEvent;
}

export async function readRsvps(): Promise<EventRsvp[]> {
  try {
    const raw = await readFile(RSVP_PATH, "utf-8");
    const parsed = JSON.parse(raw) as { rsvps?: EventRsvp[] };
    return parsed.rsvps ?? [];
  } catch {
    return [];
  }
}

export async function appendRsvp(rsvp: EventRsvp): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const existing = await readRsvps();
  existing.push(rsvp);
  await writeFile(
    RSVP_PATH,
    JSON.stringify(
      {
        note: "PROTOTYP — zapisy lokalne, bez trwałej bazy",
        rsvps: existing,
      },
      null,
      2,
    ),
    "utf-8",
  );
}
