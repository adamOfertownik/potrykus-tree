import { test, expect } from "@playwright/test";
import { sessionCookie } from "./session";

test("search highlights without filtering tree", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie("member")]);
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
  await input.fill("Wincenty Potrykus");
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
  await ctx.addCookies([await sessionCookie("member")]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Adam Lieske", personId: "adam-lieske-x" }),
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
