import { expect } from "@playwright/test";
import { test, register, addPersonaToCart, uniqueEmail } from "./helpers";

test.describe("Workflow 5: Checkout Flow", () => {
  test("complete checkout and verify confirmation", async ({ page }) => {
    await register(page);

    // Add items to cart
    await addPersonaToCart(page, "p-001"); // Refactor Rex $49.99
    await addPersonaToCart(page, "p-003"); // Pipeline Pete $59.99

    // Go to cart and proceed to checkout
    await page.goto("/cart");
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await page.waitForURL("/checkout");

    // 2. Verify order summary shows items
    await expect(page.getByText("Refactor Rex")).toBeVisible();
    await expect(page.getByText("Pipeline Pete")).toBeVisible();

    // 3. Fill form and submit
    await page.getByLabel("Full Name").fill("Jane Doe");
    await page.getByLabel("Email").fill("jane@example.com");
    await page.getByRole("button", { name: "Place Order" }).click();

    // 4. Confirmation page
    await expect(page.getByText("Order Confirmed!")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Order ID:/)).toBeVisible();

    // Verify total is shown
    await expect(page.getByText(/\$\d+\.\d{2}/)).toBeVisible();

    // 5. Continue shopping link
    await page.getByText("Continue Shopping").click();
    await page.waitForURL("/");

    // 6. Cart should be empty
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });

  test("checkout with empty cart shows error", async ({ page }) => {
    await register(page);
    await page.goto("/checkout");

    await expect(page.getByText("Nothing to checkout")).toBeVisible();
  });
});
