import { describe, it, expect, beforeAll } from "vitest";
import { buildApp, registerAndLogin } from "./helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const auth = await registerAndLogin(app, {
    username: "checkoutuser",
    email: "checkout@test.com",
    password: "pass123",
  });
  token = auth.token;
});

function authHeaders() {
  return { authorization: `Bearer ${token}` };
}

describe("POST /checkout", () => {
  it("clears the cart after successful checkout", async () => {
    // Add items to cart
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeaders(),
      payload: { personaId: "p-001", quantity: 1 },
    });
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeaders(),
      payload: { personaId: "p-002", quantity: 2 },
    });

    // Verify cart is not empty
    const cartBefore = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeaders(),
    });
    const beforeBody = JSON.parse(cartBefore.payload);
    expect(beforeBody.items.length).toBeGreaterThan(0);

    // Checkout
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: authHeaders(),
      payload: { name: "Test User", email: "checkout@test.com" },
    });
    expect(checkoutRes.statusCode).toBe(201);
    const order = JSON.parse(checkoutRes.payload);
    expect(order.id).toBeDefined();
    expect(order.items.length).toBeGreaterThan(0);
    expect(order.total).toBeGreaterThan(0);

    // Verify cart is now empty
    const cartAfter = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeaders(),
    });
    const afterBody = JSON.parse(cartAfter.payload);
    expect(afterBody.items).toHaveLength(0);
    expect(afterBody.total).toBe(0);
  });

  it("rejects checkout with empty cart", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: authHeaders(),
      payload: { name: "Test User", email: "checkout@test.com" },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe("Cart is empty");
  });
});
