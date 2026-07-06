import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app.js";

// BUG-004 — CORS methods array omits DELETE (and PATCH), breaking browser preflights
// for DELETE /cart/:itemId and DELETE /favorites/:personaId.
describe("BUG-004: CORS preflight allows DELETE method", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("OPTIONS preflight for DELETE /cart/:itemId returns DELETE in access-control-allow-methods", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/cart-1",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });
    const allowedMethods = res.headers["access-control-allow-methods"] as string;
    expect(allowedMethods).toContain("DELETE");
  });

  it("OPTIONS preflight for DELETE /favorites/:personaId returns DELETE in access-control-allow-methods", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/favorites/persona-1",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });
    const allowedMethods = res.headers["access-control-allow-methods"] as string;
    expect(allowedMethods).toContain("DELETE");
  });
});
