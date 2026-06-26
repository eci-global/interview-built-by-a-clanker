import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { CartItem as CartItemType } from "@acme/shared";
import { CartItem } from "./CartItem";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

function makeItem(quantity: number): CartItemType {
  return {
    id: "cart-1",
    personaId: "p-001",
    quantity,
    persona: {
      id: "p-001",
      name: "Refactor Rex",
      tagline: "tagline",
      description: "d",
      avatarUrl: "a",
      specialty: "Engineering",
      capabilities: [],
      price: 49.99,
      rating: 4.8,
      reviewCount: 1,
      tier: "Pro",
    },
  };
}

describe("CartItem quantity controls (B15)", () => {
  it("disables the minus button at quantity 1 (can't send 0)", () => {
    render(
      <CartItem item={makeItem(1)} onUpdateQuantity={vi.fn()} onRemove={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "-" })).toBeDisabled();
  });

  it("enables minus above 1 and decrements on click", () => {
    const onUpdateQuantity = vi.fn();
    render(
      <CartItem item={makeItem(2)} onUpdateQuantity={onUpdateQuantity} onRemove={vi.fn()} />,
    );
    const minus = screen.getByRole("button", { name: "-" });
    expect(minus).not.toBeDisabled();
    fireEvent.click(minus);
    expect(onUpdateQuantity).toHaveBeenCalledWith(1);
  });
});
