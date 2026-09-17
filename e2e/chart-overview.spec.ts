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
  await expect(page.locator("#family-tree-canvas")).toHaveAttribute(
    "data-tree-fit",
    "contain",
  );
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
  await expect(page.locator("#family-tree-canvas")).toHaveAttribute(
    "data-tree-pan",
    "drag",
  );
  await ctx.close();
});

test("phone portrait width-fits and keeps one-finger taps off the map", async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
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

  await expect(page.locator("#family-tree-canvas")).toHaveAttribute(
    "data-tree-fit",
    "width",
  );
  await expect(page.locator("#family-tree-canvas")).toHaveAttribute(
    "data-tree-pan",
    "two-finger",
  );
  await expect(page.locator(".family-chart-hint__touch")).toBeVisible();
  await expect(page.getByTestId("chart-gesture-gutter")).toBeVisible();
  await expect(page.getByTestId("chart-branch-label").first()).toBeVisible({
    timeout: 10_000,
  });

  const zoomOf = () =>
    page.evaluate(() => {
      type Z = { __zoom?: { k: number; x: number; y: number } };
      const svg = document.querySelector("#FamilyChart svg") as Z | null;
      const parent = svg && "parentElement" in svg
        ? (svg as unknown as { parentElement: Z | null }).parentElement
        : null;
      const z = svg?.__zoom ?? parent?.__zoom;
      return { k: z?.k ?? 0, x: z?.x ?? 0, y: z?.y ?? 0 };
    });

  const before = await zoomOf();
  const box = await page.locator(".family-chart-host").boundingBox();
  expect(box).toBeTruthy();
  const x = box!.x + box!.width * 0.5;
  const y = box!.y + box!.height * 0.55;
  const session = await ctx.newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: x + 90, y: y + 40 }],
  });
  await session.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(200);
  const after = await zoomOf();
  expect(Math.abs(after.x - before.x)).toBeLessThan(12);
  expect(Math.abs(after.y - before.y)).toBeLessThan(12);
  expect(Math.abs(after.k - before.k)).toBeLessThan(0.01);
  await ctx.close();
});
