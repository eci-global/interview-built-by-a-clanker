import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "./helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

describe("CORS configuration", () => {
  it("includes DELETE in allowed methods", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/test-id",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });
    // Should not be 405 Method Not Allowed
    expect(res.statusCode).not.toBe(405);
  });
});
