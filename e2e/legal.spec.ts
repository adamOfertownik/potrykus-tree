import { test, expect } from "@playwright/test";

test("regulamin and privacy are public and mention private family use", async ({
  page,
}) => {
  await page.goto("/regulamin");
  await expect(
    page.getByRole("heading", { name: "Regulamin" }),
  ).toBeVisible();
  await expect(page.getByText(/Rodu Potrykus/).first()).toBeVisible();
  await expect(page.getByText(/papierów rodzinnych/).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pobieranie drzewa i listy" }),
  ).toBeVisible();
  await expect(page.getByText(/najbliższej rodziny/).first()).toBeVisible();
  await expect(page.getByText(/nie odpowiadają/i)).toBeVisible();
  await expect(
    page.getByText(/e-mail na potwierdzenie/i),
  ).toBeVisible();

  await page.goto("/polityka-prywatnosci");
  await expect(
    page.getByRole("heading", { name: "Polityka prywatności" }),
  ).toBeVisible();
  await expect(page.getByText(/prywatne archiwum/i).first()).toBeVisible();
  await expect(page.getByText(/nie sprzedajemy/i)).toBeVisible();
  await expect(page.getByText(/najbliższej rodziny/).first()).toBeVisible();
  await expect(
    page.getByText(/opcjonalny e-mail przy wysyłce/i),
  ).toBeVisible();
});

test("gate requires legal acceptance before enter", async ({ page }) => {
  await page.goto("/");
  const enter = page.getByRole("button", { name: "Wejdź do drzewa" });
  await expect(enter).toBeVisible({ timeout: 20_000 });
  await expect(enter).toBeDisabled();
  await page.locator(".gate-footer a[href='/regulamin']").click();
  await expect(page).toHaveURL(/\/regulamin/);
  await page.goto("/");
  await page.getByLabel(/Akceptuję/).check();
  await expect(enter).toBeEnabled();
});
