import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";
import { householdSuggestions } from "../src/lib/eventAttending";
import type { Person } from "../src/types/family";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);
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

test("admin payments can cover any tree person, not only household", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin?tab=platnosci");
  await expect(page.getByRole("heading", { name: "Panel admina" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole("heading", { name: "Dodaj kto zapłacił" }),
  ).toBeVisible({ timeout: 15_000 });

  const familyRes = await page.request.get("/api/admin/family");
  expect(familyRes.ok()).toBeTruthy();
  const family = (await familyRes.json()) as { people: Person[] };
  const people = family.people;
  expect(people.length).toBeGreaterThan(5);

  const payer =
    people.find((p) => p.firstName === "Adam" && p.lastName === "Lieske") ??
    people.find((p) => p.firstName && p.lastName);
  expect(payer, "need a payer from the tree").toBeTruthy();
  const near = new Set(
    householdSuggestions(payer!.id, people).map((p) => p.id),
  );
  near.add(payer!.id);
  const other = people.find(
    (p) =>
      !near.has(p.id) &&
      p.lastName !== payer!.lastName &&
      p.firstName &&
      p.lastName,
  );
  expect(other, "need a distant relative to add").toBeTruthy();

  const payerQuery = `${payer!.firstName} ${payer!.lastName}`;
  await expect(async () => {
    await page.getByLabel("Kto płaci").fill(payerQuery);
    await expect(
      page
        .locator(".admin-pay__add > .event-person-field .who-matches button")
        .filter({ hasText: payer!.firstName })
        .first(),
    ).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await page
    .locator(".admin-pay__add > .event-person-field .who-matches button")
    .filter({ hasText: payer!.firstName })
    .first()
    .click();

  await expect(page.getByText(`Płatnik:`, { exact: false })).toBeVisible();
  await expect(
    page.getByLabel("Dodaj kolejną osobę z drzewa"),
  ).toBeVisible();

  const otherQuery = `${other!.firstName} ${other!.lastName}`;
  await page.getByLabel("Dodaj kolejną osobę z drzewa").fill(otherQuery);
  await expect(
    page
      .locator(".admin-pay__cover .who-matches button")
      .filter({ hasText: other!.firstName })
      .first(),
  ).toBeVisible({ timeout: 10_000 });
  await page
    .locator(".admin-pay__cover .who-matches button")
    .filter({ hasText: other!.firstName })
    .first()
    .click();

  await expect(
    page.locator(".admin-pay__cover").getByText(other!.firstName, {
      exact: false,
    }),
  ).toBeVisible();
  const extraBox = page.locator(".admin-pay__cover label").filter({
    hasText: other!.firstName,
  });
  await expect(extraBox.locator("input[type=checkbox]")).toBeChecked();

  await ctx.close();
});
