import { test, expect } from "@playwright/test";

test("regulamin and privacy are public and mention private family use", async ({
  page,
}) => {
  await page.goto("/regulamin");
  await expect(
    page.getByRole("heading", { name: "Regulamin" }),
  ).toBeVisible();
  await expect(page.getByText("Adam Lieske").first()).toBeVisible();
  await expect(page.getByText(/hasło rodzinne|kodem rodzinnym/i)).toBeVisible();
  await expect(page.getByText(/Administratorzy/i).first()).toBeVisible();
  await expect(page.getByText(/nie odpowiadają/i)).toBeVisible();

  await page.goto("/polityka-prywatnosci");
  await expect(
    page.getByRole("heading", { name: "Polityka prywatności" }),
  ).toBeVisible();
  await expect(page.getByText(/prywatne archiwum/i).first()).toBeVisible();
  await expect(page.getByText(/nie sprzedajemy/i)).toBeVisible();
});

test("gate requires legal acceptance before enter", async ({ page }) => {
  await page.goto("/");
  const enter = page.getByRole("button", { name: "Wejdź do drzewa" });
  await expect(enter).toBeVisible({ timeout: 20_000 });
  await expect(enter).toBeDisabled();
  await page.getByRole("link", { name: "regulamin" }).first().click();
  await expect(page).toHaveURL(/\/regulamin/);
  await page.goto("/");
  await page.getByLabel(/Akceptuję/).check();
  await expect(enter).toBeEnabled();
});
