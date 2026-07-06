import { describe, it, expect } from "vitest";
import { orderSchema } from "./schemas/order.js";

// BUG-015 — customerEmail: z.string() drops the .email() constraint,
// allowing malformed email addresses into persisted orders.

const validCartItem = {
  id: "item-1",
  personaId: "persona-1",
  persona: {
    id: "persona-1",
    name: "Alex Engineer",
    tagline: "Full-stack wizard",
    description: "Builds end-to-end systems with precision.",
    avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
    specialty: "Engineering" as const,
    capabilities: ["TypeScript", "React", "Node.js"],
    price: 99,
    rating: 4.5,
    reviewCount: 42,
    tier: "Pro" as const,
  },
  quantity: 1,
};

const validOrder = {
  id: "order-1",
  userId: "user-1",
  items: [validCartItem],
  total: 99,
  customerName: "Jane Doe",
  customerEmail: "jane@example.com",
  createdAt: "2026-07-06T00:00:00.000Z",
};

describe("BUG-015: orderSchema enforces .email() on customerEmail", () => {
  it("accepts a valid order with a proper email", () => {
    const result = orderSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it("rejects an order with a non-email customerEmail", () => {
    const result = orderSchema.safeParse({ ...validOrder, customerEmail: "nope" });
    expect(result.success).toBe(false);
  });

  it("rejects an order with an empty customerEmail", () => {
    const result = orderSchema.safeParse({ ...validOrder, customerEmail: "" });
    expect(result.success).toBe(false);
  });
});
