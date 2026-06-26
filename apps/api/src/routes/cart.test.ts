import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { auth } from "../test-helpers.js";

async function register(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { username: "user", email, password: "password1" },
  });
  return res.json().token as string;
}

describe("cart item ownership (B7 IDOR)", () => {
  it("does not let a user delete another user's cart item", async () => {
    const app = await buildApp();
    const aliceTok = await register(app, "alice-idor@test.com");
    const bobTok = await register(app, "bob-idor@test.com");

    // Alice adds an item.
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: auth(aliceTok),
      payload: { personaId: "p-001", quantity: 1 },
    });
    const aliceItemId = (
      await app.inject({ method: "GET", url: "/cart", headers: auth(aliceTok) })
    ).json().items[0].id as string;

    // Bob tries to delete Alice's item — must be rejected (404, not found for him).
    const bobDelete = await app.inject({
      method: "DELETE",
      url: `/cart/${aliceItemId}`,
      headers: auth(bobTok),
    });
    expect(bobDelete.statusCode).toBe(404);

    // Alice's item is still there.
    const aliceCart = await app.inject({
      method: "GET",
      url: "/cart",
      headers: auth(aliceTok),
    });
    expect(aliceCart.json().items).toHaveLength(1);

    // Alice can delete her own item.
    const aliceDelete = await app.inject({
      method: "DELETE",
      url: `/cart/${aliceItemId}`,
      headers: auth(aliceTok),
    });
    expect(aliceDelete.statusCode).toBe(200);
    expect(aliceDelete.json().items).toHaveLength(0);
  });
});
