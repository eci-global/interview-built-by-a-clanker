import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

// BUG-007 — POST /checkout creates the order but never clears the cart,
// so a subsequent GET /cart still shows the items and a second checkout
// would re-order them.
describe("BUG-007: POST /checkout clears the cart after creating the order", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("returns 201 with a sensible total, then GET /cart is empty", async () => {
    app = await buildApp();

    // Register a unique user
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "checkout_user",
        email: "checkout_bug007@example.com",
        password: "secret123",
      },
    });
    expect(reg.statusCode).toBe(201);
    const token = reg.json().token as string;

    const authHeaders = { authorization: `Bearer ${token}` };

    // Add p-001 (Refactor Rex, $49.99) with quantity 2 to cart
    const cartRes = await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeaders,
      payload: { personaId: "p-001", quantity: 2 },
    });
    expect(cartRes.statusCode).toBe(200);

    // Checkout
    const checkoutRes = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: authHeaders,
      payload: { name: "Test User", email: "checkout_bug007@example.com" },
    });
    expect(checkoutRes.statusCode).toBe(201);

    const order = checkoutRes.json();
    // 49.99 * 2 = 99.98
    expect(order.total).toBeCloseTo(99.98, 2);
    expect(order.items).toHaveLength(1);

    // Cart must be empty after checkout
    const cartAfter = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeaders,
    });
    expect(cartAfter.statusCode).toBe(200);
    expect(cartAfter.json()).toEqual({ items: [], total: 0 });
  });
});
