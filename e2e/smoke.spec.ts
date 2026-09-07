import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);

async function sessionCookie() {
  const token = await new SignJWT({ role: "family" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return {
    name: cfg.cookieName,
    value: token,
    url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333",
  };
}

test("search highlights without filtering tree", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  const before = await page.locator("#htmlSvg .card_cont").count();
  const input = page.locator(".person-search input").first();
  await input.fill("Tola Lieske");
  await page.waitForTimeout(500);
  await page.locator(".person-search__item").first().click();
  await page.waitForTimeout(1000);
  const after = await page.locator("#htmlSvg .card_cont").count();
  expect(after).toBe(before);
  expect(await page.locator(".is-chart-highlight").count()).toBeGreaterThan(0);
  await ctx.close();
});

test("kinship and birthdays pages load", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Adam Lieske", personId: "adam-lieske" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/pokrewienstwo");
  await expect(page.getByRole("heading", { name: "Kto jest kim" })).toBeVisible({
    timeout: 20000,
  });
  await page.goto("/urodziny");
  await expect(page.getByRole("heading", { name: /Urodziny/ })).toBeVisible({
    timeout: 20000,
  });
  await ctx.close();
});

test("report incorrect person data from details and tree", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Adam Lieske", personId: "adam-lieske" }),
    );
  });
  const page = await ctx.newPage();

  await page.goto("/osoba/adam-lieske");
  await expect(page.getByRole("heading", { name: "Adam Lieske" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Zgłoś błędne dane", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Zgłoś błędne dane" }),
  ).toBeVisible();
  await page
    .getByLabel("Co jest błędne?")
    .fill("Testowa poprawka daty urodzenia.");
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByText(/Zapisano/)).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: "Zamknij" }).click();

  await page.goto("/drzewo?root=adam-lieske");
  await expect(
    page.getByRole("button", { name: "Zgłoś błędne dane" }),
  ).toBeVisible({ timeout: 45000 });
  await page.getByRole("button", { name: "Zgłoś błędne dane" }).click();
  await expect(
    page.getByRole("heading", { name: "Zgłoś błędne dane" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Anuluj" }).click();

  await page.waitForSelector(".chart-card-plus", { timeout: 45000 });
  await page.locator(".chart-card-plus").first().click({ force: true });
  await expect(
    page.getByRole("button", { name: "Błędne dane Zgłoś poprawkę" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Błędne dane Zgłoś poprawkę" }).click();
  await expect(
    page.getByRole("heading", { name: "Zgłoś błędne dane" }),
  ).toBeVisible();

  await ctx.close();
});
