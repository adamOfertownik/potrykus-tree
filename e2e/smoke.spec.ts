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
