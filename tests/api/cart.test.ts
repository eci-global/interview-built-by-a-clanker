import { describe, expect, it } from "vitest";
import { bearer, registerUser, useApp } from "../helpers/app";

const getApp = useApp();

type Cart = {
  items: { id: string; personaId: string; quantity: number; persona: { price: number } }[];
  total: number;
};

async function tokenFor(username: string) {
  const { body } = await registerUser(getApp(), { username });
  return body.token;
}

describe("cart", () => {
  it("requires a signed-in user", async () => {
    const res = await getApp().inject({ method: "GET", url: "/cart" });
    expect(res.statusCode).toBe(401);
  });

  it("adds a persona, merges a second add, and totals the line", async () => {
    const app = getApp();
    const token = await tokenFor("cart-add");
    const headers = bearer(token);

    const first = await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-001", quantity: 1 },
    });
    const second = await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-001", quantity: 2 },
    });
    const cart = second.json() as Cart;

    expect(first.statusCode).toBe(200);
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]).toMatchObject({ personaId: "p-001", quantity: 3 });
    expect(cart.total).toBe(149.97);
  });

  it("rejects an unknown persona and a quantity below 1", async () => {
    const app = getApp();
    const headers = bearer(await tokenFor("cart-validate"));
    const missing = await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "nope", quantity: 1 },
    });
    const zero = await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-001", quantity: 0 },
    });

    expect(missing.statusCode).toBe(404);
    expect(zero.statusCode).toBe(400);
  });

  it("updates and removes only the owner's line", async () => {
    const app = getApp();
    const owner = bearer(await tokenFor("cart-owner"));
    const other = bearer(await tokenFor("cart-other"));
    const added = await app.inject({
      method: "POST",
      url: "/cart",
      headers: owner,
      payload: { personaId: "p-006", quantity: 1 },
    });
    const itemId = (added.json() as Cart).items[0]!.id;

    const updated = await app.inject({
      method: "PUT",
      url: `/cart/${itemId}`,
      headers: owner,
      payload: { quantity: 2 },
    });
    const stolenUpdate = await app.inject({
      method: "PUT",
      url: `/cart/${itemId}`,
      headers: other,
      payload: { quantity: 9 },
    });
    const removed = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: owner,
    });

    expect((updated.json() as Cart).items[0]?.quantity).toBe(2);
    expect((updated.json() as Cart).total).toBe(89.98);
    expect(stolenUpdate.statusCode).toBe(404);
    expect(removed.statusCode).toBe(200);
    expect((removed.json() as Cart).items).toHaveLength(0);
  });

  it("does not let one user delete another user's cart item", async () => {
    const app = getApp();
    const ownerToken = await tokenFor("cart-victim");
    const attacker = bearer(await tokenFor("cart-attacker"));
    const added = await app.inject({
      method: "POST",
      url: "/cart",
      headers: bearer(ownerToken),
      payload: { personaId: "p-011", quantity: 1 },
    });
    const itemId = (added.json() as Cart).items[0]!.id;

    const attack = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: attacker,
    });
    const victimCart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: bearer(ownerToken),
    });

    expect({
      status: attack.statusCode,
      victimStillHasItem: (victimCart.json() as Cart).items.some(
        (item) => item.id === itemId,
      ),
    }).toEqual({ status: 404, victimStillHasItem: true });
  });

  it("keeps carts isolated between users", async () => {
    const app = getApp();
    const ada = bearer(await tokenFor("cart-ada"));
    const bee = bearer(await tokenFor("cart-bee"));
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: ada,
      payload: { personaId: "p-003" },
    });

    const beeCart = await app.inject({ method: "GET", url: "/cart", headers: bee });
    const adaCart = await app.inject({ method: "GET", url: "/cart", headers: ada });

    expect((beeCart.json() as Cart).items).toHaveLength(0);
    expect((adaCart.json() as Cart).items.map((item) => item.personaId)).toEqual([
      "p-003",
    ]);
  });
});
