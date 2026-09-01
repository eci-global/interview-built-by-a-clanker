import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import {
  authHeader,
  buildApiTestApp,
  registerTestUser,
} from "../test-utils.js";

describe("favorites routes", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApiTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("adds a favorite and lists it", async () => {
    const { token } = await registerTestUser(app);

    const addResponse = await app.inject({
      method: "POST",
      url: "/favorites",
      headers: authHeader(token),
      payload: { personaId: "p-001" },
    });

    assert.equal(addResponse.statusCode, 200);
    assert.deepEqual(addResponse.json(), { success: true });

    const listResponse = await app.inject({
      method: "GET",
      url: "/favorites",
      headers: authHeader(token),
    });

    assert.equal(listResponse.statusCode, 200);
    const body = listResponse.json<{ favorites: { id: string }[] }>();
    assert.equal(body.favorites.length, 1);
    assert.equal(body.favorites[0]?.id, "p-001");
  });

  it("removes a favorite", async () => {
    const { token } = await registerTestUser(app);

    await app.inject({
      method: "POST",
      url: "/favorites",
      headers: authHeader(token),
      payload: { personaId: "p-002" },
    });

    const removeResponse = await app.inject({
      method: "DELETE",
      url: "/favorites/p-002",
      headers: authHeader(token),
    });

    assert.equal(removeResponse.statusCode, 200);
    assert.deepEqual(removeResponse.json(), { success: true });

    const listResponse = await app.inject({
      method: "GET",
      url: "/favorites",
      headers: authHeader(token),
    });

    const body = listResponse.json<{ favorites: unknown[] }>();
    assert.equal(body.favorites.length, 0);
  });
});
