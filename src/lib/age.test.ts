import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ageOnDate,
  completedYears,
  currentAge,
  displayedAge,
  formatAgePl,
  parseCivilDate,
} from "./age.ts";

describe("parseCivilDate", () => {
  it("reads YYYY-MM-DD and ignores a time suffix", () => {
    assert.deepEqual(parseCivilDate("1956-08-26"), {
      year: 1956,
      month: 8,
      day: 26,
    });
    assert.deepEqual(parseCivilDate("1956-08-26T00:00:00Z"), {
      year: 1956,
      month: 8,
      day: 26,
    });
  });

  it("rejects year-only or month-only values", () => {
    assert.equal(parseCivilDate("1956"), null);
    assert.equal(parseCivilDate("1956-08"), null);
  });
});

describe("completedYears / Brunon Lieske 1956-08-26", () => {
  const brunon = { year: 1956, month: 8, day: 26 };

  it("is 69 the day before the 70th birthday", () => {
    assert.equal(completedYears(brunon, { year: 2026, month: 8, day: 25 }), 69);
  });

  it("turns 70 on the birthday, not 71", () => {
    assert.equal(completedYears(brunon, { year: 2026, month: 8, day: 26 }), 70);
  });

  it("stays 70 the day after the birthday (the reported off-by-one)", () => {
    assert.equal(completedYears(brunon, { year: 2026, month: 8, day: 27 }), 70);
    assert.equal(completedYears(brunon, { year: 2026, month: 9, day: 7 }), 70);
  });

  it("does not jump at UTC midnight independently of the civil day", () => {
    assert.equal(ageOnDate("1956-08-26", { year: 2026, month: 8, day: 26 }), 70);
    assert.equal(ageOnDate("1956-08-26", { year: 2026, month: 9, day: 7 }), 70);
  });
});

describe("currentAge uses the local civil date, not Date ISO parsing", () => {
  it("matches calendar math for a fixed local Date", () => {
    const local = new Date(2026, 8, 7, 23, 30, 0); // 7 Sep 2026 evening
    assert.equal(currentAge("1956-08-26", local), 70);
  });
});

describe("displayedAge", () => {
  it("uses age at death when the person has died", () => {
    assert.equal(
      displayedAge({ birthDate: "1920-01-10", deathDate: "1990-01-09" }),
      69,
    );
    assert.equal(
      displayedAge({ birthDate: "1920-01-10", deathDate: "1990-01-10" }),
      70,
    );
  });
});

describe("formatAgePl", () => {
  it("uses rok / lata / lat", () => {
    assert.equal(formatAgePl(1), "1 rok");
    assert.equal(formatAgePl(2), "2 lata");
    assert.equal(formatAgePl(4), "4 lata");
    assert.equal(formatAgePl(5), "5 lat");
    assert.equal(formatAgePl(12), "12 lat");
    assert.equal(formatAgePl(22), "22 lata");
    assert.equal(formatAgePl(70), "70 lat");
    assert.equal(formatAgePl(71), "71 lat");
  });
});
