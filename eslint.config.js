import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

// Flat ESLint config shared by all workspaces. Kept intentionally lean: the
// JS + TypeScript "recommended" sets, with generated/build output ignored.
// `turbo lint` previously referenced a `lint` task that no linter backed, so
// `pnpm lint` did nothing.
export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/*.gen.ts",
      "**/routeTree.gen.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      // Allow intentionally-unused args/vars when prefixed with `_`.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);
