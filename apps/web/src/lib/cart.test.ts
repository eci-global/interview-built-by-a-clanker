import { describe, it, expect } from "vitest";
import type { Cart } from "@acme/shared";
import { cartQuery, cartCount } from "./cart";

describe("cart query/count (B14)", () => {
  it("uses the shared ['cart'] key that mutations invalidate", () => {
    expect(cartQuery().queryKey).toEqual(["cart"]);
  });

  it("sums item quantities", () => {
    const cart = {
      items: [
        { quantity: 2 },
        { quantity: 3 },
      ],
    } as Cart;
    expect(cartCount(cart)).toBe(5);
    expect(cartCount(undefined)).toBe(0);
    expect(cartCount({ items: [], total: 0 } as Cart)).toBe(0);
  });
});
