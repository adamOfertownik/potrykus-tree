import type { EventRsvp } from "@/types/event";
import type { Person } from "@/types/family";

export function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function personNameKey(person: {
  firstName: string;
  lastName: string;
}): string {
  return normalizePersonName(`${person.firstName} ${person.lastName}`);
}

/** Names that belong to exactly one person in the tree. */
export function uniqueNamePersonIds(
  people: { id: string; firstName: string; lastName: string }[],
): Map<string, string> {
  const buckets = new Map<string, string[]>();
  for (const person of people) {
    const key = personNameKey(person);
    const ids = buckets.get(key) ?? [];
    ids.push(person.id);
    buckets.set(key, ids);
  }
  const unique = new Map<string, string>();
  for (const [key, ids] of buckets) {
    if (ids.length === 1) unique.set(key, ids[0]!);
  }
  return unique;
}

export function rsvpCoversPerson(rsvp: EventRsvp, personId: string): boolean {
  if (rsvp.status === "cancelled") return false;
  if (rsvp.personId === personId) return true;
  return (rsvp.coveredPersonIds ?? []).includes(personId);
}

/** Name-only RSVP matches this person when that name is unique in the tree. */
export function rsvpMatchesUniqueName(
  rsvp: EventRsvp,
  personId: string,
  people: { id: string; firstName: string; lastName: string }[],
): boolean {
  if (rsvp.status === "cancelled") return false;
  if (rsvp.personId || (rsvp.coveredPersonIds ?? []).length) return false;
  const unique = uniqueNamePersonIds(people);
  return unique.get(normalizePersonName(rsvp.fullName)) === personId;
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

/** Map RSVPs onto tree people: person_id / covered ids, unique name only as fallback. */
export function resolveAttendingPersonIds(
  rsvps: EventRsvp[],
  people: { id: string; firstName: string; lastName: string }[],
): string[] {
  const active = rsvps.filter((r) => r.status !== "cancelled");
  const knownIds = new Set(people.map((p) => p.id));
  const uniqueNames = uniqueNamePersonIds(people);

  const attending = new Set<string>();
  for (const rsvp of active) {
    if (rsvp.personId && knownIds.has(rsvp.personId)) {
      attending.add(rsvp.personId);
    }
    for (const id of rsvp.coveredPersonIds ?? []) {
      if (knownIds.has(id)) attending.add(id);
    }
    if (rsvp.personId || (rsvp.coveredPersonIds ?? []).length) continue;
    const uniqueId = uniqueNames.get(normalizePersonName(rsvp.fullName));
    if (uniqueId) attending.add(uniqueId);
  }
  return [...attending];
}

export function isActiveRsvp(rsvp: EventRsvp): boolean {
  return rsvp.status !== "cancelled";
}
