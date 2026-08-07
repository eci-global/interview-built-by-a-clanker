import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
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
      command: "export PATH=\"/Users/igorganapolsky/.local/bin:$PATH\"; npx pnpm --filter @acme/api dev",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
    {
      command: "export PATH=\"/Users/igorganapolsky/.local/bin:$PATH\"; npx pnpm --filter @acme/web dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 10000,
    },
  ],
});
