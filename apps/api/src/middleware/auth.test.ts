import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

// BUG-005 — auth guard must be enforced by default (no ENFORCE_AUTH bypass).
describe("BUG-005: protected routes enforce auth by default", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("rejects a protected route with no token (401, not bypassed)", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/me" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects a protected route with a garbage token", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: "Bearer not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows a protected route with a valid token", async () => {
    app = await buildApp();
    const reg = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "authuser",
        email: "authuser@example.com",
        password: "secret123",
      },
    });
    const token = reg.json().token as string;

    const res = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().username).toBe("authuser");
  });
});
