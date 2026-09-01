import assert from "node:assert/strict";
import { after, afterEach, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildApiTestApp,
  registerTestUser,
} from "../test-utils.js";

describe("authenticate middleware (via protected routes)", () => {
  let app: FastifyInstance;
  let originalEnforceAuth: string | undefined;

  before(async () => {
    originalEnforceAuth = process.env.ENFORCE_AUTH;
    app = await buildApiTestApp();
  });

  afterEach(() => {
    delete process.env.ENFORCE_AUTH;
  });

  after(async () => {
    if (originalEnforceAuth === undefined) {
      delete process.env.ENFORCE_AUTH;
    } else {
      process.env.ENFORCE_AUTH = originalEnforceAuth;
    }
    await app.close();
  });

  it("sets request.user from bearer token when ENFORCE_AUTH is false", async () => {
    const { token } = await registerTestUser(app);

    const response = await app.inject({
      method: "POST",
      url: "/cart",
      headers: authHeader(token),
      payload: { personaId: "p-001", quantity: 1 },
    });

    assert.equal(response.statusCode, 200);
    const cart = response.json<{ items: { personaId: string }[] }>();
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0]?.personaId, "p-001");
  });

  it("returns 401 for cart when ENFORCE_AUTH is true and no token is provided", async () => {
    process.env.ENFORCE_AUTH = "true";

    const response = await app.inject({
      method: "GET",
      url: "/cart",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "Unauthorized" });
  });

  it("returns 401 for cart when ENFORCE_AUTH is true and token is invalid", async () => {
    process.env.ENFORCE_AUTH = "true";

    const response = await app.inject({
      method: "GET",
      url: "/cart",
      headers: authHeader("not-a-valid-token"),
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "Unauthorized" });
  });

  it("does not return 500 when favorites is called with a valid bearer token", async () => {
    const { token } = await registerTestUser(app);

    const response = await app.inject({
      method: "GET",
      url: "/favorites",
      headers: authHeader(token),
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { favorites: [] });
  });
});
