import path from "node:path";
import { defineConfig } from "vitest/config";

const root = path.resolve(__dirname, "node_modules");

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "apps/web/src"),
      "@acme/shared": path.resolve(__dirname, "packages/shared/src/index.ts"),
      react: path.join(root, "react"),
      "react-dom": path.join(root, "react-dom"),
      "@tanstack/react-query": path.join(root, "@tanstack/react-query"),
      "@tanstack/react-router": path.join(root, "@tanstack/react-router"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 20000,
  },
});
