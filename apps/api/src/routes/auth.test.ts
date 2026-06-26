import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("auth routes", () => {
  it("login returns the full user including username (B8)", async () => {
    const app = await buildApp();
    const creds = {
      username: "loginuser",
      email: "login-b8@test.com",
      password: "password1",
    };
    await app.inject({ method: "POST", url: "/auth/register", payload: creds });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: creds.password },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(typeof body.token).toBe("string");
    // Regression for B8: login previously returned { id, email } only, so the
    // nav bar rendered an undefined username after signing in.
    expect(body.user).toMatchObject({
      username: "loginuser",
      email: creds.email,
    });
    expect(body.user.id).toBeTruthy();
  });

  it("rejects wrong password (401) and duplicate email (409)", async () => {
    const app = await buildApp();
    const creds = {
      username: "dupuser",
      email: "dup-b8@test.com",
      password: "password1",
    };
    await app.inject({ method: "POST", url: "/auth/register", payload: creds });

    const wrong = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: creds.email, password: "wrongpass" },
    });
    expect(wrong.statusCode).toBe(401);

    const dup = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: creds,
    });
    expect(dup.statusCode).toBe(409);
  });
});
