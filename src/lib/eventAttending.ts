import type { EventRsvp } from "@/types/event";
import type { Person } from "@/types/family";

function normName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function rsvpCoversPerson(rsvp: EventRsvp, personId: string): boolean {
  if (rsvp.status === "cancelled") return false;
  if (rsvp.personId === personId) return true;
  return (rsvp.coveredPersonIds ?? []).includes(personId);
}

/** Spouse, children, parents and siblings — people you often pay for. */
export function householdSuggestions(
  personId: string,
  people: Person[],
): Person[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const person = byId.get(personId);
  if (!person) return [];
  const ids: string[] = [];
  const add = (id?: string) => {
    if (!id || id === personId || !byId.has(id) || ids.includes(id)) return;
    ids.push(id);
  };
  for (const id of person.spouseIds) add(id);
  for (const p of people) {
    if (p.parentIds.includes(personId)) add(p.id);
  }
  for (const id of person.parentIds) add(id);
  if (person.parentIds.length) {
    for (const p of people) {
      if (p.id === personId) continue;
      if (p.parentIds.some((pid) => person.parentIds.includes(pid))) add(p.id);
    }
  }
  return ids.map((id) => byId.get(id)!);
}

/** Map RSVPs onto tree people: matching person_id, otherwise exact full name. */
export function resolveAttendingPersonIds(
  rsvps: Array<{
    status?: string;
    personId?: string;
    coveredPersonIds?: string[];
    fullName: string;
  }>,
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
    for (const id of rsvp.coveredPersonIds ?? []) {
      if (knownIds.has(id)) attending.add(id);
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
