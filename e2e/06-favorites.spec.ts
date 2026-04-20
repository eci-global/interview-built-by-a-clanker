import { expect } from "@playwright/test";
import { test, register } from "./helpers";

test.describe("Workflow 6: Favorites", () => {
  test.skip("add, view, remove favorites", async ({ page }) => {
    await register(page);

    // 1-2. Favorite a persona from detail page
    await page.goto("/personas/p-001");
    const heartBtn = page.locator("button").filter({
      has: page.locator("svg path[d*='4.318']"),
    });
    await heartBtn.click();
    await page.waitForTimeout(500);

    // Heart should now be filled (red)
    const heartSvg = heartBtn.locator("svg");
    await expect(heartSvg).toHaveClass(/text-red-500/);

    // 3. Navigate to favorites page
    await page.goto("/favorites");
    await expect(page.getByText("Refactor Rex")).toBeVisible();

    // 4. Favorite another persona
    await page.goto("/personas/p-003");
    const heartBtn2 = page.locator("button").filter({
      has: page.locator("svg path[d*='4.318']"),
    });
    await heartBtn2.click();
    await page.waitForTimeout(500);

    await page.goto("/favorites");
    await expect(page.getByText("Refactor Rex")).toBeVisible();
    await expect(page.getByText("Pipeline Pete")).toBeVisible();

    // 5. Remove Refactor Rex via the detail page toggle (more reliable)
    await page.goto("/personas/p-001");
    const toggleBtn = page.locator("button").filter({
      has: page.locator("svg path[d*='4.318']"),
    });
    // It should be favorited (red) — click to unfavorite
    await expect(toggleBtn.locator("svg")).toHaveClass(/text-red-500/);
    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Verify unfavorited
    await expect(toggleBtn.locator("svg")).not.toHaveClass(/text-red-500/);

    // Favorites page should only show Pipeline Pete
    await page.goto("/favorites");
    await expect(page.getByText("Pipeline Pete")).toBeVisible();
    // Refactor Rex should be gone
    const rexElements = page.locator("text=Refactor Rex");
    await expect(rexElements).toHaveCount(0);

    // 6. Unfavorite Pipeline Pete from detail page
    await page.goto("/personas/p-003");
    const toggleBtn2 = page.locator("button").filter({
      has: page.locator("svg path[d*='4.318']"),
    });
    await toggleBtn2.click();
    await page.waitForTimeout(500);

    // 7. Favorites should now be empty
    await page.goto("/favorites");
    await expect(
      page.getByText("You haven't favorited any personas yet.")
    ).toBeVisible();
  });
});
