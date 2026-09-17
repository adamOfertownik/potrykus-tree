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

test("zoomed-out tree shows branch headers and zooming into one", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
    localStorage.setItem("potrykus_pwa_hint_v1", "1");
  });
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  await page.getByRole("button", { name: /Całe drzewo/ }).click();
  await page.waitForTimeout(700);
  const labels = page.getByTestId("chart-branch-label");
  await expect(labels.first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => labels.count()).toBeGreaterThan(1);
  await expect(page.locator(".chart-gen-label").first()).toBeVisible();

  const visible = labels.filter({ visible: true });
  const helena = visible.filter({ hasText: /Helena/i });
  const target = (await helena.count()) ? helena.first() : visible.first();
  const before = ((await target.innerText()) ?? "").split("\n")[0]!.trim();
  await target.click({ force: true });
  await expect(page.locator(".tree-focus-bar")).toContainText(
    before.split(" ")[0]!,
    { timeout: 8_000 },
  );
  await ctx.close();
});
