import { expect, test, type Page } from "@playwright/test";

function uniqueUser(prefix: string) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    username: `${prefix}-${id}`.slice(0, 30),
    email: `${prefix}-${id}@example.com`,
    password: "secret123",
  };
}

async function register(page: Page, user = uniqueUser("user")) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByText(user.username)).toBeVisible();
  return user;
}

test.describe("storefront happy path", () => {
  test("user can register, browse, favorite, cart, checkout, and logout", async ({
    page,
  }) => {
    const user = await register(page, uniqueUser("buyer"));

    await page.getByPlaceholder("Search personas by name").fill("security");
    await expect(page.getByText("Zero-Day Zara")).toBeVisible();

    await page.getByRole("button", { name: "Security" }).click();
    await page.getByText("Zero-Day Zara").click();
    await expect(page.getByRole("heading", { name: "Zero-Day Zara" })).toBeVisible();

    await page.getByRole("button", { name: "Add to favorites" }).click();
    await expect(
      page.getByRole("button", { name: "Remove from favorites" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Remove from favorites" }).click();
    await expect(
      page.getByRole("button", { name: "Add to favorites" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add to favorites" }).click();
    await expect(
      page.getByRole("button", { name: "Remove from favorites" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Favorites" }).click();
    await expect(page.getByText("Zero-Day Zara")).toBeVisible();

    await page.getByText("Zero-Day Zara").click();
    await page.getByRole("button", { name: "Add to Cart" }).click();
    await expect(page.getByText("1").first()).toBeVisible();

    await page.locator("nav").getByRole("link").filter({ has: page.locator("svg") }).click();
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();
    await expect(page.getByText("Zero-Day Zara x1")).toBeVisible();

    await page.getByRole("button", { name: "+" }).click();
    await expect(page.getByText("Zero-Day Zara x2")).toBeVisible();

    await page.getByRole("button", { name: "Proceed to Checkout" }).click();
    await page.getByLabel("Full Name").fill("Buyer Person");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Place Order" }).click();

    await expect(page.getByRole("heading", { name: "Order Confirmed!" })).toBeVisible();
    await expect(page.getByText("Total:")).toBeVisible();

    await page.getByRole("link", { name: "Continue Shopping" }).click();
    await page.locator("nav").getByRole("link").filter({ has: page.locator("svg") }).click();
    await expect(page.getByRole("heading", { name: "Your cart is empty" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });
});

test.describe("auth and protected feature paths", () => {
  test("anonymous user sees sign-in prompts for protected pages", async ({ page }) => {
    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Sign in to view your cart" })).toBeVisible();

    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "Sign in to view favorites" })).toBeVisible();

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Sign in to checkout" })).toBeVisible();
  });

  test("invalid login shows an error and keeps the user on the login page", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("missing@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });

  test("checkout rejects an empty cart", async ({ page }) => {
    await register(page, uniqueUser("emptycart"));

    await page.goto("/checkout");
    await expect(page.getByRole("heading", { name: "Nothing to checkout" })).toBeVisible();
  });
});
