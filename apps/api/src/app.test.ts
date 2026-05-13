import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";
import { cartItems, db } from "./db.js";

let app: FastifyInstance;
let emailCounter = 0;

async function registerUser(username = "testuser") {
  const email = `user-${++emailCounter}@example.com`;
  const response = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username, email, password: "secret123" },
  });

  expect(response.statusCode).toBe(201);
  return response.json() as {
    token: string;
    user: { id: string; username: string; email: string };
  };
}

beforeEach(async () => {
  app = await buildApp();
});

afterEach(async () => {
  await app.close();
});

describe("Given API authentication is required", () => {
  it("When a guest requests the cart, Then the API returns 401", async () => {
    const response = await app.inject({ method: "GET", url: "/cart" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("Given the API is running", () => {
  it("When health is requested, Then the API reports ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("Given the API starts in production", () => {
  it("When JWT_SECRET is missing, Then startup fails instead of using a source-code secret", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalJwtSecret = process.env.JWT_SECRET;
    await app.close();

    process.env.NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    await expect(buildApp()).rejects.toThrow("JWT_SECRET is required in production");

    process.env.NODE_ENV = originalNodeEnv;
    if (originalJwtSecret === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = originalJwtSecret;
    }
    app = await buildApp();
  });
});

describe("Given a registered user", () => {
  it("When the user logs in, Then the auth response includes the full user contract", async () => {
    const registered = await registerUser("janedoe");

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: registered.user.email, password: "secret123" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      token: expect.any(String),
      user: {
        id: registered.user.id,
        username: "janedoe",
        email: registered.user.email,
      },
    });
  });

  it("When a user registers, Then the stored password hash is salted and non-plaintext", async () => {
    const alice = await registerUser("hashalice");
    const bob = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "hashbob",
        email: `user-${++emailCounter}@example.com`,
        password: "secret123",
      },
    });
    expect(bob.statusCode).toBe(201);

    const aliceRecord = db.users.getById(alice.user.id);
    const bobRecord = db.users.getById((bob.json() as typeof alice).user.id);

    expect(aliceRecord?.passwordHash).toMatch(/^scrypt:/);
    expect(aliceRecord?.passwordHash).not.toContain("secret123");
    expect(aliceRecord?.passwordHash).not.toEqual(bobRecord?.passwordHash);
  });

  it("When the user requests their profile, Then the API returns the current user", async () => {
    const registered = await registerUser("profileuser");

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${registered.token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(registered.user);
  });
});

describe("Given invalid auth requests", () => {
  it("When registration payload is invalid, Then validation errors are returned", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "x", email: "not-email", password: "123" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty("error");
  });

  it("When an email is already registered, Then registration is rejected", async () => {
    const registered = await registerUser("duplicate");

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "duplicate2",
        email: registered.user.email,
        password: "secret123",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Email already registered" });
  });

  it("When credentials are invalid, Then login is rejected", async () => {
    const registered = await registerUser("wrongpassword");

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: registered.user.email, password: "wrong-password" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "Invalid email or password" });
  });
});

describe("Given catalog price filters", () => {
  it("When minPrice is supplied, Then cheaper personas are excluded", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?minPrice=90",
    });

    expect(response.statusCode).toBe(200);
    const personas = response.json() as Array<{ price: number }>;
    expect(personas.length).toBeGreaterThan(0);
    expect(personas.every((persona) => persona.price >= 90)).toBe(true);
  });

  it("When catalog filters and sort are supplied, Then matching personas are returned in sorted order", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?q=code&specialty=Engineering&tier=Pro&maxPrice=60&sort=price-asc",
    });

    expect(response.statusCode).toBe(200);
    const personas = response.json() as Array<{
      price: number;
      specialty: string;
      tier: string;
    }>;
    expect(personas.length).toBeGreaterThan(0);
    expect(personas.every((persona) => persona.specialty === "Engineering")).toBe(
      true,
    );
    expect(personas.every((persona) => persona.tier === "Pro")).toBe(true);
    expect(personas.every((persona) => persona.price <= 60)).toBe(true);
    expect(personas.map((persona) => persona.price)).toEqual(
      [...personas.map((persona) => persona.price)].sort((a, b) => a - b),
    );
  });

  it("When catalog filters are invalid, Then the API rejects the request instead of returning misleading results", async () => {
    const invalidSpecialty = await app.inject({
      method: "GET",
      url: "/personas?specialty=Unknown",
    });
    const invalidSort = await app.inject({
      method: "GET",
      url: "/personas?sort=not-a-sort",
    });
    const invalidPrice = await app.inject({
      method: "GET",
      url: "/personas?minPrice=not-a-number",
    });

    expect(invalidSpecialty.statusCode).toBe(400);
    expect(invalidSort.statusCode).toBe(400);
    expect(invalidPrice.statusCode).toBe(400);
  });

  it("When a persona exists, Then it can be loaded by ID", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas/p-001",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "p-001", name: "Refactor Rex" });
  });

  it("When a persona does not exist, Then the API returns 404", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas/not-found",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Persona not found" });
  });
});

describe("Given multiple users have carts", () => {
  it("When one user deletes another user's cart item, Then the API denies the deletion", async () => {
    const alice = await registerUser("alice");
    const bob = await registerUser("bob");

    const addResponse = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${alice.token}` },
      payload: { personaId: "p-001", quantity: 1 },
    });
    const cart = addResponse.json() as { items: Array<{ id: string }> };
    const itemId = cart.items[0].id;

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: { authorization: `Bearer ${bob.token}` },
    });

    expect(deleteResponse.statusCode).toBe(404);

    const aliceCartResponse = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${alice.token}` },
    });
    expect(aliceCartResponse.json()).toMatchObject({
      items: [expect.objectContaining({ id: itemId })],
    });
  });
});

