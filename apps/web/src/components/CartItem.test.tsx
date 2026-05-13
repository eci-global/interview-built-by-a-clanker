import type { ReactNode } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CartItem as CartItemType } from "@acme/shared";
import { CartItem } from "./CartItem";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const item: CartItemType = {
  id: "cart-1",
  personaId: "p-001",
  quantity: 2,
  persona: {
    id: "p-001",
    name: "Refactor Rex",
    tagline: "Your relentless code reviewer",
    description: "Reviews code",
    avatarUrl: "https://example.com/rex.svg",
    specialty: "Engineering",
    capabilities: ["Code review"],
    price: 49.99,
    rating: 4.8,
    reviewCount: 234,
    tier: "Pro",
  },
};

describe("Given a cart item", () => {
  it("When quantity controls are used, Then update and remove callbacks are called", () => {
    const onUpdateQuantity = vi.fn();
    const onRemove = vi.fn();

    render(
      <CartItem
        item={item}
        onUpdateQuantity={onUpdateQuantity}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "-" }));
    fireEvent.click(screen.getByRole("button", { name: "+" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(onUpdateQuantity).toHaveBeenNthCalledWith(1, 1);
    expect(onUpdateQuantity).toHaveBeenNthCalledWith(2, 3);
    expect(onRemove).toHaveBeenCalledOnce();
    expect(screen.getByText("$99.98")).toBeTruthy();
  });

  it("When quantity is one, Then decrement is disabled", () => {
    const { container } = render(
      <CartItem
        item={{ ...item, quantity: 1 }}
        onUpdateQuantity={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(
      (within(container).getByRole("button", { name: "-" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
