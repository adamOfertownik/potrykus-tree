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

test("lista shows every person from the family API", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  const api = await page.request.get("/api/family");
  expect(api.ok()).toBeTruthy();
  const payload = (await api.json()) as { people: { id: string }[] };
  const apiIds = [...new Set(payload.people.map((p) => p.id))].sort();
  await page.goto("/lista");
  await page.waitForSelector("[data-person-id]", { timeout: 45000 });
  const listedIds = await page
    .locator("[data-person-id]")
    .evaluateAll((els) => [
      ...new Set(
        els
          .map((el) => el.getAttribute("data-person-id"))
          .filter((id): id is string => Boolean(id)),
      ),
    ]);
  listedIds.sort();
  expect(listedIds).toEqual(apiIds);
  await ctx.close();
});

test("tree is fullscreen with navbar links and wind overlay", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.locator(".app-shell--immersive")).toBeVisible();
  await expect(page.locator(".app-header .app-nav a", { hasText: "Lista" })).toBeVisible();
  await expect(page.locator(".app-footer")).toHaveCount(0);
  await expect(page.locator(".tree-wind")).toHaveCount(1);
  await expect(page.locator(".toolbar--tree")).toHaveCount(0);
  await ctx.close();
});

test("returning to full tree keeps the highlighted person", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/drzewo?root=P016");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByTestId("full-tree-back")).toBeVisible();
  await page.getByTestId("full-tree-back").click();
  await expect(page.locator(".tree-focus-bar")).toContainText("Anna");
  await expect(page.locator(".tree-focus-bar")).not.toContainText("Widok wokół");
  await expect(page.locator(".is-chart-highlight").first()).toBeVisible({
    timeout: 10_000,
  });
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

test("add-child form includes death date", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/lista");
  await page.waitForSelector(".genealogy-add", { timeout: 45000 });
  await page.locator(".genealogy-add").first().click();
  await page.getByRole("button", { name: "Dziecko" }).click();
  await page.getByRole("tab", { name: "Nowa osoba" }).click();
  await expect(page.getByText("Data zgonu (opcjonalnie)")).toBeVisible();
  await ctx.close();
});
