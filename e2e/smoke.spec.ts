import { test, expect } from "@playwright/test";

test("home page lists personas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Refactor Rex")).toBeVisible();
});
