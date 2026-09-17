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

test("tree cards show full two-line names without ellipsis", async ({
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
  await page.goto("/drzewo?hl=P018");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  const card = page.locator(".card_cont.is-chart-highlight .card-label").first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText("Franciszek Xawery");
  await expect(card).toContainText("Potrykus");
  const text = (await card.innerText()) ?? "";
  expect(text).not.toMatch(/…|\.\.\./);
  await ctx.close();
});
