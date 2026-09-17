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

test("search highlights without filtering tree", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  const before = await page.locator("#htmlSvg .card_cont").count();
  const input = page.locator(".person-search input").first();
  await input.fill("Tola Lieske");
  await page.waitForTimeout(500);
  await page.locator(".person-search__item").first().click();
  await page.waitForTimeout(1000);
  const after = await page.locator("#htmlSvg .card_cont").count();
  expect(after).toBe(before);
  expect(await page.locator(".is-chart-highlight").count()).toBeGreaterThan(0);
  await ctx.close();
});

test("search finds a person typed last name first", async ({ browser }) => {
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
    people: { firstName: string; lastName: string }[];
  };
  const marcin = payload.people.find(
    (p) => p.firstName === "Marcin" && p.lastName === "Kostrach",
  );
  expect(marcin, "Marcin Kostrach must exist").toBeTruthy();

  for (const path of ["/drzewo", "/lista"] as const) {
    await page.goto(path);
    if (path === "/drzewo") {
      await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
    } else {
      await page.waitForSelector("[data-person-id]", { timeout: 45000 });
    }
    const input = page.locator(".person-search input").first();
    await input.fill("kostrach marcin");
    await expect(
      page.locator(".person-search__item").filter({ hasText: /Marcin/i }).first(),
    ).toBeVisible({ timeout: 10_000 });
    await input.fill("");
  }
  await ctx.close();
});

test("lista shows every person from the family API", async ({ browser }) => {
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
  const payload = (await api.json()) as { people: { id: string }[] };
  const apiIds = [...new Set(payload.people.map((p) => p.id))].sort();
  await page.goto("/lista");
  await page.waitForSelector("[data-person-id]", { timeout: 45000 });
  const listedIds = await page
    .locator("[data-person-id]")
    .evaluateAll((els) => [
      ...new Set(
        els
          .map((el) => el.getAttribute("data-person-id"))
          .filter((id): id is string => Boolean(id)),
      ),
    ]);
  listedIds.sort();
  expect(listedIds).toEqual(apiIds);
  const firstName = (await page
    .locator(".genealogy-item.is-person .genealogy-name")
    .first()
    .textContent()) ?? "";
  expect(firstName.toLowerCase()).not.toContain("bodzińska");
  expect(firstName.toLowerCase()).not.toContain("borudzki");
  const firstGen = await page
    .locator(".genealogy-item.is-person .genealogy-gen")
    .first()
    .textContent();
  expect(firstGen?.trim()).toBe("1.");
  await ctx.close();
});

test("tree is fullscreen with navbar links and wind overlay", async ({
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
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.locator(".app-shell--immersive")).toBeVisible();
  await expect(page.locator(".app-header .app-nav a", { hasText: "Lista" })).toBeVisible();
  await expect(page.locator(".app-footer")).toHaveCount(0);
  await expect(page.locator(".tree-wind")).toHaveCount(1);
  await expect(page.locator(".toolbar--tree")).toHaveCount(0);
  await ctx.close();
});

test("default tree shows Ludwik without focusing his father", async ({
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
  const api = await page.request.get("/api/family");
  expect(api.ok()).toBeTruthy();
  const payload = (await api.json()) as {
    people: { id: string; firstName: string; lastName: string }[];
  };
  const ludwik = payload.people.find(
    (p) => p.firstName === "Ludwik" && p.lastName === "Potrykus",
  );
  expect(ludwik, "Ludwik Potrykus must exist in family payload").toBeTruthy();

  await page.goto("/drzewo");
  await expect(page).toHaveURL(/\/drzewo$/);
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByTestId("full-tree-back")).toHaveCount(0);
  await expect(
    page.locator("#htmlSvg .card_cont").filter({ hasText: "Ludwik" }).first(),
  ).toBeVisible({ timeout: 15_000 });
  await ctx.close();
});

