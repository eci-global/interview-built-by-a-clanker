import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "corepack pnpm --filter @acme/api dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "corepack pnpm --filter @acme/web dev -- --host 127.0.0.1",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
