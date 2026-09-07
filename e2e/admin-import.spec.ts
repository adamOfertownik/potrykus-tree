import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);
const miniMd = readFileSync(
  path.join(root, "e2e/fixtures/mini-tree.md"),
  "utf8",
);
const snapshotMd = readFileSync(
  path.join(root, "data/snapshots/drzewo-potrykus.md"),
  "utf8",
);

const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333";

async function familyCookie() {
  const token = await new SignJWT({ role: "family" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return { name: cfg.cookieName, value: token, url: base };
}

async function adminCookie() {
  const token = await new SignJWT({
    role: "admin",
    adminId: "00000000-0000-4000-8000-000000000001",
    email: "admin@test.local",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1d")
    .sign(new TextEncoder().encode(cfg.sessionSecret));
  return { name: "potrykus_admin_session", value: token, url: base };
}

test.describe.configure({ mode: "serial" });

test("admin preview of ID-based markdown snapshot", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Konsola administracyjna" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("heading", { name: "Snapshot Markdown" }),
  ).toBeVisible();

  const preview = await page.request.post("/api/admin/import-md", {
    data: { markdown: snapshotMd, apply: false, preserveExtras: true },
  });
  expect(preview.ok()).toBeTruthy();
  const body = await preview.json();
  expect(body.applied).toBe(false);
  expect(body.summary.personCount).toBeGreaterThan(400);
  expect(body.summary.errorCount).toBe(0);
  expect(body.summary.rootPersonId).toBe("p015");

  const mini = await page.request.post("/api/admin/import-md", {
    data: { markdown: miniMd, apply: false },
  });
  const miniBody = await mini.json();
  expect(mini.ok()).toBeTruthy();
  expect(miniBody.summary.personCount).toBe(3);
  expect(miniBody.summary.errorCount).toBe(0);

  await expect(page.getByLabel("Plik .md")).toBeVisible();
  await ctx.close();
});

test("classic member can submit a correction from /zglos", async ({
  browser,
}) => {
  const marker = `E2E-poprawka-${Date.now()}`;
  const ctx = await browser.newContext();
  await ctx.addCookies([await familyCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Maria Lieske" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/zglos");
  await expect(page.getByRole("heading", { name: "Zgłoś zmianę" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByLabel(/Kto zgłasza/).fill("Maria Lieske");
  await page.getByLabel(/Kogo dotyczy/).fill("Franciszek Potrykus");
  await page.getByRole("button", { name: /Franciszek Potrykus/ }).first().click();
  await page.getByLabel(/Opis zmiany/).fill(marker);
  await page.getByRole("button", { name: "Wyślij zgłoszenie" }).click();
  await expect(page.getByRole("status")).toContainText(/Zapisano/i, {
    timeout: 15000,
  });

  const adminCtx = await browser.newContext();
  await adminCtx.addCookies([await adminCookie()]);
  const adminPage = await adminCtx.newPage();
  await adminPage.goto("/admin");
  await expect(adminPage.getByText(marker)).toBeVisible({ timeout: 20000 });
  await expect(adminPage.getByText("correction").first()).toBeVisible();
  await adminPage.getByRole("button", { name: "Akceptuj" }).first().click();
  await expect(adminPage.getByText("accepted").first()).toBeVisible();
  await ctx.close();
  await adminCtx.close();
});

test("classic member can report a missing person from search", async ({
  browser,
}) => {
  const marker = `E2E-brak-${Date.now()}`;
  const ctx = await browser.newContext();
  await ctx.addCookies([await familyCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Jan Kowalski" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector(".person-search input", { timeout: 20000 });
  const input = page.locator(".person-search input").first();
  await input.fill(marker);
  await expect(
    page.getByRole("button", { name: "Podaj dane — dopasujemy" }),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Podaj dane — dopasujemy" }).click();
  await expect(
    page.getByRole("heading", { name: "Nie ma Cię w drzewie?" }),
  ).toBeVisible();
  await page.getByLabel("Imię *").fill("Janina");
  await page.getByLabel("Nazwisko *").fill("Kowalska");
  await page.getByLabel("Płeć").selectOption("female");
  await page.getByRole("button", { name: /Wyślij/ }).click();
  await expect(page.getByText(/Zapisaliśmy zgłoszenie/)).toBeVisible({
    timeout: 15000,
  });

  const adminCtx = await browser.newContext();
  await adminCtx.addCookies([await adminCookie()]);
  const list = await adminCtx.request.get("/api/admin/submissions");
  expect(list.ok()).toBeTruthy();
  const data = await list.json();
  const found = (data.submissions as { kind: string; self?: { firstName: string } }[])
    .find((s) => s.kind === "missing_person" && s.self?.firstName === "Janina");
  expect(found).toBeTruthy();
  await ctx.close();
  await adminCtx.close();
});
