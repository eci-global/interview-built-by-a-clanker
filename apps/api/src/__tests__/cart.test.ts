import { describe, it, expect, beforeAll } from "vitest";
import { buildApp, registerAndLogin } from "./helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let token: string;

beforeAll(async () => {
  app = await buildApp();
  const auth = await registerAndLogin(app, {
    username: "cartuser",
    email: "cart@test.com",
    password: "pass123",
  });
  token = auth.token;
});

function authHeaders() {
  return { authorization: `Bearer ${token}` };
}

describe("Cart ownership", () => {
  it("DELETE /cart/:itemId rejects if item belongs to another user", async () => {
    // Add an item to our cart
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeaders(),
      payload: { personaId: "p-001", quantity: 1 },
    });

    const cartRes = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeaders(),
    });
    const cart = JSON.parse(cartRes.payload);
    const itemId = cart.items[0].id;

    // Register a different user
    const other = await registerAndLogin(app, {
      username: "otheruser",
      email: "other@test.com",
      password: "pass123",
    });

    // Try to delete the first user's cart item
    const res = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: { authorization: `Bearer ${other.token}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("PUT /cart/:itemId rejects if item belongs to another user", async () => {
    const cartRes = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeaders(),
    });
    const cart = JSON.parse(cartRes.payload);
    const itemId = cart.items[0].id;

    const other = await registerAndLogin(app, {
      username: "otheruser2",
      email: "other2@test.com",
      password: "pass123",
    });

    const res = await app.inject({
      method: "PUT",
      url: `/cart/${itemId}`,
      headers: { authorization: `Bearer ${other.token}` },
      payload: { quantity: 5 },
    });
    expect(res.statusCode).toBe(404);
  });
});
