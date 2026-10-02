import { describe, expect, it } from "vitest";
import { bearer, registerUser, useApp } from "../helpers/app";

const getApp = useApp();

type Cart = { items: { id: string }[]; total: number };
type Order = {
  id: string;
  total: number;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  items: { personaId: string; quantity: number }[];
};

describe("checkout", () => {
  it("requires a signed-in user and a non-empty cart", async () => {
    const app = getApp();
    const anonymous = await app.inject({
      method: "POST",
      url: "/checkout",
      payload: { name: "Ada Lovelace", email: "ada@example.com" },
    });
    const { body } = await registerUser(app);
    const empty = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: bearer(body.token),
      payload: { name: "Ada Lovelace", email: "ada@example.com" },
    });

    expect(anonymous.statusCode).toBe(401);
    expect(empty.statusCode).toBe(400);
  });

  it("places an order for the cart total, then clears the cart", async () => {
    const app = getApp();
    const { body } = await registerUser(app, { email: "buyer@example.com" });
    const headers = bearer(body.token);
    await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-001", quantity: 2 },
    });
    await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-009", quantity: 1 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/checkout",
      headers,
      payload: { name: "Ada Lovelace", email: "buyer@example.com" },
    });
    const order = res.json() as Order;
    const cart = await app.inject({ method: "GET", url: "/cart", headers });
    const second = await app.inject({
      method: "POST",
      url: "/checkout",
      headers,
      payload: { name: "Ada Lovelace", email: "buyer@example.com" },
    });

    expect(res.statusCode).toBe(201);
    expect(order.id).toMatch(/^order-\d+$/);
    expect(order.total).toBe(139.97);
    expect(order.customerName).toBe("Ada Lovelace");
    expect(order.customerEmail).toBe("buyer@example.com");
    expect(Number.isNaN(Date.parse(order.createdAt))).toBe(false);
    expect(order.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ personaId: "p-001", quantity: 2 }),
        expect.objectContaining({ personaId: "p-009", quantity: 1 }),
      ]),
    );
    expect((cart.json() as Cart).items).toHaveLength(0);
    expect(second.statusCode).toBe(400);
  });

  it("keeps the cart when the contact details are invalid", async () => {
    const app = getApp();
    const { body } = await registerUser(app);
    const headers = bearer(body.token);
    await app.inject({
      method: "POST",
      url: "/cart",
      headers,
      payload: { personaId: "p-012", quantity: 1 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/checkout",
      headers,
      payload: { name: "", email: "not-an-email" },
    });
    const cart = await app.inject({ method: "GET", url: "/cart", headers });

    expect(res.statusCode).toBe(400);
    expect((cart.json() as Cart).items).toHaveLength(1);
  });

  it("does not check out another user's cart", async () => {
    const app = getApp();
    const ada = bearer((await registerUser(app, { username: "ada" })).body.token);
    const bee = bearer((await registerUser(app, { username: "bee" })).body.token);
    await app.inject({
      method: "POST",
      url: "/cart",
      headers: ada,
      payload: { personaId: "p-008", quantity: 1 },
    });

    const res = await app.inject({
      method: "POST",
      url: "/checkout",
      headers: bee,
      payload: { name: "Bea", email: "bea@example.com" },
    });
    const adaCart = await app.inject({ method: "GET", url: "/cart", headers: ada });

    expect(res.statusCode).toBe(400);
    expect((adaCart.json() as Cart).total).toBe(79.99);
  });
});
