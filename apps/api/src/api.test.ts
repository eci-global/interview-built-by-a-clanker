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

  describe("Authentication", () => {
    it("logs in registered user", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "user1@example.com", password: "password123" },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.token).toBeDefined();
      expect(data.user.email).toBe("user1@example.com");
    });

    it("rejects invalid credentials with 401", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { email: "user1@example.com", password: "wrongpassword" },
      });
      expect(res.statusCode).toBe(401);
    });

    it("returns user info for /auth/me with valid token", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.email).toBe("user1@example.com");
    });

    it("returns 401 for unauthenticated request to /auth/me", async () => {
      const res = await app.inject({ method: "GET", url: "/auth/me" });
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Cart Security & Functionality", () => {
    it("allows user to add, update, and fetch cart items", async () => {
      // Add
      const addRes = await app.inject({
        method: "POST",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001", quantity: 2 },
      });
      expect(addRes.statusCode).toBe(200);
      const cart = JSON.parse(addRes.body);
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].quantity).toBe(2);
      const itemId = cart.items[0].id;

      // Update
      const updateRes = await app.inject({
        method: "PUT",
        url: `/cart/${itemId}`,
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { quantity: 3 },
      });
      expect(updateRes.statusCode).toBe(200);
      expect(JSON.parse(updateRes.body).items[0].quantity).toBe(3);
    });

    it("SECURITY FIX: prevents User 2 from deleting User 1's cart item", async () => {
      // User 1 adds item to cart
      const addRes = await app.inject({
        method: "POST",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001", quantity: 1 },
      });
      const itemId = JSON.parse(addRes.body).items[0].id;

      // User 2 attempts to delete User 1's cart item
      const deleteRes = await app.inject({
        method: "DELETE",
        url: `/cart/${itemId}`,
        headers: { authorization: `Bearer ${tokenUser2}` },
      });
      expect(deleteRes.statusCode).toBe(404);

      // Verify User 1's cart item still exists
      const getRes = await app.inject({
        method: "GET",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(JSON.parse(getRes.body).items).toHaveLength(1);
    });
  });

  describe("Favorites", () => {
    it("adds and removes favorites for authenticated user", async () => {
      // Add favorite
      const addRes = await app.inject({
        method: "POST",
        url: "/favorites",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001" },
      });
      expect(addRes.statusCode).toBe(200);

      // Get favorites
      const getRes = await app.inject({
        method: "GET",
        url: "/favorites",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(getRes.statusCode).toBe(200);
      expect(JSON.parse(getRes.body).favorites).toHaveLength(1);

      // Remove favorite
      const deleteRes = await app.inject({
        method: "DELETE",
        url: "/favorites/p-001",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(deleteRes.statusCode).toBe(200);
    });
  });

  describe("Checkout", () => {
    it("completes checkout and empties user cart", async () => {
      // Add item to cart
      await app.inject({
        method: "POST",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
        payload: { personaId: "p-001", quantity: 1 },
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
      expect(order.items).toHaveLength(1);

      // Cart should now be empty
      const cartRes = await app.inject({
        method: "GET",
        url: "/cart",
        headers: { authorization: `Bearer ${tokenUser1}` },
      });
      expect(JSON.parse(cartRes.body).items).toHaveLength(0);
    });
  });
});
