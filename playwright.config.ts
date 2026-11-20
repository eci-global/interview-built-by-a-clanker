import { defineConfig, devices } from "@playwright/test";

// Requires `pnpm build` first (apps import @acme/shared from its dist/).
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "apps/api",
      url: "http://localhost:3001/health",
      reuseExistingServer: true,
    },
    {
      command: "npx vite --port 5173 --strictPort",
      cwd: "apps/web",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
  ],
});
