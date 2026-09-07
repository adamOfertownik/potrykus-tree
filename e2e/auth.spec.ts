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
  await expect(page.getByLabel("Hasło")).toBeVisible();
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
  await expect(page.getByText(/Masz zaproszenie rodzinne/)).toBeVisible();
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
