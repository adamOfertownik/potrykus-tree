import { defineConfig } from "@playwright/test";

const port = process.env.PLAYWRIGHT_PORT || "3333";
const base = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: base,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_NO_SERVER
    ? undefined
    : {
        command: `npm run start -- -p ${port}`,
        url: base,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
