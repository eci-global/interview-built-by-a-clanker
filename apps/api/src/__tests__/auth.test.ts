import { describe, it, expect, beforeAll } from "vitest";
import { buildApp, registerAndLogin } from "./helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
});

describe("POST /auth/register", () => {
  it("returns token and user with username", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "alice", email: "alice@test.com", password: "pass123" },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(body.user.username).toBe("alice");
    expect(body.user.email).toBe("alice@test.com");
    expect(body.user.id).toBeDefined();
  });
});

describe("POST /auth/login", () => {
  it("returns token and user with username", async () => {
    // Register first
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "bob", email: "bob@test.com", password: "pass123" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "bob@test.com", password: "pass123" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.token).toBeDefined();
    expect(body.user.username).toBe("bob");
    expect(body.user.email).toBe("bob@test.com");
  });
});

describe("Auth enforcement", () => {
  it("rejects unauthenticated requests to protected routes", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cart",
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects requests with invalid tokens", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: "Bearer invalid-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows requests with valid tokens", async () => {
    const { token } = await registerAndLogin(app, {
      username: "authtest",
      email: "authtest@test.com",
      password: "pass123",
    });
    const res = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
