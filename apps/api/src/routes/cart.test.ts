import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

// BUG-006 — DELETE /cart/:itemId must enforce ownership (item.userId === userId)
describe("BUG-006: DELETE /cart/:itemId ownership guard", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("user B cannot delete user A's cart item — returns 404 and A's cart is unchanged", async () => {
    app = await buildApp();

    // Register user A
    const regA = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "userA006", email: "userA006@example.com", password: "passwordA" },
    });
    expect(regA.statusCode).toBe(201);
    const tokenA = regA.json().token as string;

    // User A adds a persona to cart
    const addRes = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { personaId: "p-001", quantity: 1 },
    });
    expect(addRes.statusCode).toBe(200);
    const cartA = addRes.json();
    const itemId = cartA.items[0].id as string;

    // Register user B
    const regB = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "userB006", email: "userB006@example.com", password: "passwordB" },
    });
    expect(regB.statusCode).toBe(201);
    const tokenB = regB.json().token as string;

    // User B tries to delete user A's cart item — should be 404
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(deleteRes.statusCode).toBe(404);
    expect(deleteRes.json()).toEqual({ error: "Cart item not found" });

    // User A's cart must still contain the item
    const cartAAfter = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(cartAAfter.statusCode).toBe(200);
    const itemsAfter = cartAAfter.json().items as Array<{ id: string }>;
    expect(itemsAfter.some((i) => i.id === itemId)).toBe(true);
  });

  it("user A can delete their own cart item successfully", async () => {
    app = await buildApp();

    const regA = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "userA006b", email: "userA006b@example.com", password: "passwordA" },
    });
    const tokenA = regA.json().token as string;

    const addRes = await app.inject({
      method: "POST",
      url: "/cart",
      headers: { authorization: `Bearer ${tokenA}` },
      payload: { personaId: "p-002", quantity: 1 },
    });
    const itemId = addRes.json().items[0].id as string;

    // User A deletes their own item — should succeed (200)
    const deleteRes = await app.inject({
      method: "DELETE",
      url: `/cart/${itemId}`,
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    // Cart should now be empty
    const cartAfter = await app.inject({
      method: "GET",
      url: "/cart",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const itemsAfter = cartAfter.json().items as Array<{ id: string }>;
    expect(itemsAfter.some((i) => i.id === itemId)).toBe(false);
  });
});
