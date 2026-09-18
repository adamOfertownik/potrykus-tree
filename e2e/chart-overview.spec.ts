import { test, expect, type Page } from "@playwright/test";
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

function inViewBranchLabels(page: Page) {
  return page.getByTestId("chart-branch-label").evaluateAll((els) =>
    els
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden" || Number(style.opacity) < 0.15) {
          return false;
        }
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      })
      .map((el) => ({
        id: el.getAttribute("data-branch-id") || "",
        text: (el.textContent || "").trim(),
      })),
  );
}

test("start centers a readable card, not the whole tree", async ({
  browser,
}) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
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
  const highlight = page.locator(".card_cont.is-chart-highlight .card-label").first();
  await expect(highlight).toBeVisible({ timeout: 15_000 });
  await expect(highlight).toContainText(/Franciszek/i);
  const k = await page.evaluate(() => {
    type Z = { __zoom?: { k?: number }; parentElement?: Z | null };
    const svg = document.querySelector("#FamilyChart svg") as Z | null;
    const parent = svg?.parentElement ?? null;
    return svg?.__zoom?.k ?? parent?.__zoom?.k ?? 0;
  });
  expect(k).toBeGreaterThan(0.5);
  await expect(page.getByTestId("change-who")).toBeVisible();
  await ctx.close();
});

test("nav pad jumps to a neighboring person", async ({ browser }) => {
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
  await page.waitForSelector("#htmlSvg .card_cont.is-chart-highlight", {
    timeout: 45_000,
  });
  const before = await page
    .locator(".card_cont.is-chart-highlight .card-label")
    .first()
    .innerText();
  await page.getByTestId("chart-nav-pad-toggle").click();
  await expect(page.getByTestId("chart-nav-pad")).toBeVisible();
  await page.getByTestId("chart-nav-down").click();
  await expect
    .poll(async () =>
      page.locator(".card_cont.is-chart-highlight .card-label").first().innerText(),
    )
    .not.toBe(before);
  await page.getByTestId("chart-nav-zoom-in").click();
  await ctx.close();
});

test("zoomed-out tree shows branch headers and drilling into one", async ({
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
  await expect.poll(async () => {
    return page.evaluate(() => {
      type Z = { __zoom?: { k?: number }; parentElement?: Z | null };
      const svg = document.querySelector("#FamilyChart svg") as Z | null;
      return svg?.__zoom?.k ?? svg?.parentElement?.__zoom?.k ?? 1;
    });
  }, { timeout: 8_000 }).toBeLessThan(0.25);
  const labels = page.getByTestId("chart-branch-label");
  await expect.poll(async () => (await inViewBranchLabels(page)).length, {
    timeout: 10_000,
  }).toBeGreaterThan(1);
  const genLabel = page.locator(".chart-gen-label").first();
  await expect(genLabel).toBeVisible();
  await expect
    .poll(async () => {
      const titles = await page
        .locator(".chart-gen-label")
        .evaluateAll((els) =>
          els.map((el) => el.getAttribute("title") || el.textContent || ""),
        );
      return titles.some((t) => /Pień|Pokolenie|Przodkowie/.test(t));
    })
    .toBeTruthy();
  const clipped = await labels.evaluateAll((els) =>
    els
      .filter((el) => {
        const style = getComputedStyle(el);
        if (style.visibility === "hidden") return false;
        const name = el.querySelector(".chart-branch-label__name");
        return Boolean(name && name.scrollWidth > name.clientWidth + 2);
      })
      .map((el) => el.textContent?.trim()),
  );
  expect(clipped, "branch headers must not ellipsize names").toEqual([]);

  const inView = await inViewBranchLabels(page);
  const targetMeta =
    inView.find((row) => /Franciszek Potrykus/i.test(row.text)) ||
    inView.find((row) => /Helena/i.test(row.text)) ||
    inView[0]!;
  const before = targetMeta.text.split("\n")[0]!.trim();
  await page.locator(`[data-branch-id="${targetMeta.id}"]`).evaluate((el) =>
    (el as HTMLButtonElement).click(),
  );
  await expect(page.locator(".tree-focus-bar")).toContainText(
    before.split(" ")[0]!,
    { timeout: 8_000 },
  );
  await expect(page).toHaveURL(/[?&]root=/);
  await expect(page.locator("#family-tree-canvas")).toHaveAttribute(
    "data-tree-pan",
    "drag",
  );
  await expect
    .poll(async () => labels.filter({ visible: true }).count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(1);
  await expect(
    labels.filter({ visible: true }).filter({ hasText: before }),
  ).toHaveCount(0);
  await expect(page.getByTestId("chart-gen-label").first()).toBeVisible();
  await ctx.close();
});

test("Franciszek branch view shows next-generation headers", async ({
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
  await page.goto("/drzewo?root=P060");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  await page.getByRole("button", { name: /Całe drzewo/ }).click();
  const labels = page.getByTestId("chart-branch-label");
  await expect.poll(async () => (await inViewBranchLabels(page)).length, {
    timeout: 10_000,
  }).toBeGreaterThan(1);
  await expect(labels.filter({ hasText: /Helena/i }).first()).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[data-branch-id="P060"]')).toHaveCount(0);
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
  await expect.poll(async () => (await inViewBranchLabels(page)).length, {
    timeout: 10_000,
  }).toBeGreaterThan(0);

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

  const inView = await inViewBranchLabels(page);
  expect(inView.length).toBeGreaterThan(0);
  await page.locator(`[data-branch-id="${inView[0]!.id}"]`).evaluate((el) =>
    (el as HTMLButtonElement).click(),
  );
  await expect(page).toHaveURL(/[?&]root=/);
  await expect(page.getByTestId("chart-gen-label").first()).toBeVisible();
  await ctx.close();
});

test("Ja opens identity picker with son-of-father label", async ({
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
  await page.goto("/drzewo");
  await page.getByTestId("change-who").click();
  await expect(
    page.getByRole("heading", { name: "Kim jesteś w rodzinie?" }),
  ).toBeVisible();
  await page.locator("#who-search").fill("Franciszek Xawery");
  await expect(page.locator(".who-matches__pick").first()).toContainText(/syn /i);
  await ctx.close();
});
