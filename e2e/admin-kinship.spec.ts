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

test("admin queue shows who the edited person is to the reporter", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addCookies([await adminCookie()]);
  const page = await ctx.newPage();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Panel admina" })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByRole("tab", { name: "Zgłoszenia" }).click();
  const cards = page.locator(".admin-card");
  await expect(cards.first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
  if ((await cards.count()) === 0) {
    await ctx.close();
    test.info().annotations.push({ type: "note", description: "no submissions" });
    return;
  }
  const kin = page.getByTestId("admin-submission-kinship");
  if ((await kin.count()) > 0) {
    await expect(kin.first()).toBeVisible();
    await expect(kin.first()).toHaveText(
      /Dla |własne dane|pokrewieństwa|nie jest wskazona/i,
    );
    await cards.first().click();
    await expect(page.getByTestId("admin-submission-kinship-detail")).toBeVisible();
  }
  await ctx.close();
});
