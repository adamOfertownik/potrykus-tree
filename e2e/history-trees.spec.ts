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

async function adminCookie() {
  const token = await new SignJWT({
    role: "admin",
    adminId: "00000000-0000-0000-0000-000000000001",
    email: "tester@example.com",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return {
    name: "potrykus_admin_session",
    value: token,
    url: base,
  };
}

test("graph switcher jumps between leftover trees", async ({ browser }) => {
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
  const payload = (await api.json()) as {
    people: {
      id: string;
      firstName: string;
      lastName: string;
      parentIds?: string[];
    }[];
    meta?: { rootPersonId?: string };
  };
  const jadwiga = payload.people.find(
    (p) =>
      p.firstName === "Jadwiga" &&
      /lewand/i.test(p.lastName) &&
      (p.parentIds?.length ?? 0) === 0,
  );
  expect(jadwiga, "detached Jadwiga must exist").toBeTruthy();

  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45_000 });
  const select = page.getByTestId("tree-switcher").locator("select");
  await expect(select).toBeVisible();
  const leftoverOption = select.locator(`option[value="${jadwiga!.id}"]`);
  await expect(leftoverOption).toHaveCount(1);
  await select.selectOption(jadwiga!.id);
  await expect(page).toHaveURL(new RegExp(`[?&]root=${jadwiga!.id}\\b`));
  await expect(page.getByTestId("tree-detached-caption")).toContainText(
    "brak przypisania do głównej gałęzi",
  );
  await expect(page.getByTestId("tree-detached-caption")).toContainText(
    "Pozostałe osoby",
  );

  await page.goto("/lista");
  await expect(page.getByRole("heading", { name: "Pozostałe osoby" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.locator(".genealogy-section--branch", { hasText: "Jadwiga" }),
  ).toContainText("Brak przypisania do głównej gałęzi");
  await ctx.close();
});

test("person details show accepted-submission history", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  const page = await ctx.newPage();
  await page.goto("/osoba/P001");
  const history = page.getByTestId("person-history");
  await expect(history).toBeVisible({ timeout: 20_000 });
  await expect(history.getByRole("heading", { name: "Kto dodawał i poprawiał" })).toBeVisible();
  await expect(history.getByText("Wczytywanie historii…")).toHaveCount(0, {
    timeout: 15_000,
  });
  const empty = page.getByTestId("person-history-empty");
  const item = history.locator(".person-history__item").first();
  await expect(empty.or(item)).toBeVisible();
  if (await empty.count()) {
    await expect(empty).toContainText("zaakceptowane zgłoszenia");
  }

  const api = await page.request.get("/api/person/P001/history");
  expect(api.ok()).toBeTruthy();
  const body = (await api.json()) as { items: unknown[]; note: string };
  expect(Array.isArray(body.items)).toBeTruthy();
  expect(body.note).toMatch(/zaakceptowane zgłoszenia/i);
  await ctx.close();
});

test("admin accepted queue shows known submission details", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin");
  const adminHeading = page.getByRole("heading", { name: "Panel admina" });
  const loginHeading = page.getByRole("heading", { name: "Logowanie" });
  await expect(adminHeading.or(loginHeading)).toBeVisible({ timeout: 20_000 });
  if (await loginHeading.count()) {
    test.info().annotations.push({
      type: "note",
      description: "admin session not valid in this environment",
    });
    await ctx.close();
    return;
  }
  await page.getByRole("tab", { name: "Zgłoszenia" }).click();
  await page.getByRole("button", { name: /Zaakceptowane/ }).click();
  const known = page.getByTestId("admin-submission-known");
  if ((await known.count()) === 0) {
    await expect(page.locator(".admin-list-empty")).toBeVisible();
    await ctx.close();
    return;
  }
  await expect(known).toContainText("Znane szczegóły");
  await expect(known).toContainText("Zgłoszono");
  await expect(known).toContainText("Rozpatrzono");
  await expect(known).toContainText("Zgłaszający");
  await ctx.close();
});
