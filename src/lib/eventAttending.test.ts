import assert from "node:assert/strict";
import { test } from "node:test";
import type { EventRsvp } from "../types/event.ts";
import {
  resolveAttendingPersonIds,
  rsvpMatchesUniqueName,
} from "./eventAttending.ts";

const people = [
  { id: "a", firstName: "Jan", lastName: "Potrykus" },
  { id: "b", firstName: "Jan", lastName: "Potrykus" },
  { id: "c", firstName: "Maria", lastName: "Lieske" },
];

function rsvp(partial: Partial<EventRsvp> & Pick<EventRsvp, "id" | "fullName">): EventRsvp {
  return {
    createdAt: "2026-01-01",
    guests: 1,
    adults: 1,
    children3to12: 0,
    childrenUnder3: 0,
    amountPln: 0,
    willTransfer: false,
    status: "new",
    ...partial,
  };
}

test("one Jan Potrykus RSVP does not mark every Jan as attending", () => {
  const ids = resolveAttendingPersonIds(
    [rsvp({ id: "1", fullName: "Jan Potrykus", personId: "a", coveredPersonIds: ["a"] })],
    people,
  );
  assert.deepEqual(ids.sort(), ["a"]);
});

test("name-only RSVP marks a person only when the name is unique", () => {
  const unique = resolveAttendingPersonIds(
    [rsvp({ id: "1", fullName: "Maria Lieske" })],
    people,
  );
  assert.deepEqual(unique, ["c"]);

  const ambiguous = resolveAttendingPersonIds(
    [rsvp({ id: "2", fullName: "Jan Potrykus" })],
    people,
  );
  assert.deepEqual(ambiguous, []);
});

test("wypisz unique-name match ignores other Jans", () => {
  const row = rsvp({ id: "1", fullName: "Maria Lieske" });
  assert.equal(rsvpMatchesUniqueName(row, "c", people), true);
  assert.equal(rsvpMatchesUniqueName(row, "a", people), false);

  const jan = rsvp({ id: "2", fullName: "Jan Potrykus" });
  assert.equal(rsvpMatchesUniqueName(jan, "a", people), false);
  assert.equal(rsvpMatchesUniqueName(jan, "b", people), false);
});
