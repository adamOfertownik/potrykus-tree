import { test, expect } from "@playwright/test";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const cfg = JSON.parse(
  readFileSync(path.join(root, "data/config.json"), "utf8"),
);
const base = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3333";

async function adminCookie() {
  const token = await new SignJWT({
    role: "admin",
    adminId: "00000000-0000-0000-0000-000000000001",
  email: "tester@example.com",
    adminRole: "admin",
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

test("users API rejects guests", async ({ request }) => {
  const res = await request.get("/api/admin/users");
  expect(res.status()).toBe(401);
  const data = await res.json();
  expect(JSON.stringify(data)).not.toMatch(/password_hash|passwordHash/);
});

test("admin page keeps uzytkownicy tab after login redirect", async ({
  page,
}) => {
  await page.goto("/admin?tab=uzytkownicy");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(decodeURIComponent(page.url())).toContain("tab=uzytkownicy");
});

test("Użytkownicy tab shows create form and no forgot-password", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin?tab=uzytkownicy");
  await expect(page.getByRole("heading", { name: "Panel admina" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole("tab", { name: "Użytkownicy" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Nowe konto" })).toBeVisible();
  await expect(page.getByText(/Hasło zapisujemy jako skrót/)).toBeVisible();
  await expect(page.getByText(/Przekaż dane osobiście/)).toBeVisible();
  await expect(page.getByText("Tylko wpłaty (ciocia)")).toBeVisible();
  await expect(page.getByLabel("E-mail")).toBeVisible();
  await expect(page.getByLabel("Hasło", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Powtórz hasło")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Dodaj administratora" }),
  ).toBeVisible();
  await expect(page.getByText("Przypomnij hasło")).toHaveCount(0);

  const create = await page.request.post("/api/admin/users", {
    data: { email: "ciocia@poczta.pl", password: "krotkie" },
  });
  expect(create.status()).toBe(400);
  const body = await create.json();
  expect(JSON.stringify(body)).not.toMatch(/password_hash|passwordHash/);
  expect(body.error).toMatch(/8 znaków/);

  const reserved = await page.request.post("/api/admin/users", {
    data: {
      email: "crud.verify@potrykus.invalid",
      password: "haslotestowe",
    },
  });
  expect(reserved.status()).toBe(400);
  const reservedBody = await reserved.json();
  expect(JSON.stringify(reservedBody)).not.toMatch(/password_hash|passwordHash/);
  expect(reservedBody.error).toMatch(/zarezerwowany na testy/);

  await page.getByRole("tab", { name: "Zgłoszenia" }).click();
  await expect(page.getByRole("tab", { name: "Zgłoszenia" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Płatności" }).click();
  await expect(page.getByRole("heading", { name: "Wpłaty na spotkanie" })).toBeVisible({
    timeout: 10_000,
  });
  await ctx.close();
});
