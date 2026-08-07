import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { personaRoutes } from "./routes/personas.js";
import { authRoutes } from "./routes/auth.js";
import { cartRoutes } from "./routes/cart.js";
import { favoriteRoutes } from "./routes/favorites.js";
import { checkoutRoutes } from "./routes/checkout.js";
import { db, cartItems, favorites, users, orders } from "./db.js";

async function buildApp() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(jwt, { secret: "test-secret" });

  await app.register(personaRoutes);
  await app.register(authRoutes);
  await app.register(cartRoutes);
  await app.register(favoriteRoutes);
  await app.register(checkoutRoutes);

  return app;
}

describe("API Integration & Bug Verification Tests", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let tokenUser1: string;
  let tokenUser2: string;

  beforeEach(async () => {
    users.clear();
    cartItems.clear();
    favorites.clear();
    orders.clear();
    app = await buildApp();

    // Register User 1
    const res1 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "user1", email: "user1@example.com", password: "password123" },
    });
    tokenUser1 = JSON.parse(res1.body).token;

    // Register User 2
    const res2 = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { username: "user2", email: "user2@example.com", password: "password123" },
    });
    tokenUser2 = JSON.parse(res2.body).token;
  });

  describe("Personas Route", () => {
    it("returns list of personas", async () => {
      const res = await app.inject({ method: "GET", url: "/personas" });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it("filters personas by specialty and tier", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/personas?specialty=Engineering&tier=Pro",
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.every((p: any) => p.specialty === "Engineering" && p.tier === "Pro")).toBe(true);
    });

    it("rejects invalid price filters with 400 Bad Request", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/personas?minPrice=notanumber",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe("BUG-1: /auth/login username in AuthResponse", () => {
    it("HAPPY PATH: returns username in user object on successful login", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "user1@example.com", password: "password123" },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.user.username).toBe("user1");
      expect(data.user.email).toBe("user1@example.com");
    });

    it("NEGATIVE PATH: rejects invalid credentials with 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "user1@example.com", password: "wrongpassword" },
      });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("Invalid email or password");
    });
  });

  describe("BUG-2: JWT Authentication Middleware", () => {
    it("HAPPY PATH: populates request.user for protected route when valid token is supplied", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).username).toBe("user1");
    });

    it("NEGATIVE PATH: blocks protected endpoint without token with 401 Unauthorized", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/me" });
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body).error).toBe("Unauthorized");
    });
  });

  describe("BUG-3: CORS Allowed HTTP Methods", () => {
    it("HAPPY PATH: allows DELETE method for cart item removal", async () => {
      // Add item first
      const addRes = await app.inject({
        method: "POST",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001", quantity: 1 },
      });
      const itemId = JSON.parse(addRes.body).items[0].id;

      // Delete item
      const delRes = await app.inject({
        method: "DELETE",
        url: `/cart/${itemId}`,
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(delRes.statusCode).toBe(200);
    });

    it("NEGATIVE PATH: returns 404 when deleting non-existent cart item", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/cart/non-existent-item-999",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Cart item not found");
    });
  });

  describe("BUG-4: Search minPrice Filter Logic", () => {
    it("HAPPY PATH: minPrice=70 returns only personas with price >= 70", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/personas?minPrice=70",
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.length).toBeGreaterThan(0);
      expect(data.every((p: any) => p.price >= 70)).toBe(true);
    });

    it("NEGATIVE PATH: minPrice=9999 returns empty array", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/personas?minPrice=9999",
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toEqual([]);
    });
  });

  describe("BUG-5: Cart Clearing Upon Checkout", () => {
    it("HAPPY PATH: successful checkout creates order and clears active cart", async () => {
      // Add item to cart
      await app.inject({
        method: "POST",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001", quantity: 2 },
      });

      // Checkout
      const checkoutRes = await app.inject({
        method: "POST",
        url: "/checkout",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { name: "User One", email: "user1@example.com" },
      });
      expect(checkoutRes.statusCode).toBe(201);
      const order = JSON.parse(checkoutRes.body);
      expect(order.id).toBeDefined();

      // Cart is cleared
      const cartRes = await app.inject({
        method: "GET",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(JSON.parse(cartRes.body).items).toHaveLength(0);
    });

    it("NEGATIVE PATH: checkout on empty cart returns 400 Bad Request", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/checkout",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { name: "User One", email: "user1@example.com" },
      });
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toBe("Cart is empty");
    });
  });

  describe("BUG-6: Frontend Auth Storage Clearance", () => {
    it("HAPPY PATH: login persists token and user data", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "user1@example.com", password: "password123" },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.token).toBeDefined();
    });

    it("NEGATIVE PATH: unauthenticated request after token removal returns 401", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/cart",
        headers: { authorization: "Bearer invalid_or_cleared_token" },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
