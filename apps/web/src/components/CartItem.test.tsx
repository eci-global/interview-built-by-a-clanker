import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { CartItem } from "./CartItem";
import type { CartItem as CartItemType } from "@acme/shared";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: unknown }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
}));

const makeItem = (quantity: number): CartItemType => ({
  id: "cart-item-1",
  personaId: "persona-1",
  persona: {
    id: "persona-1",
    name: "Test Persona",
    tagline: "A great test persona",
    description: "Detailed description here",
    avatarUrl: "https://example.com/avatar.png",
    specialty: "Engineering",
    capabilities: ["TypeScript", "React"],
    price: 20,
    rating: 4.5,
    reviewCount: 42,
    tier: "Pro",
  },
  quantity,
});

describe("CartItem – decrement button", () => {
  it("is disabled when quantity is 1", () => {
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItem
        item={makeItem(1)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
      />
    );
    const decrementBtn = screen.getByRole("button", { name: "-" });
    expect(decrementBtn).toBeDisabled();
  });

  it("does NOT call onUpdateQuantity(0) when clicked at quantity 1", async () => {
    const user = userEvent.setup();
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItem
        item={makeItem(1)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
      />
    );
    const decrementBtn = screen.getByRole("button", { name: "-" });
    await user.click(decrementBtn);
    expect(onUpdateQuantity).not.toHaveBeenCalledWith(0);
    expect(onUpdateQuantity).not.toHaveBeenCalled();
  });

  it("is enabled when quantity is 3", () => {
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItem
        item={makeItem(3)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
      />
    );
    const decrementBtn = screen.getByRole("button", { name: "-" });
    expect(decrementBtn).not.toBeDisabled();
  });

  it("calls onUpdateQuantity(2) when clicked at quantity 3", async () => {
    const user = userEvent.setup();
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();
    render(
      <CartItem
        item={makeItem(3)}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
      />
    );
    const decrementBtn = screen.getByRole("button", { name: "-" });
    await user.click(decrementBtn);
    expect(onUpdateQuantity).toHaveBeenCalledOnce();
    expect(onUpdateQuantity).toHaveBeenCalledWith(2);
  });
});
