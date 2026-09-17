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

test("P040 child card opens daughter and hops to next sibling", async ({
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
  await page.goto("/osoba/P040");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Matylda", {
    timeout: 20_000,
  });

  const daughter = page.locator("a.person-card", { hasText: "Cecylia" });
  await daughter.scrollIntoViewIfNeeded();
  const box = await daughter.boundingBox();
  expect(box, "daughter card visible").toBeTruthy();
  await daughter.click({ position: { x: Math.round(box!.width / 2), y: 22 } });

  await expect(page).toHaveURL(/\/osoba\/P042/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cecylia");
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
    .toBeLessThan(80);

  const hop = page.locator(".person-hop");
  await expect(hop).toContainText(/Rodzeństwo/);
  const next = hop.locator(".person-hop__btn--next");
  await expect(next).toBeVisible();
  const nextName = ((await next.innerText()) ?? "").replace("→", "").trim();
  expect(nextName.length).toBeGreaterThan(2);
  await next.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    nextName.split(/\s+/)[0]!,
  );
  await expect
    .poll(async () => page.evaluate(() => window.scrollY), { timeout: 5_000 })
    .toBeLessThan(80);
  await ctx.close();
});
