import assert from "node:assert/strict";
import { test } from "node:test";
import type { Person } from "../types/family.ts";
import { chartParentIds, peopleToFamilyChartData } from "./familyChartData.ts";

function person(partial: Partial<Person> & Pick<Person, "id" | "firstName">): Person {
  return {
    lastName: "Lieske",
    gender: "female",
    parentIds: [],
    spouseIds: [],
    ...partial,
  };
}

test("child of two sibling parents is hung under one parent on the chart", () => {
  const tola = person({
    id: "tola",
    firstName: "Tola",
    parentIds: ["adam", "julia"],
  });
  const milo = person({
    id: "milo",
    firstName: "Milo",
    gender: "male",
    parentIds: ["adam", "julia"],
  });
  const child = person({
    id: "test",
    firstName: "test",
    lastName: "test",
    parentIds: ["tola", "milo"],
    birthDate: "2026-09-24",
  });
  const people = [tola, milo, child];
  const byId = new Map(people.map((p) => [p.id, p]));

  assert.deepEqual(chartParentIds(child, byId), ["tola"]);

  const data = peopleToFamilyChartData(people);
  const tolaNode = data.find((d) => d.id === "tola")!;
  const miloNode = data.find((d) => d.id === "milo")!;
  const childNode = data.find((d) => d.id === "test")!;

  assert.deepEqual(childNode.rels.parents, ["tola"]);
  assert.deepEqual(tolaNode.rels.children, ["test"]);
  assert.deepEqual(miloNode.rels.children, []);
});

test("child of a married couple keeps both parents on the chart", () => {
  const adam = person({
    id: "adam",
    firstName: "Adam",
    gender: "male",
    spouseIds: ["julia"],
  });
  const julia = person({
    id: "julia",
    firstName: "Julia",
    spouseIds: ["adam"],
  });
  const tola = person({
    id: "tola",
    firstName: "Tola",
    parentIds: ["adam", "julia"],
  });
  const people = [adam, julia, tola];
  const data = peopleToFamilyChartData(people);
  const tolaNode = data.find((d) => d.id === "tola")!;
  assert.deepEqual(new Set(tolaNode.rels.parents), new Set(["adam", "julia"]));
});
