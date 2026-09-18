import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333";

async function sessionCookie() {
  const token = await new SignJWT({ role: "family" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return {
    name: cfg.cookieName,
    value: token,
    url: base,
  };
}

test("this-month birthday keeps this year's age after the date", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
    localStorage.setItem("potrykus_pwa_hint_v1", "1");
  });
  const page = await ctx.newPage();
  await page.goto("/urodziny");
  await expect(page.getByRole("heading", { name: /Urodziny i rocznice/ })).toBeVisible({
    timeout: 20_000,
  });

  const now = new Date();
  if (now.getMonth() === 8) {
    const maria = page.locator(".birthdays-list li", {
      hasText: "Maria Lieske",
    }).filter({ hasText: "urodziny" });
    await expect(maria.first()).toBeVisible();
    await expect(maria.first()).toContainText("67");
    await expect(maria.first()).not.toContainText("68");
    if (now.getDate() > 8) {
      await expect(maria.first()).toContainText("były 67. urodziny");
    }
  }

  await ctx.close();
});

test("person form has wedding date and calendar pickers", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
    localStorage.setItem("potrykus_pwa_hint_v1", "1");
  });
  const page = await ctx.newPage();
  await page.goto("/osoba/P019");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Anna Elżbieta",
    { timeout: 20_000 },
  );
  await expect(page.getByText(/Ślub/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Śluby" })).toBeVisible();
  await expect(page.getByText("Data ślubu").first()).toBeVisible();
  await expect(page.locator("#person-edit .date-field__picker")).toHaveCount(3);
  await ctx.close();
});
