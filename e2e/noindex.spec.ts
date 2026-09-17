import { test, expect } from "@playwright/test";

test("crawlers are told not to index the app", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toMatch(/Disallow:\s*\//);

  const home = await request.get("/");
  expect(home.ok()).toBeTruthy();
  expect(home.headers()["x-robots-tag"] ?? "").toMatch(/noindex/);
  expect(await home.text()).toMatch(/noindex/);
});
