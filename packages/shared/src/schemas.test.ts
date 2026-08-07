import { describe, it, expect } from "vitest";
import {
  personaFilterSchema,
  registerSchema,
  loginSchema,
  addToCartSchema,
  updateCartItemSchema,
  checkoutSchema,
} from "./index.js";

describe("Shared Schemas", () => {
  describe("personaFilterSchema", () => {
    it("parses valid filter params", () => {
      const input = {
        q: "Rex",
        specialty: "Engineering",
        tier: "Pro",
        minPrice: "10",
        maxPrice: "100",
        sort: "price-asc",
      };
      const result = personaFilterSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.minPrice).toBe(10);
        expect(result.data.maxPrice).toBe(100);
      }
    });

    it("rejects invalid specialty or sort option", () => {
      expect(personaFilterSchema.safeParse({ specialty: "Invalid" }).success).toBe(false);
      expect(personaFilterSchema.safeParse({ sort: "invalid-sort" }).success).toBe(false);
    });
  });

  describe("registerSchema & loginSchema", () => {
    it("validates register input", () => {
      const valid = { username: "alice", email: "alice@example.com", password: "password123" };
      expect(registerSchema.safeParse(valid).success).toBe(true);

      const invalidUsername = { username: "al", email: "alice@example.com", password: "password123" };
      expect(registerSchema.safeParse(invalidUsername).success).toBe(false);
    });

    it("validates login input", () => {
      const valid = { email: "alice@example.com", password: "password123" };
      expect(loginSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe("cart & checkout schemas", () => {
    it("validates addToCartSchema", () => {
      expect(addToCartSchema.safeParse({ personaId: "p-001" }).success).toBe(true);
      expect(addToCartSchema.safeParse({ personaId: "p-001", quantity: 0 }).success).toBe(false);
    });

    it("validates updateCartItemSchema", () => {
      expect(updateCartItemSchema.safeParse({ quantity: 2 }).success).toBe(true);
      expect(updateCartItemSchema.safeParse({ quantity: 0 }).success).toBe(false);
    });

    it("validates checkoutSchema", () => {
      expect(checkoutSchema.safeParse({ name: "Jane", email: "jane@example.com" }).success).toBe(true);
      expect(checkoutSchema.safeParse({ name: "", email: "jane@example.com" }).success).toBe(false);
      expect(checkoutSchema.safeParse({ name: "Jane", email: "invalid-email" }).success).toBe(false);
    });
  });
});
