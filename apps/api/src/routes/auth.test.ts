import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import { userSchema } from "@acme/shared";

// BUG-003 — POST /auth/login response must include username in user object
describe("BUG-003: POST /auth/login includes username in response", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("login response user object contains username", async () => {
    app = await buildApp();

    // Register first
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "neo", email: "neo003@example.com", password: "redpill" },
    });

    // Login
    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "neo003@example.com", password: "redpill" },
    });

    expect(loginRes.statusCode).toBe(200);
    const body = loginRes.json();
    expect(body.user.username).toBe("neo");
  });

  it("login response user parses against userSchema without throwing", async () => {
    app = await buildApp();

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "neo2", email: "neo2003@example.com", password: "redpill2" },
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "neo2003@example.com", password: "redpill2" },
    });

    const body = loginRes.json();
    // userSchema requires { id, username, email } — this should not throw
    expect(() => userSchema.parse(body.user)).not.toThrow();
  });
});
