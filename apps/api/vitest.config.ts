import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/index.ts", "src/**/*.test.ts"],
      reporter: ["text", "html"],
    },
  },
});
