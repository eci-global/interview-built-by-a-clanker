import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PersonaCard } from "./components/PersonaCard";
import { CartItem } from "./components/CartItem";
import { StarRating } from "./components/StarRating";
import type { Persona, CartItem as CartItemType } from "@acme/shared";
import React from "react";

// Mock @tanstack/react-router Link component
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, params, className, onClick }: any) => (
    <a href={to} data-params={JSON.stringify(params)} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

const mockPersona: Persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "Test description",
  avatarUrl: "https://example.com/avatar.png",
  specialty: "Engineering",
  capabilities: ["Code review", "Refactoring"],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro",
};

const mockCartItem: CartItemType = {
  id: "cart-1",
  personaId: "p-001",
  persona: mockPersona,
  quantity: 1,
};

describe("Frontend Component Bug Verification Tests", () => {
  describe("PersonaCard", () => {
    it("displays the correct monthly price without 100x multiplication bug", () => {
      render(<PersonaCard persona={mockPersona} />);
      // Should display $49.99/mo, NOT $4999.00/mo
      expect(screen.getByText("$49.99")).toBeDefined();
      expect(screen.queryByText("$4999.00")).toBeNull();
    });
  });

  describe("CartItem", () => {
    it("disables decrement button when quantity is 1", () => {
      const onUpdateQuantity = vi.fn();
      const onRemove = vi.fn();
      render(
        <CartItem
          item={mockCartItem}
          onUpdateQuantity={onUpdateQuantity}
          onRemove={onRemove}
        />
      );

      const decrementButton = screen.getByText("-") as HTMLButtonElement;
      expect(decrementButton.disabled).toBe(true);
    });
  });

  describe("StarRating", () => {
    it("renders rating without duplicate ID collisions", () => {
      const { container } = render(
        <div>
          <StarRating rating={4.8} />
          <StarRating rating={3.5} />
        </div>
      );
      const gradients = container.querySelectorAll("linearGradient");
      const ids = Array.from(gradients).map((g) => g.getAttribute("id"));
      // IDs should be unique, not all duplicated as "half"
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });
});
