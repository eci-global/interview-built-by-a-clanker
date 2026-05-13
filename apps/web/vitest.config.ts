import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/main.tsx",
        "src/routeTree.gen.ts",
        "src/vite-env.d.ts",
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
      ],
      reporter: ["text", "html"],
    },
  },
});
