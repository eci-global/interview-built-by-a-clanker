import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { buildAppWithUser, auth } from "../test-helpers.js";

describe("authenticate middleware", () => {
  it("rejects protected routes with no/invalid token (401, not 500)", async () => {
    const app = await buildApp();

    const noToken = await app.inject({ method: "GET", url: "/cart" });
    expect(noToken.statusCode).toBe(401);

    const badToken = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    expect(badToken.statusCode).toBe(401);
  });

  it("populates request.user from the JWT so protected handlers work", async () => {
    const { app, token } = await buildAppWithUser();

    // Regression for B1: with a valid token this must return the user's cart,
    // not crash with "Cannot destructure property 'id' of 'request.user'".
    const res = await app.inject({
      method: "GET",
      url: "/cart",
      headers: auth(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ items: [], total: 0 });
  });
});
