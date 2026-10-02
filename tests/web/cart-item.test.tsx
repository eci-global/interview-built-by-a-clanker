// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "../helpers/mount";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { CartItem } from "../../apps/web/src/components/CartItem";

const persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "Reviews code.",
  avatarUrl: "https://example.com/rex.svg",
  specialty: "Engineering" as const,
  capabilities: ["Code review"],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro" as const,
};

function renderItem(quantity: number, onUpdateQuantity: (quantity: number) => void) {
  return mount(
    <CartItem
      item={{ id: "cart-1", personaId: "p-001", persona, quantity }}
      onUpdateQuantity={onUpdateQuantity}
      onRemove={() => {}}
    />,
  );
}

describe("cart line quantity", () => {
  let unmount = () => {};

  afterEach(() => {
    unmount();
  });

  it("does not offer a quantity below 1", () => {
    const onUpdateQuantity = vi.fn();
    const view = renderItem(1, onUpdateQuantity);
    unmount = view.unmount;
    const [decrease] = view.container.querySelectorAll("button");

    expect(decrease?.hasAttribute("disabled") || (decrease as HTMLButtonElement).disabled).toBe(
      true,
    );

    act(() => {
      decrease?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateQuantity).not.toHaveBeenCalled();
  });

  it("decreases a quantity above 1 and can increase it", () => {
    const onUpdateQuantity = vi.fn();
    const view = renderItem(2, onUpdateQuantity);
    unmount = view.unmount;
    const [decrease, increase] = view.container.querySelectorAll("button");

    act(() => {
      decrease?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      increase?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onUpdateQuantity).toHaveBeenNthCalledWith(1, 1);
    expect(onUpdateQuantity).toHaveBeenNthCalledWith(2, 3);
  });
});