test("plus opens tree actions on the first tap", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Tester" }),
    );
  });
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  const plus = page.getByTestId("chart-card-plus").first();
  await expect(plus).toBeVisible({ timeout: 15_000 });
  await plus.click({ force: true });
  await expect(page.getByText("Buduj drzewo")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dziecko" })).toBeVisible();
  await ctx.close();
});

test("returning to full tree keeps the highlighted person", async ({
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
  await page.goto("/drzewo?root=P016");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByTestId("full-tree-back")).toBeVisible();
  await page.getByTestId("full-tree-back").click();
  await expect(page.locator(".tree-focus-bar")).toContainText("Anna");
  await expect(page.locator(".tree-focus-bar")).not.toContainText("Widok wokół");
  await expect(page.locator(".is-chart-highlight").first()).toBeVisible({
    timeout: 10_000,
  });
  await ctx.close();
});

test("kinship tree from B highlights the person on the full tree", async ({
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
  await page.setViewportSize({ width: 1280, height: 800 });
  const api = await page.request.get("/api/family");
  expect(api.ok()).toBeTruthy();
  const payload = (await api.json()) as {
    people: { id: string; firstName: string; lastName: string }[];
  };
  const adam = payload.people.find(
    (p) => p.firstName === "Adam" && p.lastName === "Lieske",
  );
  const wincenty = payload.people.find(
    (p) =>
      p.lastName === "Potrykus" &&
      (p.firstName.includes("Wincenty") ||
        p.firstName.includes("Vincentius")),
  );
  expect(adam, "Adam Lieske must exist").toBeTruthy();
  expect(wincenty, "Wincenty Potrykus must exist").toBeTruthy();

  await page.goto(
    `/pokrewienstwo?a=${encodeURIComponent(adam!.id)}&b=${encodeURIComponent(wincenty!.id)}`,
  );
  await expect(page.getByRole("heading", { name: "Kto jest kim" })).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Drzewo od B" }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]hl=${wincenty!.id}\\b`));
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByTestId("full-tree-back")).toHaveCount(0);
  await expect(page.locator(".tree-focus-bar")).toContainText(/Wincenty|Vincentius/);
  await expect(page.locator(".is-chart-highlight").first()).toBeVisible({
    timeout: 15_000,
  });
  const cardBox = await page.locator(".is-chart-highlight").first().boundingBox();
  expect(cardBox, "highlighted card should be on screen").toBeTruthy();
  expect(cardBox!.width).toBeGreaterThan(40);
  expect(cardBox!.height).toBeGreaterThan(20);
  await ctx.close();
});

test("kinship and birthdays pages load", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie()]);
  await ctx.addInitScript(() => {
    localStorage.setItem(
      "potrykus_reporter_v1",
      JSON.stringify({ name: "Adam Lieske", personId: "adam-lieske" }),
    );
  });
  const page = await ctx.newPage();
  await page.goto("/pokrewienstwo");
  await expect(page.getByRole("heading", { name: "Kto jest kim" })).toBeVisible({
    timeout: 20000,
  });
  await page.goto("/urodziny");
  await expect(page.getByRole("heading", { name: /Urodziny/ })).toBeVisible({
    timeout: 20000,
  });
  await ctx.close();
});

test("add-child form includes death date", async ({ browser }) => {
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
  await page.waitForSelector(".genealogy-add", { timeout: 45000 });
  await page.locator(".genealogy-add").first().click();
  await page.getByRole("button", { name: "Dziecko" }).click();
  await page.getByRole("tab", { name: "Nowa osoba" }).click();
  await expect(page.getByText("Data zgonu (opcjonalnie)")).toBeVisible();
  await ctx.close();
});

