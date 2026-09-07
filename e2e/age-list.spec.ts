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

function completedYears(birth: Date, on: Date): number {
  let years = on.getFullYear() - birth.getFullYear();
  const reached =
    on.getMonth() > birth.getMonth() ||
    (on.getMonth() === birth.getMonth() && on.getDate() >= birth.getDate());
  if (!reached) years -= 1;
  return years;
}

test("lista shows Brunon Lieske as 70, not 71, after his birthday", async ({
  browser,
}) => {
  const now = new Date();
  const expected = completedYears(new Date(1956, 7, 26), now);
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
  await expect(page.getByRole("heading", { name: "Lista potomków" })).toBeVisible({
    timeout: 20000,
  });

  const row = page
    .locator(".genealogy-item")
    .filter({ hasText: "Brunon Tadeusz Lieske" })
    .first();
  await row.scrollIntoViewIfNeeded();
  await expect(row).toContainText("Brunon Tadeusz Lieske");
  await expect(row.locator(".genealogy-age")).toHaveText(`(${expected} lat)`);
  await expect(row.locator(".genealogy-age")).not.toHaveText(
    `(${expected + 1} lat)`,
  );
  await ctx.close();
});
