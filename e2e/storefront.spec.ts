import { test, expect } from "@playwright/test";

test.describe("Agentic Personas Storefront E2E Flow", () => {
  test("user can register, search, browse, favorite, add to cart, and complete checkout", async ({ page }) => {
    // 1. Visit homepage
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Discover Agentic Personas" })).toBeVisible();

    // 2. Test search functionality (BUG-015 fix verification)
    const searchInput = page.getByPlaceholder("Search personas by name, capability, or description...");
    await searchInput.fill("zero");
    // Wait for debounced query & URL update
    await expect(page).toHaveURL("/?q=zero");
    await expect(page.getByText("Zero-Day Zara")).toBeVisible();
    await expect(page.getByText("Refactor Rex")).not.toBeVisible();

    // Clear search
    await searchInput.fill("");
    await expect(page.getByText("Refactor Rex")).toBeVisible();

    // 3. Register account
    await page.getByRole("link", { name: "Sign up" }).click();
    await expect(page.getByRole("heading", { name: "Create Account" })).toBeVisible();

    const timestamp = Date.now();
    const username = `e2euser_${timestamp}`;
    const email = `e2e_${timestamp}@example.com`;

    await page.fill("#username", username);
    await page.fill("#email", email);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    // 4. Back on homepage, verify persona price formatting ($49.99, not $4999.00)
    await expect(page.getByText("$49.99/mo").first()).toBeVisible();
    await expect(page.getByText("$4999.00")).not.toBeVisible();

    // 5. Click on a persona detail
    await page.click("text=Refactor Rex");
    await expect(page.getByRole("heading", { name: "Refactor Rex" })).toBeVisible();
    await expect(page.getByText("$49.99")).toBeVisible();

    // 6. Add to cart
    await page.getByRole("button", { name: "Add to Cart" }).click();

    // 7. Toggle Favorite (Favorite persona)
    const heartButton = page.locator("button:has(svg.w-6.h-6)");
    await heartButton.click();
    // Wait until heart turns red
    await expect(page.locator("svg.text-red-500")).toBeVisible();

    // Verify in Favorites tab
    await page.getByRole("link", { name: "Favorites" }).click();
    await expect(page.getByRole("heading", { name: "Your Favorites" })).toBeVisible();
    await expect(page.getByText("Refactor Rex")).toBeVisible();

    // 8. Go to Cart page
    await page.locator("nav a[href='/cart']").click();
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
    await expect(page.getByText("Refactor Rex x1")).toBeVisible();

    // Verify decrement button is disabled when quantity is 1
    const minusBtn = page.getByRole("button", { name: "-" });
    await expect(minusBtn).toBeDisabled();

    // 9. Proceed to checkout
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    // Verify contact info is prefilled from logged-in user
    await expect(page.locator("#name")).toHaveValue(username);
    await expect(page.locator("#email")).toHaveValue(email);

    // Place order
    await page.getByRole("button", { name: "Place Order" }).click();

    // 10. Verify order confirmation
    await expect(page.getByRole("heading", { name: "Order Confirmed!" })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();
  });

  test("user can add an item to cart and remove it cleanly (BUG-016 verification)", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Sign up" }).click();
    const ts = Date.now();
    await page.fill("#username", `removeuser_${ts}`);
    await page.fill("#email", `remove_${ts}@example.com`);
    await page.fill("#password", "password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await page.click("text=Zero-Day Zara");
    await page.getByRole("button", { name: "Add to Cart" }).click();

    await page.locator("nav a[href='/cart']").click();
    await expect(page.getByRole("link", { name: "Zero-Day Zara" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();
  });
});
