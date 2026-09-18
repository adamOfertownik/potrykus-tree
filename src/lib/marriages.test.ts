import assert from "node:assert/strict";
import { test } from "node:test";
import type { Person } from "../types/family.ts";
import {
  applyMarriagesToPerson,
  hydrateMarriages,
  linkCouple,
  markCoupleDivorced,
  mergeMarriagesWithSpouseIds,
  primaryWeddingDate,
} from "./marriages.ts";

function person(id: string, extra: Partial<Person> = {}): Person {
  return {
    id,
    firstName: id,
    lastName: "Test",
    gender: "unknown",
    parentIds: [],
    spouseIds: [],
    ...extra,
  };
}

test("hydrate uses legacy weddingDate on first spouse", () => {
  const a = person("a", { spouseIds: ["b", "c"], weddingDate: "1990-06-01" });
  const list = hydrateMarriages(a);
  assert.equal(list.length, 2);
  assert.equal(list[0]!.weddingDate, "1990-06-01");
  assert.equal(list[1]!.weddingDate, undefined);
});

test("two marriages keep both spouses; divorce is not a date", () => {
  const a = person("a");
  const b = person("b");
  const c = person("c");
  linkCouple(a, b, "1980-05-12");
  linkCouple(a, c, "2001-09-03");
  markCoupleDivorced(a, b);
  assert.deepEqual(a.spouseIds, ["b", "c"]);
  assert.equal(a.marriages?.[0]?.divorced, true);
  assert.equal(a.marriages?.[0]?.weddingDate, "1980-05-12");
  assert.equal(b.marriages?.[0]?.divorced, true);
  assert.equal(primaryWeddingDate(a.marriages ?? []), "2001-09-03");
  assert.equal(a.weddingDate, "2001-09-03");
});

test("link copies wedding date onto both people", () => {
  const a = person("a");
  const b = person("b");
  linkCouple(a, b, "1977-04-02");
  assert.equal(a.weddingDate, "1977-04-02");
  assert.equal(b.weddingDate, "1977-04-02");
  assert.equal(b.marriages?.[0]?.spouseId, "a");
});

test("merge spouse ids keeps existing divorce flags", () => {
  const merged = mergeMarriagesWithSpouseIds(
    [{ spouseId: "b", weddingDate: "1991", divorced: true }],
    ["b", "c"],
  );
  assert.equal(merged[0]!.divorced, true);
  assert.equal(merged[1]!.spouseId, "c");
});

test("apply drops empty marriages list", () => {
  const a = person("a", { spouseIds: ["b"], weddingDate: "2000" });
  applyMarriagesToPerson(a, []);
  assert.equal(a.marriages, undefined);
  assert.deepEqual(a.spouseIds, []);
  assert.equal(a.weddingDate, undefined);
});
