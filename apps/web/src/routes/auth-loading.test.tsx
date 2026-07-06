import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// BUG-018 — cart/checkout/favorites gate on `if (!user)` and ignore the auth
// provider's `isLoading`, so a logged-in user hard-loading these pages sees the
// "Sign in" prompt during the /auth/me round-trip. Here we simulate that window
// (user still null, isLoading true) and assert the sign-in prompt is NOT shown.

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (cfg: { component: React.ComponentType }) => ({
    component: cfg.component,
  }),
  Link: ({ children }: { children: React.ReactNode }) =>
    React.createElement("a", null, children),
  useNavigate: () => vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: null, isLoading: true, logout: vi.fn(), login: vi.fn() }),
}));

vi.mock("~/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock("~/lib/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn(), clear: vi.fn() },
}));
vi.mock("~/components/CartItem", () => ({
  CartItem: () => React.createElement("div"),
}));
vi.mock("~/components/PersonaCard", () => ({
  PersonaCard: () => React.createElement("div"),
}));

import { Route as CartRoute } from "./cart";
import { Route as CheckoutRoute } from "./checkout";
import { Route as FavoritesRoute } from "./favorites";

describe("BUG-018: auth isLoading suppresses the sign-in prompt", () => {
  const cases: Array<[string, { component?: React.ComponentType }, RegExp]> = [
    ["cart", CartRoute, /sign in to view your cart/i],
    ["checkout", CheckoutRoute, /sign in to checkout/i],
    ["favorites", FavoritesRoute, /sign in to view favorites/i],
  ];

  it.each(cases)(
    "%s does not show the sign-in prompt while auth is loading",
    (_name, route, signInText) => {
      const Component = route.component as React.ComponentType;
      render(React.createElement(Component));
      expect(screen.queryByText(signInText)).toBeNull();
    }
  );
});
