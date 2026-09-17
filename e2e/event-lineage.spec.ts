import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Person } from "../src/types/family";
import {
  classifyPersonLineage,
  MEETING_HELENA_ID,
  MEETING_LINE_ROOT_ID,
  MEETING_WLADEK_ID,
  summarizeMeetingLineage,
} from "../src/lib/eventLineage";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);
const family = JSON.parse(
  readFileSync(path.join(root, "data/family.json"), "utf8"),
) as { people: Person[] };
const people = family.people;
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333";

async function adminCookie() {
  const token = await new SignJWT({
    role: "admin",
    adminId: "00000000-0000-0000-0000-000000000001",
    email: "tester@example.com",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return {
    name: "potrykus_admin_session",
    value: token,
    url: base,
  };
}

test("classifies Franciszek line vs Babcia Helena vs Władek", () => {
  expect(classifyPersonLineage(MEETING_LINE_ROOT_ID, people)).toEqual({
    kind: "root",
    via: "self",
  });
  expect(classifyPersonLineage("P061", people)).toEqual({
    kind: "root",
    via: "spouse",
  });
  expect(classifyPersonLineage(MEETING_HELENA_ID, people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_HELENA_ID,
    via: "self",
  });
  expect(classifyPersonLineage("P149", people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_HELENA_ID,
    via: "blood",
  });
  expect(classifyPersonLineage("P126", people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_HELENA_ID,
    via: "spouse",
  });
  expect(classifyPersonLineage(MEETING_WLADEK_ID, people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_WLADEK_ID,
    via: "self",
  });
  expect(classifyPersonLineage("P272", people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_WLADEK_ID,
    via: "blood",
  });
  expect(classifyPersonLineage("P271", people)).toMatchObject({
    kind: "branch",
    branchId: MEETING_WLADEK_ID,
    via: "spouse",
  });
  expect(classifyPersonLineage("P001", people)).toEqual({ kind: "outside" });
});

test("summarize counts Helena and Władek attendees separately", () => {
  const summary = summarizeMeetingLineage(people, [
    {
      fullName: "Helena Kiepke",
      personId: "P149",
      coveredPersonIds: ["P149"],
      guests: 2,
    },
    {
      fullName: "Stanisław Potrykus",
      personId: "P272",
      coveredPersonIds: ["P272", "P273"],
      guests: 2,
    },
    {
      fullName: "Gość spoza drzewa",
      guests: 3,
    },
  ]);
  expect(summary.helena?.personCount).toBe(1);
  expect(summary.helena?.ticketCount).toBe(2);
  expect(summary.wladek?.personCount).toBe(2);
  expect(summary.wladek?.ticketCount).toBe(2);
  expect(summary.unmatchedTicketCount).toBe(3);
  expect(summary.unmatchedNameCount).toBe(1);
  expect(summary.treePersonCount).toBe(3);
});

test("admin payments tab shows lineage breakdown", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin?tab=platnosci");
  await expect(
    page.getByRole("heading", { name: "Kto od kogo na spotkanie" }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(`a[href="/osoba/${MEETING_LINE_ROOT_ID}"]`)).toHaveCount(
    1,
  );
  await expect(page.locator(`a[href="/osoba/${MEETING_HELENA_ID}"]`)).toHaveCount(
    2,
  );
  await expect(page.locator(`a[href="/osoba/${MEETING_WLADEK_ID}"]`)).toHaveCount(
    2,
  );
  await expect(
    page.getByRole("heading", { name: "Babcia Helena" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Władek" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Od kogo — dzieci Franciszka" }),
  ).toBeVisible();
  await expect(page.getByText("Helena Hallmann")).toBeVisible();
  await expect(page.getByText("Władysław Potrykus")).toBeVisible();
  await ctx.close();
});
