import { expect } from "@playwright/test";
import { test, register, logout } from "./helpers";

test.describe("Workflow 3: Persona Detail Page", () => {
  test("displays all persona details", async ({ page }) => {
    await page.goto("/");
    await page.locator("a[href*='/personas/']").first().waitFor();

    // Click first persona card
    await page.locator("a[href*='/personas/']").first().click();
    await page.waitForURL(/\/personas\//);

    // Avatar
    await expect(page.locator("img").first()).toBeVisible();

    // Name heading
    await expect(page.locator("h1")).toBeVisible();

    // Tier badge
    await expect(
      page.locator("span").filter({ hasText: /^(Starter|Pro|Enterprise)$/ }).first()
    ).toBeVisible();

    // Price
    await expect(page.getByText(/\$\d+\.\d{2}/)).toBeVisible();
    await expect(page.getByText("per month")).toBeVisible();

    // Specialty section
    await expect(page.getByText("Specialty")).toBeVisible();

    // About section
    await expect(page.getByText("About")).toBeVisible();

    // Capabilities section
    await expect(page.getByText("Capabilities")).toBeVisible();

    // Rating / reviews
    await expect(page.getByText(/reviews/)).toBeVisible();
  });

  test("logged-in user sees Add to Cart and favorite button", async ({
    page,
  }) => {
    await register(page);
    await page.goto("/personas/p-001");

    await expect(
      page.getByRole("button", { name: "Add to Cart" })
    ).toBeVisible();

    // Favorite (heart) button
    const heartBtn = page.locator("button").filter({ has: page.locator("svg path[d*='4.318']") });
    await expect(heartBtn).toBeVisible();
  });

  test("logged-out user sees sign-in prompt instead of cart/favorite", async ({
    page,
  }) => {
    await page.goto("/personas/p-001");

    // Should not show Add to Cart
    await expect(
      page.getByRole("button", { name: "Add to Cart" })
    ).not.toBeVisible();

    // Should show sign-in link in the main content area
    await expect(page.locator("main").getByText("Sign in")).toBeVisible();
  });

  test("back link returns to browse", async ({ page }) => {
    await page.goto("/personas/p-001");
    await page.getByText("Back to browse").click();
    await page.waitForURL("/");
  });
});
