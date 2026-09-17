import { test, expect, type Browser } from "@playwright/test";
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

async function familyPage(browser: Browser) {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
    localStorage.setItem("potrykus_pwa_hint_v1", "1");
  });
  return { ctx, page: await ctx.newPage() };
}

test("statystyki show Franciszek branches and insights", async ({ browser }) => {
  const { ctx, page } = await familyPage(browser);
  await page.goto("/statystyki");
  await expect(page.getByTestId("family-stats")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Statystyki rodzin" })).toBeVisible();
  await expect(page.getByTestId("meeting-family-groups")).toBeVisible();
  await expect(
    page.getByTestId("meeting-branch-count").filter({ hasText: /Heleny/ }),
  ).toBeVisible();
  await expect(
    page.getByTestId("meeting-branch-count").filter({ hasText: /Władka/ }),
  ).toContainText("/");
  await expect(page.getByText(/Imiona, które wracają/)).toBeVisible();
  const button = page.getByTestId("spotkanie-od-franciszka");
  await expect(button).toHaveAttribute("href", "/drzewo?root=P060");
  await button.click();
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  await expect(page.locator(".tree-focus-bar")).toContainText(/Franciszek/i);
  const bar = page.getByTestId("meeting-branch-bar");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-who-visible", "true");
  for (const name of [
    "Helena",
    "Władek",
    "Rozalia",
    "Jan",
    "Franciszek",
    "Bronisław",
    "Antoni",
    "Stanisław",
    "Józef",
    "Walerian",
  ]) {
    await expect(bar.locator(".meeting-branch-chips li").filter({ hasText: name })).toHaveCount(1);
  }
  await page.getByTestId("meeting-who-toggle").click();
  await expect(bar).toHaveAttribute("data-who-visible", "false");
  await expect(bar).toContainText("Kto będzie na spotkaniu");
  await expect(bar.locator(".meeting-branch-chips")).toHaveCount(0);
  await page.reload();
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  await expect(page.getByTestId("meeting-branch-bar")).toHaveAttribute(
    "data-who-visible",
    "false",
  );
  await page.getByTestId("meeting-who-toggle").click();
  await expect(page.getByTestId("meeting-branch-bar")).toHaveAttribute(
    "data-who-visible",
    "true",
  );
  await expect(page.getByTestId("meeting-branch-bar")).toContainText(
    /Na spotkaniu/,
  );
  await ctx.close();
});

test("spotkanie lists signup branches at the bottom only", async ({
  browser,
}) => {
  const { ctx, page } = await familyPage(browser);
  await page.goto("/spotkanie");
  await expect(page.getByTestId("meeting-from-franciszek")).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("heading", { name: "Zapisy od kogo" })).toBeVisible();
  await expect(page.getByTestId("meeting-family-groups")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Gałęzie od dzieci Franciszka" })).toHaveCount(0);
  await expect(page.getByText("Kto będzie — od kogo")).toBeVisible();
  const whoToggle = page.getByTestId("meeting-who-toggle");
  await expect(whoToggle).toHaveAttribute("aria-expanded", "true");
  await whoToggle.click();
  await expect(page.getByTestId("meeting-who-block")).toHaveAttribute(
    "data-who-visible",
    "false",
  );
  await expect(page.getByText("Lista imion jest ukryta")).toBeVisible();
  await page.getByTestId("meeting-who-toggle").click();
  await expect(page.getByTestId("meeting-who-block")).toHaveAttribute(
    "data-who-visible",
    "true",
  );
  const signup = page.getByTestId("meeting-from-franciszek");
  const list = page.getByRole("heading", { name: /Lista zapisanych/ });
  await expect(list).toBeVisible();
  const signupBox = await signup.boundingBox();
  const listBox = await list.boundingBox();
  expect(signupBox && listBox && signupBox.y > listBox.y).toBeTruthy();
  if ((await page.locator(".rsvp-list").count()) > 0) {
    await expect(page.locator(".rsvp-list")).not.toContainText("zł");
  }
  await ctx.close();
});
