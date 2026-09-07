import { test, expect } from "@playwright/test";
import { sessionCookie } from "./session";

test("login page asks for email and password, not a family code", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Hasło", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Kod rodzinny")).toHaveCount(0);
});

test("tree is gated behind login", async ({ page }) => {
  await page.goto("/drzewo");
  await expect(page.getByRole("heading", { name: "Logowanie" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("E-mail")).toBeVisible();
});

test("register page asks for invite key", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: "Rejestracja" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Klucz zaproszenia")).toBeVisible();
  await expect(page.getByRole("link", { name: /Zaloguj/ })).toBeVisible();
});

test("register with invite query hides the key field", async ({ page }) => {
  await page.goto("/register?k=testowyklucz");
  await expect(page.getByRole("heading", { name: "Rejestracja" })).toBeVisible({
    timeout: 20000,
  });
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Klucz zaproszenia")).toHaveCount(0);
  await expect(page.getByText(/Masz zaproszenie na konto rodzinne/)).toBeVisible();
});

test("login page can open the tree without an account", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Hasło rodzinne")).toBeVisible({
    timeout: 20000,
  });
  await expect(
    page.getByRole("button", { name: "Pokaż drzewo bez konta" }),
  ).toBeVisible();
});

test("view page asks for a family password", async ({ page }) => {
  await page.goto("/wejscie");
  await expect(
    page.getByRole("heading", { name: "Wejście do drzewa" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel("Hasło do drzewa")).toBeVisible();
});

test("register with admin invite query shows admin copy", async ({ page }) => {
  await page.goto("/register?k=testowyklucz&rola=admin");
  await expect(
    page.getByRole("heading", { name: "Konto administratora" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.getByLabel("Klucz zaproszenia")).toHaveCount(0);
});

test("guest session opens the tree", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie("guest")]);
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByText("Gość")).toBeVisible();
  await ctx.close();
});

test("member session opens the tree", async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await sessionCookie("member")]);
  const page = await ctx.newPage();
  await page.goto("/drzewo");
  await page.waitForSelector("#htmlSvg .card_cont", { timeout: 45000 });
  await expect(page.getByText("Kod rodzinny")).toHaveCount(0);
  await ctx.close();
});
