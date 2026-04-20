import { expect } from "@playwright/test";
import { test, register, uniqueEmail } from "./helpers";

test.describe("Workflow 7: End-to-End Purchase", () => {
  test("browse → auth prompt → register → cart → checkout", async ({
    page,
  }) => {
    // 1. Start logged out, browse to Refactor Rex
    await page.goto("/personas/p-001");

    // 2. No Add to Cart button when logged out; sign-in link shown
    await expect(
      page.getByRole("button", { name: "Add to Cart" })
    ).not.toBeVisible();
    await expect(page.locator("main").getByText("Sign in")).toBeVisible();

    // 3. Register a new account
    const email = uniqueEmail("e2e");
    await register(page, { username: "buyer", email, password: "pass123" });

    // 4. Navigate back to Refactor Rex, add to cart
    await page.goto("/personas/p-001");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.waitForTimeout(500);

    // 5. Add Pipeline Pete ($59.99)
    await page.goto("/personas/p-003");
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await page.waitForTimeout(500);

    // 6. Go to cart, increase Refactor Rex quantity to 2
    await page.goto("/cart");
    await page.getByText("Your Cart").waitFor();

    const cartItems = page.locator(
      ".bg-white.rounded-xl.border.border-gray-200.p-4"
    );
    const rexRow = cartItems.filter({ hasText: "Refactor Rex" });
    await rexRow.getByRole("button", { name: "+" }).click();
    await page.waitForTimeout(500);

    // 7. Verify total = (2 × $49.99) + $59.99 = $159.97
    await expect(rexRow.locator("span.text-center")).toHaveText("2");

    // Check total in order summary
    const summaryTotal = page.locator(".sticky .border-t").getByText(/\$/);
    await expect(summaryTotal).toContainText("159.97");

    // 8. Proceed to checkout
    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await page.waitForURL("/checkout");

    await page.getByLabel("Full Name").fill("Test Buyer");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Place Order" }).click();

    // 9. Verify order confirmation
    await expect(page.getByText("Order Confirmed!")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("$159.97")).toBeVisible();

    // 10. Verify cart is empty
    await page.goto("/cart");
    await expect(page.getByText("Your cart is empty")).toBeVisible();
  });
});
