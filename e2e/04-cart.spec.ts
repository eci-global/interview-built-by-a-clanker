import { expect } from "@playwright/test";
import { test, register, addPersonaToCart } from "./helpers";

test.describe("Workflow 4: Cart Management", () => {
  test("add items, increment, decrement, remove", async ({ page }) => {
    await register(page);

    // 1-2. Add first persona to cart
    await addPersonaToCart(page, "p-001");

    // 3. Add a different persona
    await addPersonaToCart(page, "p-003");

    // 4. Add same persona (p-001) again – should increment quantity, not duplicate
    await addPersonaToCart(page, "p-001");

    // 5. Go to cart to verify (badge may not update due to query key mismatch)
    await page.goto("/cart");
    await page.getByText("Your Cart").waitFor();

    // 6. Verify both items present
    await expect(page.getByText("Refactor Rex", { exact: true })).toBeVisible();
    await expect(page.getByText("Pipeline Pete", { exact: true })).toBeVisible();

    // Verify Refactor Rex has quantity 2 (added twice)
    const cartItems = page.locator(".bg-white.rounded-xl.border.border-gray-200.p-4");

    // Find the Refactor Rex row and verify quantity is 2 (added twice)
    const rexRow = cartItems.filter({ hasText: "Refactor Rex" });
    await expect(rexRow.locator("span.text-center")).toHaveText("2");

    // 7. Click + to increase quantity to 3
    const incResponse1 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
    await rexRow.getByRole("button", { name: "+" }).click();
    await incResponse1;
    await expect(rexRow.locator("span.text-center")).toHaveText("3");

    // 8. Click - to decrease back down
    const decResponse1 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
    await rexRow.getByRole("button", { name: "-" }).click();
    await decResponse1;
    const decResponse2 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
    await rexRow.getByRole("button", { name: "-" }).click();
    await decResponse2;
    // Now quantity should be 1
    await expect(rexRow.locator("span.text-center")).toHaveText("1");

    // Verify - button is disabled at quantity 1
    await expect(rexRow.getByRole("button", { name: "-" })).toBeDisabled();

    // 9. Remove Pipeline Pete
    const peteRow = cartItems.filter({ hasText: "Pipeline Pete" });
    const deleteResponse = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "DELETE");
    await peteRow.getByText("Remove").click();
    await deleteResponse;

    // Pete should be gone from cart items
    await expect(peteRow).toHaveCount(0, { timeout: 5000 });

    // 10. Order summary should show only Refactor Rex
    const summary = page.locator(".sticky");
    await expect(summary).toContainText("Refactor Rex");
    await expect(summary).not.toContainText("Pipeline Pete");
    await expect(summary.getByText(/\$\d+\.\d{2}/).last()).toBeVisible();
  });
});
