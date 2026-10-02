import { describe, expect, it } from "vitest";
import { bearer, registerUser, useApp } from "../helpers/app";

const getApp = useApp();

describe("auth", () => {
  it("registers an account and returns the username", async () => {
    const { res, body, email } = await registerUser(getApp(), {
      username: "ada",
    });

    expect(res.statusCode).toBe(201);
    expect(body.token).toEqual(expect.any(String));
    expect(body.user).toMatchObject({ username: "ada", email });
  });

  it("rejects a duplicate email and a short password", async () => {
    const app = getApp();
    const first = await registerUser(app, { email: "dup@example.com" });
    const duplicate = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "other",
        email: "dup@example.com",
        password: "secret12",
      },
    });
    const invalid = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "ab", email: "short@example.com", password: "123" },
    });

    expect(first.res.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(invalid.statusCode).toBe(400);
  });

  it("logs in with the username included", async () => {
    const app = getApp();
    const created = await registerUser(app, {
      username: "ada",
      email: "login-user@example.com",
      password: "secret12",
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "login-user@example.com", password: "secret12" },
    });
    const body = res.json() as { user: { username?: string; email: string } };

    expect(created.res.statusCode).toBe(201);
    expect(res.statusCode).toBe(200);
    expect(body.user.username).toBe("ada");
    expect(body.user.email).toBe("login-user@example.com");
  });

  it("rejects a wrong password", async () => {
    const app = getApp();
    await registerUser(app, {
      email: "wrong-pass@example.com",
      password: "secret12",
    });
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "wrong-pass@example.com", password: "nope-nope" },
    });

    expect(res.statusCode).toBe(401);
  });

  it("treats email addresses as case-insensitive", async () => {
    const app = getApp();
    const created = await registerUser(app, {
      email: "Ada.Lovelace@Example.com",
      password: "secret12",
    });
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ada.lovelace@example.com", password: "secret12" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "ada2",
        email: "ada.lovelace@example.com",
        password: "secret12",
      },
    });

    expect(created.res.statusCode).toBe(201);
    expect.soft(login.statusCode).toBe(200);
    expect.soft(duplicate.statusCode).toBe(409);
  });

  it("returns the current user only with a valid token", async () => {
    const app = getApp();
    const { body } = await registerUser(app, { username: "ada" });
    const me = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: bearer(body.token),
    });
    const missing = await app.inject({ method: "GET", url: "/auth/me" });
    const garbage = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: bearer("not-a-token"),
    });

    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: "ada", id: body.user.id });
    expect(missing.statusCode).toBe(401);
    expect(garbage.statusCode).toBe(401);
  });
});
