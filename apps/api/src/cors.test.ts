import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildFullTestApp } from "./test-utils.js";

describe("CORS configuration", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildFullTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("allows DELETE in preflight responses", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/favorites/p-001",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });

    assert.equal(response.statusCode, 204);
    const allowedMethods = response.headers["access-control-allow-methods"];
    assert.ok(
      allowedMethods?.includes("DELETE"),
      `Expected DELETE in access-control-allow-methods, got: ${allowedMethods}`,
    );
  });
});
