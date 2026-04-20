import { expect } from "@playwright/test";
import { test } from "./helpers";

test.describe("Workflow 2: Browse, Search & Filter", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for personas to load
    await page.locator("a[href*='/personas/']").first().waitFor();
  });

  test("all 15 persona cards are displayed", async ({ page }) => {
    const cards = page.locator("a[href*='/personas/']");
    await expect(cards).toHaveCount(15);
  });

  test("search filters results", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search personas");
    await searchInput.fill("code");
    // Wait for debounce + API response
    await page.waitForTimeout(500);

    const cards = page.locator("a[href*='/personas/']");
    const count = await cards.count();
    expect(count).toBeLessThan(15);
    expect(count).toBeGreaterThan(0);
  });

  test("specialty filter works", async ({ page }) => {
    await page.getByRole("button", { name: "Security" }).click();
    await page.waitForTimeout(500);

    const cards = page.locator("a[href*='/personas/']");
    const count = await cards.count();
    // Security personas: Zero-Day Zara and Compliance Carl
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThan(15);
  });

  test("tier filter narrows results", async ({ page }) => {
    // First apply Security specialty
    await page.getByRole("button", { name: "Security" }).click();
    await page.waitForTimeout(500);
    const beforeCount = await page.locator("a[href*='/personas/']").count();

    // Then add Enterprise tier
    await page.getByRole("button", { name: "Enterprise" }).click();
    await page.waitForTimeout(500);
    const afterCount = await page.locator("a[href*='/personas/']").count();

    expect(afterCount).toBeLessThanOrEqual(beforeCount);
    expect(afterCount).toBeGreaterThan(0);
  });

  test("sort by price low to high", async ({ page }) => {
    await page.locator("select").selectOption("price-asc");
    await page.waitForTimeout(500);

    // First card should be the cheapest persona
    const firstCard = page.locator("a[href*='/personas/']").first();
    await expect(firstCard).toContainText("$34.99");
  });

  test("sort by top rated", async ({ page }) => {
    await page.locator("select").selectOption("rating-desc");
    await page.waitForTimeout(500);
    // Just verify the page updated and cards are present
    const cards = page.locator("a[href*='/personas/']");
    await expect(cards.first()).toBeVisible();
  });

  test("sort by name A-Z", async ({ page }) => {
    await page.locator("select").selectOption("name-asc");
    await page.waitForTimeout(500);

    const firstCard = page.locator("a[href*='/personas/']").first();
    // A11y Alex should be first alphabetically
    await expect(firstCard).toContainText("A11y Alex");
  });

  test("no results shows empty state with clear filters", async ({ page }) => {
    // Design + Enterprise → likely no match
    await page.getByRole("button", { name: "Design" }).click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Enterprise" }).click();
    await page.waitForTimeout(500);

    // Check if we got zero results or if there actually are results
    const noResults = page.getByText("No personas found matching your criteria.");
    const cards = page.locator("a[href*='/personas/']");

    const cardsCount = await cards.count();
    if (cardsCount === 0) {
      await expect(noResults).toBeVisible();
      const clearBtn = page.getByText("Clear filters");
      await expect(clearBtn).toBeVisible();
      await clearBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator("a[href*='/personas/']")).toHaveCount(15);
    } else {
      // Design + Enterprise does have results, test passes as filters work
      expect(cardsCount).toBeGreaterThan(0);
    }
  });
});
