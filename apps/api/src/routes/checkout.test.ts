import { describe, it, expect } from "vitest";
import { buildAppWithUser, auth } from "../test-helpers.js";

describe("POST /checkout", () => {
  it("clears the cart after a successful order (B6)", async () => {
    const { app, token } = await buildAppWithUser();

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: auth(token),
      payload: { personaId: "p-001", quantity: 2 },
    });

    const order = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: auth(token),
      payload: { name: "Jane Doe", email: "jane@example.com" },
    });
    expect(order.statusCode).toBe(201);
    expect(order.json().items).toHaveLength(1);

    // Regression: the cart must be empty after checkout, otherwise the same
    // cart can be ordered again and again.
    const cart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: auth(token),
    });
    expect(cart.json()).toEqual({ items: [], total: 0 });
  });

  it("rejects checkout with an empty cart", async () => {
    const { app, token } = await buildAppWithUser();
    const res = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: auth(token),
      payload: { name: "Jane Doe", email: "jane@example.com" },
    });
    expect(res.statusCode).toBe(400);
  });
});
