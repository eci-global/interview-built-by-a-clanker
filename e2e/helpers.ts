import { test as base, type Page } from "@playwright/test";

// Unique suffix per worker to avoid email collisions across parallel runs
let counter = 0;

export function uniqueEmail(prefix = "pw") {
  return `${prefix}-${Date.now()}-${++counter}@test.com`;
}

export async function register(
  page: Page,
  {
    username = "testuser",
    email = uniqueEmail(),
    password = "pass123",
  }: { username?: string; email?: string; password?: string } = {}
) {
  await page.goto("/register");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Account" }).click();
  // Wait for redirect to home
  await page.waitForURL("/");
  return { username, email, password };
}

export async function login(
  page: Page,
  { email, password }: { email: string; password: string }
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("/");
}

export async function logout(page: Page) {
  await page.getByText("Sign out").click();
}

export async function addPersonaToCart(page: Page, personaId: string) {
  await page.goto(`/personas/${personaId}`);
  await page.getByRole("button", { name: "Add to Cart" }).click();
  // wait for mutation to settle
  await page.waitForTimeout(500);
}

export const test = base;
