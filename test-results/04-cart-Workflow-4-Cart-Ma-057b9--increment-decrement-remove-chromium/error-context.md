# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-cart.spec.ts >> Workflow 4: Cart Management >> add items, increment, decrement, remove
- Location: e2e/04-cart.spec.ts:5:7

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.bg-white.rounded-xl.border.border-gray-200.p-4').filter({ hasText: 'Pipeline Pete' })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.bg-white.rounded-xl.border.border-gray-200.p-4').filter({ hasText: 'Pipeline Pete' })
    9 × locator resolved to 1 element
      - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e6]:
      - generic [ref=e7]:
        - link "🤖 Agentic Personas" [ref=e8] [cursor=pointer]:
          - /url: /
          - generic [ref=e9]: 🤖
          - generic [ref=e10]: Agentic Personas
        - generic [ref=e11]:
          - link "Browse" [ref=e12] [cursor=pointer]:
            - /url: /
          - link "Favorites" [ref=e13] [cursor=pointer]:
            - /url: /favorites
      - generic [ref=e14]:
        - link "3" [ref=e15] [cursor=pointer]:
          - /url: /cart
          - img [ref=e16]
          - generic [ref=e18]: "3"
        - generic [ref=e19]:
          - generic [ref=e20]: testuser
          - button "Sign out" [ref=e21]
  - main [ref=e22]:
    - generic [ref=e23]:
      - heading "Your Cart" [level=1] [ref=e24]
      - generic [ref=e25]:
        - generic [ref=e26]:
          - generic [ref=e27]:
            - link "Refactor Rex" [ref=e28] [cursor=pointer]:
              - /url: /personas/p-001
              - img "Refactor Rex" [ref=e29]
            - generic [ref=e30]:
              - link "Refactor Rex" [ref=e31] [cursor=pointer]:
                - /url: /personas/p-001
              - paragraph [ref=e32]: Your relentless code reviewer
              - paragraph [ref=e33]: $49.99/mo
            - generic [ref=e34]:
              - button "-" [disabled] [ref=e35]
              - generic [ref=e36]: "1"
              - button "+" [ref=e37]
            - generic [ref=e38]:
              - paragraph [ref=e39]: $49.99
              - button "Remove" [ref=e40]
          - generic [ref=e41]:
            - link "Pipeline Pete" [ref=e42] [cursor=pointer]:
              - /url: /personas/p-003
              - img "Pipeline Pete" [ref=e43]
            - generic [ref=e44]:
              - link "Pipeline Pete" [ref=e45] [cursor=pointer]:
                - /url: /personas/p-003
              - paragraph [ref=e46]: CI/CD maestro extraordinaire
              - paragraph [ref=e47]: $59.99/mo
            - generic [ref=e48]:
              - button "-" [disabled] [ref=e49]
              - generic [ref=e50]: "1"
              - button "+" [ref=e51]
            - generic [ref=e52]:
              - paragraph [ref=e53]: $59.99
              - button "Remove" [active] [ref=e54]
        - generic [ref=e56]:
          - heading "Order Summary" [level=3] [ref=e57]
          - generic [ref=e58]:
            - generic [ref=e59]:
              - generic [ref=e60]: Refactor Rex x1
              - generic [ref=e61]: $49.99
            - generic [ref=e62]:
              - generic [ref=e63]: Pipeline Pete x1
              - generic [ref=e64]: $59.99
          - generic [ref=e65]:
            - generic [ref=e66]: Total
            - generic [ref=e67]: $109.98
          - button "Proceed to Checkout" [ref=e68]
```

# Test source

```ts
  1  | import { expect } from "@playwright/test";
  2  | import { test, register, addPersonaToCart } from "./helpers";
  3  | 
  4  | test.describe("Workflow 4: Cart Management", () => {
  5  |   test("add items, increment, decrement, remove", async ({ page }) => {
  6  |     await register(page);
  7  | 
  8  |     // 1-2. Add first persona to cart
  9  |     await addPersonaToCart(page, "p-001");
  10 | 
  11 |     // 3. Add a different persona
  12 |     await addPersonaToCart(page, "p-003");
  13 | 
  14 |     // 4. Add same persona (p-001) again – should increment quantity, not duplicate
  15 |     await addPersonaToCart(page, "p-001");
  16 | 
  17 |     // 5. Go to cart to verify (badge may not update due to query key mismatch)
  18 |     await page.goto("/cart");
  19 |     await page.getByText("Your Cart").waitFor();
  20 | 
  21 |     // 6. Verify both items present
  22 |     await expect(page.getByText("Refactor Rex", { exact: true })).toBeVisible();
  23 |     await expect(page.getByText("Pipeline Pete", { exact: true })).toBeVisible();
  24 | 
  25 |     // Verify Refactor Rex has quantity 2 (added twice)
  26 |     const cartItems = page.locator(".bg-white.rounded-xl.border.border-gray-200.p-4");
  27 | 
  28 |     // Find the Refactor Rex row and verify quantity is 2 (added twice)
  29 |     const rexRow = cartItems.filter({ hasText: "Refactor Rex" });
  30 |     await expect(rexRow.locator("span.text-center")).toHaveText("2");
  31 | 
  32 |     // 7. Click + to increase quantity to 3
  33 |     const incResponse1 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
  34 |     await rexRow.getByRole("button", { name: "+" }).click();
  35 |     await incResponse1;
  36 |     await expect(rexRow.locator("span.text-center")).toHaveText("3");
  37 | 
  38 |     // 8. Click - to decrease back down
  39 |     const decResponse1 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
  40 |     await rexRow.getByRole("button", { name: "-" }).click();
  41 |     await decResponse1;
  42 |     const decResponse2 = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "PUT");
  43 |     await rexRow.getByRole("button", { name: "-" }).click();
  44 |     await decResponse2;
  45 |     // Now quantity should be 1
  46 |     await expect(rexRow.locator("span.text-center")).toHaveText("1");
  47 | 
  48 |     // Verify - button is disabled at quantity 1
  49 |     await expect(rexRow.getByRole("button", { name: "-" })).toBeDisabled();
  50 | 
  51 |     // 9. Remove Pipeline Pete
  52 |     const peteRow = cartItems.filter({ hasText: "Pipeline Pete" });
  53 |     const deleteResponse = page.waitForResponse((r) => r.url().includes("/cart/") && r.request().method() === "DELETE");
  54 |     await peteRow.getByText("Remove").click();
  55 |     await deleteResponse;
  56 | 
  57 |     // Pete should be gone from cart items
> 58 |     await expect(peteRow).toHaveCount(0, { timeout: 5000 });
     |                           ^ Error: expect(locator).toHaveCount(expected) failed
  59 | 
  60 |     // 10. Order summary should show only Refactor Rex
  61 |     const summary = page.locator(".sticky");
  62 |     await expect(summary).toContainText("Refactor Rex");
  63 |     await expect(summary).not.toContainText("Pipeline Pete");
  64 |     await expect(summary.getByText(/\$\d+\.\d{2}/).last()).toBeVisible();
  65 |   });
  66 | });
  67 | 
```