import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "pnpm --filter @acme/api dev",
      port: 3001,
      reuseExistingServer: true,
      timeout: 15_000,
    },
    {
      command: "pnpm --filter @acme/web dev",
      port: 5173,
      reuseExistingServer: true,
      timeout: 15_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
