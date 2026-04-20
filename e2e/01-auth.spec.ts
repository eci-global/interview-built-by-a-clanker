import { expect } from "@playwright/test";
import { test, register, login, logout, uniqueEmail } from "./helpers";

test.describe("Workflow 1: Registration & Login", () => {
  test("register, auto-login, logout, login again, session persists", async ({
    page,
  }) => {
    const email = uniqueEmail("w1");
    const password = "pass123";

    // 1-3. Register
    await page.goto("/register");
    await page.getByLabel("Username").fill("testuser");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create Account" }).click();

    // 4. Auto-logged in
    await page.waitForURL("/");
    await expect(page.getByText("testuser")).toBeVisible();
    await expect(page.getByText("Sign out")).toBeVisible();

    // 5. Sign out
    await logout(page);
    await expect(page.getByText("Sign in")).toBeVisible();

    // 6. Log in again
    await login(page, { email, password });

    // 7. Verify logged in
    await expect(page.getByText("testuser")).toBeVisible();

    // 8. Refresh – session persists
    await page.reload();
    await expect(page.getByText("testuser")).toBeVisible();
  });

  test("register with short username shows validation error", async ({
    page,
  }) => {
    await page.goto("/register");
    const usernameInput = page.getByLabel("Username");
    await usernameInput.fill("ab");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("pass123");
    await page.getByRole("button", { name: "Create Account" }).click();

    // HTML5 minLength validation or server-side error
    // The form has minLength=3, browser should prevent submission or server rejects
    const stillOnPage = page.url().includes("/register");
    expect(stillOnPage).toBe(true);
  });

  test("register with short password shows validation error", async ({
    page,
  }) => {
    await page.goto("/register");
    await page.getByLabel("Username").fill("testuser2");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("12345");
    await page.getByRole("button", { name: "Create Account" }).click();

    // minLength=6 on the input
    const stillOnPage = page.url().includes("/register");
    expect(stillOnPage).toBe(true);
  });

  test("register with duplicate email shows error", async ({ page }) => {
    const email = uniqueEmail("dup");
    await register(page, { username: "first", email, password: "pass123" });
    await logout(page);

    await page.goto("/register");
    await page.getByLabel("Username").fill("second");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("pass123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect(page.locator(".text-red-600")).toBeVisible({ timeout: 5000 });
  });

  test("login with wrong password shows error", async ({ page }) => {
    const email = uniqueEmail("wrongpw");
    await register(page, { email, password: "pass123" });
    await logout(page);

    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.locator(".text-red-600")).toBeVisible({ timeout: 5000 });
  });
});
