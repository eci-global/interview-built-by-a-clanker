import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildApiTestApp,
  registerTestUser,
} from "../test-utils.js";

describe("cart routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApiTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("adds a persona to the cart and returns enriched cart items", async () => {
    const { token } = await registerTestUser(app);

    const addResponse = await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-002", quantity: 1 },
    });

    assert.equal(addResponse.statusCode, 200);
    const cart = addResponse.json<{
      items: { personaId: string; persona: { name: string }; quantity: number }[];
      total: number;
    }>();
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0]?.personaId, "p-002");
    assert.equal(cart.items[0]?.persona.name, "Zero-Day Zara");
    assert.equal(cart.items[0]?.quantity, 1);
    assert.ok(cart.total > 0);
  });

  it("returns the same cart on GET after adding items", async () => {
    const { token } = await registerTestUser(app);

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-003", quantity: 2 },
    });

    const getResponse = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader(token),
    });

    assert.equal(getResponse.statusCode, 200);
    const cart = getResponse.json<{ items: { quantity: number }[] }>();
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0]?.quantity, 2);
  });

  it("increments quantity when adding the same persona twice", async () => {
    const { token } = await registerTestUser(app);

    await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-001", quantity: 1 },
    });

    const secondAdd = await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-001", quantity: 1 },
    });

    assert.equal(secondAdd.statusCode, 200);
    const cart = secondAdd.json<{ items: { quantity: number }[] }>();
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0]?.quantity, 2);
  });
});
