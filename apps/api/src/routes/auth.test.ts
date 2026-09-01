import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildAuthTestApp } from "../test-utils.js";

describe("GET /auth/me", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildAuthTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("returns 401 when no authorization header is provided", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "Unauthorized" });
  });

  it("returns 401 when the bearer token is invalid", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: "Bearer not-a-valid-token",
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "Unauthorized" });
  });

  it("returns the authenticated user when a valid token is provided", async () => {
    const email = `me-test-${Date.now()}@example.com`;
    const registerResponse = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "me-test-user",
        email,
        password: "password123",
      },
    });

    assert.equal(registerResponse.statusCode, 201);
    const { token } = registerResponse.json<{ token: string }>();

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      id: "user-1",
      username: "me-test-user",
      email,
    });
  });

  it("returns 404 when the token references a user that no longer exists", async () => {
    const token = app.jwt.sign({
      id: "user-missing",
      email: "missing@example.com",
    });

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "User not found" });
  });
});

describe("POST /auth/login", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildAuthTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("returns username in the login response", async () => {
    const email = `login-test-${Date.now()}@example.com`;
    const username = "login-test-user";

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username, email, password: "password123" },
    });

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password: "password123" },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json<{ user: { id: string; username: string; email: string } }>();
    assert.equal(body.user.username, username);
    assert.equal(body.user.email, email);
  });
});