test("spotkanie shows live signup count, price 240 and photo drop", async ({
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
  await page.goto("/spotkanie");
  await expect(
    page.getByRole("heading", { name: /Spotkanie rodziny/ }),
  ).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByText(/240\s*zł/).first()).toBeVisible();
  await expect(page.getByText(/120\s*zł/).first()).toBeVisible();
  await expect(page.getByText(/\/ 200 miejsc/)).toBeVisible();
  await expect(page.getByText("CA Elżbieta Lieder")).toBeVisible();
  await expect(page.getByText(/65 1940 1076 4614 2125 0001 0000/)).toBeVisible();
  await expect(page.getByText(/IMPREZA RODZINNA/).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Zdjęcia rodziców" }),
  ).toBeVisible();
  await expect(page.getByText("maciej.lieder@gmail.com")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Wstaw zdjęcia tutaj" }),
  ).toHaveAttribute("href", /drive\.google\.com/);
  await expect(page.getByText("Od 14:00 możliwe zakwaterowanie.")).toBeVisible();
  await expect(page.getByText("Serwis szynki pieczonej")).toBeVisible();

  const payerSearch = page.locator("#zapisz input").first();
  await payerSearch.fill("Adam Lieske");
  await page.getByRole("button", { name: /Adam Lieske/ }).first().click();
  await expect(page.getByText(/Płatnik:\s*Adam Lieske/)).toBeVisible();
  await expect(
    page.getByText(/Za kogo jeszcze płacisz\? Rodzina/),
  ).toBeVisible();
  await expect(page.getByText(/IMPREZA RODZINNA, dorosłych-/)).toBeVisible();
  await expect(page.getByText("Jak zapłacisz?")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Przelewem" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Gotówką na miejscu" })).toBeVisible();
  await ctx.close();
});

test("draft child and grandchild stay gray until a batch is sent", async ({
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
  const stamp = Date.now();
  const childName = `RoboczeDziecko${stamp}`;
  const grandName = `RoboczyWnuk${stamp}`;

  await page.goto("/lista");
  await page.waitForSelector(".genealogy-add", { timeout: 45000 });
  await page.locator(".genealogy-add").first().click();
  await page.getByRole("button", { name: "Dziecko" }).click();
  await page.getByRole("tab", { name: "Nowa osoba" }).click();
  await page.getByLabel("Imię *").fill(childName);
  await page.getByLabel("Nazwisko *").fill("Testowy");
  await page.getByRole("button", { name: "Dalej — potwierdzenie" }).click();
  await page.getByRole("button", { name: "Dodaj roboczo" }).click();

  await expect(page.getByTestId("draft-graph-bar")).toBeVisible();
  const childRow = page.locator(".genealogy-item.is-pending", {
    hasText: childName,
  });
  await expect(childRow).toBeVisible();
  await expect(childRow.locator(".pending-pill")).toHaveText("roboczo");

  await childRow.locator(".genealogy-add").click();
  await page.getByRole("button", { name: "Dziecko" }).click();
  await page.getByRole("tab", { name: "Nowa osoba" }).click();
  await page.getByLabel("Imię *").fill(grandName);
  await page.getByLabel("Nazwisko *").fill("Testowy");
  await page.getByRole("button", { name: "Dalej — potwierdzenie" }).click();
  await page.getByRole("button", { name: "Dodaj roboczo" }).click();

  await expect(
    page.locator(".genealogy-item.is-pending", { hasText: grandName }),
  ).toBeVisible();
  await expect(page.getByTestId("draft-graph-bar")).toContainText("2 robocze");

  await page.getByRole("button", { name: "Wyślij całość" }).click();
  await expect(page.getByTestId("draft-graph-bar")).toHaveCount(0);
  await expect(page.locator(".genealogy-item.is-pending")).toHaveCount(0);
  await ctx.close();
});

test("attendees get orange border on list when family API marks them", async ({
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
  const api = await page.request.get("/api/family");
  expect(api.ok()).toBeTruthy();
  const payload = (await api.json()) as { attendingPersonIds?: string[] };
  const attending = payload.attendingPersonIds ?? [];
  if (attending.length === 0) {
    await ctx.close();
    return;
  }
  await page.goto("/lista");
  await expect(page.locator(".genealogy-item.is-attending").first()).toBeVisible({
    timeout: 20000,
  });
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.locator(".card_cont.is-attending").first()).toBeVisible({
    timeout: 15000,
  });
  await ctx.close();
});