describe("Given a user manages their cart", () => {
  it("When an item is added twice, Then quantity is accumulated and can be updated and removed", async () => {
    const user = await registerUser("cartuser");

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "p-001", quantity: 1 },
    });
    const secondAdd = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "p-001", quantity: 2 },
    });
    const cart = secondAdd.json() as { items: Array<{ id: string; quantity: number }> };

    expect(cart.items[0].quantity).toBe(3);

    const update = await app.inject({
      method: "PUT",
      url: `/cart/${cart.items[0].id}`,
      headers: { authorization: `Bearer ${user.token}` },
      payload: { quantity: 4 },
    });

    expect(update.statusCode).toBe(200);
    expect(update.json()).toMatchObject({
      items: [expect.objectContaining({ quantity: 4 })],
    });

    const remove = await app.inject({
      method: "DELETE",
      url: `/cart/${cart.items[0].id}`,
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(remove.statusCode).toBe(200);
    expect(remove.json()).toEqual({ items: [], total: 0 });
  });

  it("When cart requests are invalid, Then validation errors are returned", async () => {
    const user = await registerUser("invalidcart");

    const missingPersona = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "missing", quantity: 1 },
    });
    const invalidQuantity = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "p-001", quantity: 0 },
    });
    const missingItem = await app.inject({
      method: "PUT",
      url: "/cart/missing-item",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { quantity: 1 },
    });

    expect(missingPersona.statusCode).toBe(404);
    expect(invalidQuantity.statusCode).toBe(400);
    expect(missingItem.statusCode).toBe(404);
  });

  it("When a cart contains an orphaned persona reference, Then the orphan is removed from the cart response", async () => {
    const user = await registerUser("orphanedcart");
    cartItems.set("orphan-cart-item", {
      id: "orphan-cart-item",
      userId: user.user.id,
      personaId: "missing-persona",
      quantity: 1,
    });

    const response = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], total: 0 });
    expect(cartItems.has("orphan-cart-item")).toBe(false);
  });
});

describe("Given a user manages favorites", () => {
  it("When favorites are added, listed, and removed, Then the favorite collection changes", async () => {
    const user = await registerUser("favuser");

    const add = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "p-001" },
    });
    const list = await app.inject({
      method: "GET",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
    });
    const remove = await app.inject({
      method: "DELETE",
      url: "/favorites/p-001",
      headers: { authorization: `Bearer ${user.token}` },
    });
    const emptyList = await app.inject({
      method: "GET",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(add.statusCode).toBe(200);
    expect(add.json()).toEqual({ success: true });
    expect(list.json()).toMatchObject({
      favorites: [expect.objectContaining({ id: "p-001" })],
    });
    expect(remove.statusCode).toBe(200);
    expect(emptyList.json()).toEqual({ favorites: [] });
  });

  it("When favorite requests are invalid, Then errors are returned", async () => {
    const user = await registerUser("invalidfav");

    const missingPersonaId = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
      payload: {},
    });
    const missingPersona = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "missing" },
    });
    const wrongShape = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: 123 },
    });
    const missingFavorite = await app.inject({
      method: "DELETE",
      url: "/favorites/missing",
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(missingPersonaId.statusCode).toBe(400);
    expect(missingPersona.statusCode).toBe(404);
    expect(wrongShape.statusCode).toBe(400);
    expect(missingFavorite.statusCode).toBe(404);
  });
});

describe("Given a user checks out a non-empty cart", () => {
  it("When checkout succeeds, Then an order is created and the cart is cleared", async () => {
    const user = await registerUser("buyer");

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { personaId: "p-001", quantity: 2 },
    });

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { name: "Buyer Person", email: "buyer@example.com" },
    });

    expect(checkoutResponse.statusCode).toBe(201);
    expect(checkoutResponse.json()).toMatchObject({
      id: expect.stringMatching(/^order-/),
      total: 99.98,
      customerEmail: "buyer@example.com",
    });

    const cartResponse = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${user.token}` },
    });

    expect(cartResponse.json()).toEqual({ items: [], total: 0 });
  });

  it("When checkout input is invalid or cart is empty, Then checkout is rejected", async () => {
    const user = await registerUser("checkouterrors");

    const invalidInput = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { name: "", email: "not-email" },
    });
    const emptyCart = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { name: "Empty Cart", email: "empty@example.com" },
    });

    expect(invalidInput.statusCode).toBe(400);
    expect(emptyCart.statusCode).toBe(400);
    expect(emptyCart.json()).toEqual({ error: "Cart is empty" });
  });

  it("When every cart item references a missing persona, Then checkout is rejected and orphan entries are cleared", async () => {
    const user = await registerUser("orphancheckout");
    cartItems.set("orphan-checkout-item", {
      id: "orphan-checkout-item",
      userId: user.user.id,
      personaId: "missing-persona",
      quantity: 1,
    });

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: { authorization: `Bearer ${user.token}` },
      payload: { name: "Orphan Buyer", email: "orphan@example.com" },
    });

    expect(checkoutResponse.statusCode).toBe(409);
    expect(checkoutResponse.json()).toEqual({
      error: "Cart contains unavailable personas",
    });
    expect(cartItems.has("orphan-checkout-item")).toBe(false);
  });
});
