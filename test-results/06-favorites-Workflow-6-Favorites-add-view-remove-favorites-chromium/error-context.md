# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 06-favorites.spec.ts >> Workflow 6: Favorites >> add, view, remove favorites
- Location: e2e/06-favorites.spec.ts:5:7

# Error details

```
Error: expect(locator).not.toHaveClass(expected) failed

Locator: locator('button').filter({ has: locator('svg path[d*=\'4.318\']') }).locator('svg')
Expected pattern: not /text-red-500/
Received string: "w-6 h-6 text-red-500 fill-red-500"
Timeout: 5000ms

Call log:
  - Expect "not toHaveClass" with timeout 5000ms
  - waiting for locator('button').filter({ has: locator('svg path[d*=\'4.318\']') }).locator('svg')
    9 × locator resolved to <svg fill="currentColor" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6 text-red-500 fill-red-500">…</svg>
      - unexpected value "w-6 h-6 text-red-500 fill-red-500"

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
        - link [ref=e15] [cursor=pointer]:
          - /url: /cart
          - img [ref=e16]
        - generic [ref=e18]:
          - generic [ref=e19]: testuser
          - button "Sign out" [ref=e20]
  - main [ref=e21]:
    - generic [ref=e22]:
      - link "Back to browse" [ref=e23] [cursor=pointer]:
        - /url: /
        - img [ref=e24]
        - text: Back to browse
      - generic [ref=e27]:
        - img "Refactor Rex" [ref=e29]
        - generic [ref=e30]:
          - generic [ref=e31]:
            - generic [ref=e32]:
              - generic [ref=e33]:
                - heading "Refactor Rex" [level=1] [ref=e34]
                - generic [ref=e35]: Pro
              - paragraph [ref=e36]: Your relentless code reviewer
              - generic [ref=e37]:
                - generic [ref=e38]:
                  - img [ref=e39]
                  - img [ref=e41]
                  - img [ref=e43]
                  - img [ref=e45]
                  - img [ref=e47]
                  - generic [ref=e49]: "4.8"
                - generic [ref=e50]: (234 reviews)
            - generic [ref=e51]:
              - paragraph [ref=e52]: $49.99
              - paragraph [ref=e53]: per month
          - generic [ref=e54]:
            - heading "Specialty" [level=3] [ref=e55]
            - generic [ref=e56]: Engineering
          - generic [ref=e57]:
            - heading "About" [level=3] [ref=e58]
            - paragraph [ref=e59]: Refactor Rex dives deep into your codebase, identifying code smells, reducing complexity, and suggesting clean architectural patterns. Ideal for legacy codebases that need modernization.
          - generic [ref=e60]:
            - heading "Capabilities" [level=3] [ref=e61]
            - generic [ref=e62]:
              - generic [ref=e63]: Code review
              - generic [ref=e64]: Complexity analysis
              - generic [ref=e65]: Design patterns
              - generic [ref=e66]: Technical debt reduction
          - generic [ref=e67]:
            - button "Add to Cart" [ref=e68]
            - button [ref=e69]:
              - img [ref=e70]
```

# Test source

```ts
  1  | import { expect } from "@playwright/test";
  2  | import { test, register } from "./helpers";
  3  | 
  4  | test.describe("Workflow 6: Favorites", () => {
  5  |   test("add, view, remove favorites", async ({ page }) => {
  6  |     await register(page);
  7  | 
  8  |     // 1-2. Favorite a persona from detail page
  9  |     await page.goto("/personas/p-001");
  10 |     const heartBtn = page.locator("button").filter({
  11 |       has: page.locator("svg path[d*='4.318']"),
  12 |     });
  13 |     await heartBtn.click();
  14 |     await page.waitForTimeout(500);
  15 | 
  16 |     // Heart should now be filled (red)
  17 |     const heartSvg = heartBtn.locator("svg");
  18 |     await expect(heartSvg).toHaveClass(/text-red-500/);
  19 | 
  20 |     // 3. Navigate to favorites page
  21 |     await page.goto("/favorites");
  22 |     await expect(page.getByText("Refactor Rex")).toBeVisible();
  23 | 
  24 |     // 4. Favorite another persona
  25 |     await page.goto("/personas/p-003");
  26 |     const heartBtn2 = page.locator("button").filter({
  27 |       has: page.locator("svg path[d*='4.318']"),
  28 |     });
  29 |     await heartBtn2.click();
  30 |     await page.waitForTimeout(500);
  31 | 
  32 |     await page.goto("/favorites");
  33 |     await expect(page.getByText("Refactor Rex")).toBeVisible();
  34 |     await expect(page.getByText("Pipeline Pete")).toBeVisible();
  35 | 
  36 |     // 5. Remove Refactor Rex via the detail page toggle (more reliable)
  37 |     await page.goto("/personas/p-001");
  38 |     const toggleBtn = page.locator("button").filter({
  39 |       has: page.locator("svg path[d*='4.318']"),
  40 |     });
  41 |     // It should be favorited (red) — click to unfavorite
  42 |     await expect(toggleBtn.locator("svg")).toHaveClass(/text-red-500/);
  43 |     await toggleBtn.click();
  44 |     await page.waitForTimeout(500);
  45 | 
  46 |     // Verify unfavorited
> 47 |     await expect(toggleBtn.locator("svg")).not.toHaveClass(/text-red-500/);
     |                                                ^ Error: expect(locator).not.toHaveClass(expected) failed
  48 | 
  49 |     // Favorites page should only show Pipeline Pete
  50 |     await page.goto("/favorites");
  51 |     await expect(page.getByText("Pipeline Pete")).toBeVisible();
  52 |     // Refactor Rex should be gone
  53 |     const rexElements = page.locator("text=Refactor Rex");
  54 |     await expect(rexElements).toHaveCount(0);
  55 | 
  56 |     // 6. Unfavorite Pipeline Pete from detail page
  57 |     await page.goto("/personas/p-003");
  58 |     const toggleBtn2 = page.locator("button").filter({
  59 |       has: page.locator("svg path[d*='4.318']"),
  60 |     });
  61 |     await toggleBtn2.click();
  62 |     await page.waitForTimeout(500);
  63 | 
  64 |     // 7. Favorites should now be empty
  65 |     await page.goto("/favorites");
  66 |     await expect(
  67 |       page.getByText("You haven't favorited any personas yet.")
  68 |     ).toBeVisible();
  69 |   });
  70 | });
  71 | 
```