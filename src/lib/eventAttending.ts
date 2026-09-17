import type { EventRsvp } from "@/types/event";

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Map RSVPs onto tree people: matching person_id, otherwise exact full name. */
export function resolveAttendingPersonIds(
  rsvps: EventRsvp[],
  people: { id: string; firstName: string; lastName: string }[],
): string[] {
  const active = rsvps.filter((r) => r.status !== "cancelled");
  const knownIds = new Set(people.map((p) => p.id));
  const byName = new Map<string, string[]>();
  for (const p of people) {
    const key = normName(`${p.firstName} ${p.lastName}`);
    const ids = byName.get(key) ?? [];
    ids.push(p.id);
    byName.set(key, ids);
  }

  const attending = new Set<string>();
  for (const rsvp of active) {
    if (rsvp.personId && knownIds.has(rsvp.personId)) {
      attending.add(rsvp.personId);
    }
    const nameIds = byName.get(normName(rsvp.fullName));
    if (nameIds) {
      for (const id of nameIds) attending.add(id);
    }
  }
  return [...attending];
}

export function isActiveRsvp(rsvp: EventRsvp): boolean {
  return rsvp.status !== "cancelled";
}
