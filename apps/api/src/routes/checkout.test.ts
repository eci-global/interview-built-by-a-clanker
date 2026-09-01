import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildFullTestApp,
  registerTestUser,
} from "../test-utils.js";

describe("POST /checkout", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildFullTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("clears the cart after a successful checkout", async () => {
    const { token } = await registerTestUser(app);

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-001", quantity: 1 },
    });

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: authHeader(token),
      payload: { name: "Jane Doe", email: "jane@example.com" },
    });

    assert.equal(checkoutResponse.statusCode, 201);

    const cartResponse = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(token),
    });

    assert.equal(cartResponse.statusCode, 200);
    const cart = cartResponse.json<{ items: unknown[] }>();
    assert.equal(cart.items.length, 0);
  });
});
