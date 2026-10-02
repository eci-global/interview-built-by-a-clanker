import { describe, expect, it } from "vitest";
import { bearer, registerUser, useApp } from "../helpers/app";

const getApp = useApp();

describe("favorites", () => {
  it("requires a signed-in user", async () => {
    const res = await getApp().inject({ method: "GET", url: "/favorites" });
    expect(res.statusCode).toBe(401);
  });

  it("adds, lists, and removes a favorite once", async () => {
    const app = getApp();
    const { body } = await registerUser(app, { username: "fan" });
    const headers = bearer(body.token);

    const added = await app.inject({
      method: "POST",
      url: "/favorites",
      headers,
      payload: { personaId: "p-007" },
    });
    const again = await app.inject({
      method: "POST",
      url: "/favorites",
      headers,
      payload: { personaId: "p-007" },
    });
    const listed = await app.inject({ method: "GET", url: "/favorites", headers });
    const removed = await app.inject({
      method: "DELETE",
      url: "/favorites/p-007",
      headers,
    });
    const after = await app.inject({ method: "GET", url: "/favorites", headers });

    expect(added.statusCode).toBe(200);
    expect(again.statusCode).toBe(200);
    expect(listed.json()).toMatchObject({
      favorites: [{ id: "p-007", name: "Debug Duchess Dana" }],
    });
    expect(removed.statusCode).toBe(200);
    expect(after.json()).toEqual({ favorites: [] });
  });

  it("rejects an unknown persona and a missing favorite", async () => {
    const app = getApp();
    const { body } = await registerUser(app);
    const headers = bearer(body.token);
    const missingPersona = await app.inject({
      method: "POST",
      url: "/favorites",
      headers,
      payload: { personaId: "nope" },
    });
    const missingFavorite = await app.inject({
      method: "DELETE",
      url: "/favorites/p-001",
      headers,
    });

    expect(missingPersona.statusCode).toBe(404);
    expect(missingFavorite.statusCode).toBe(404);
  });

  it("does not expose or remove another user's favorites", async () => {
    const app = getApp();
    const ada = bearer((await registerUser(app, { username: "ada" })).body.token);
    const bee = bearer((await registerUser(app, { username: "bee" })).body.token);
    await app.inject({
      method: "POST",
      url: "/favorites",
      headers: ada,
      payload: { personaId: "p-004" },
    });

    const beeList = await app.inject({ method: "GET", url: "/favorites", headers: bee });
    const beeRemove = await app.inject({
      method: "DELETE",
      url: "/favorites/p-004",
      headers: bee,
    });
    const adaList = await app.inject({ method: "GET", url: "/favorites", headers: ada });

    expect(beeList.json()).toEqual({ favorites: [] });
    expect(beeRemove.statusCode).toBe(404);
    expect(adaList.json()).toMatchObject({ favorites: [{ id: "p-004" }] });
  });
});
