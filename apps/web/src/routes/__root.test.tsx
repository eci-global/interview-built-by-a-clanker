/**
 * BUG-010: nav cart-count badge query used queryKey ["cart-count"] but the
 * cart page invalidates ["cart"]. Fix: badge query now uses ["cart"] so
 * cart mutations automatically bust the badge cache.
 *
 * Approach: mock @tanstack/react-query to capture useQuery calls; mock
 * @tanstack/react-router to provide createRootRoute (captures the component),
 * Link, Outlet, and useRouter stubs; mock ~/lib/auth's useAuth; mock ~/lib/api.
 * Then render RootLayout and assert that useQuery was called with queryKey ["cart"].
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// --------------------------------------------------------------------------
// Captured calls storage
// --------------------------------------------------------------------------
let capturedUseQueryCalls: Array<{ queryKey: unknown[]; enabled?: boolean }> =
  [];

// --------------------------------------------------------------------------
// Mock @tanstack/react-query
// --------------------------------------------------------------------------
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(
    (opts: { queryKey: unknown[]; enabled?: boolean; queryFn?: unknown }) => {
      capturedUseQueryCalls.push({ queryKey: opts.queryKey, enabled: opts.enabled });
      // Return a cart-shaped object so the component renders without crashing
      return {
        data: { items: [] },
        isLoading: false,
      };
    },
  ),
}));

// --------------------------------------------------------------------------
// Mock @tanstack/react-router
//
// createRootRoute({ component }) is called at module level; we capture the
// component and expose it on the returned object.  We also stub Link, Outlet,
// and useRouter so RootLayout can render without a real router context.
// --------------------------------------------------------------------------
vi.mock("@tanstack/react-router", () => {
  const createRootRoute = vi.fn(
    (opts: { component?: React.ComponentType }) => ({
      component: opts?.component,
    }),
  );

  const Link = vi.fn(
    ({
      children,
      ...rest
    }: React.PropsWithChildren<Record<string, unknown>>) => {
      void rest;
      return React.createElement("a", null, children);
    },
  );

  const Outlet = vi.fn(() => React.createElement("div", null));

  const useRouter = vi.fn(() => ({
    navigate: vi.fn(),
  }));

  return { createRootRoute, Link, Outlet, useRouter };
});

// --------------------------------------------------------------------------
// Mock ~/lib/auth — provide a logged-in user so `enabled: !!user` is true
// and useQuery IS called (validating the key even in the enabled branch)
// --------------------------------------------------------------------------
vi.mock("~/lib/auth", () => ({
  useAuth: vi.fn(() => ({
    user: { id: "u1", username: "testuser" },
    logout: vi.fn(),
  })),
}));

// --------------------------------------------------------------------------
// Mock ~/lib/api
// --------------------------------------------------------------------------
vi.mock("~/lib/api", () => ({
  api: { get: vi.fn(() => Promise.resolve({ items: [] })) },
}));

// --------------------------------------------------------------------------
// Import AFTER mocks
// --------------------------------------------------------------------------
import { Route } from "./__root";

describe("BUG-010 — badge query uses shared [\"cart\"] key", () => {
  beforeEach(() => {
    capturedUseQueryCalls = [];
  });

  it("calls useQuery with queryKey [\"cart\"] (not [\"cart-count\"])", () => {
    const RootLayout = Route.component as React.ComponentType;
    render(React.createElement(RootLayout));

    // There should be exactly one useQuery call from RootLayout
    expect(capturedUseQueryCalls.length).toBeGreaterThan(0);

    // Find the cart badge query
    const cartQuery = capturedUseQueryCalls.find(
      (c) =>
        Array.isArray(c.queryKey) &&
        c.queryKey.length === 1 &&
        c.queryKey[0] === "cart",
    );

    expect(
      cartQuery,
      'Expected a useQuery call with queryKey ["cart"] but none found. ' +
        `Actual calls: ${JSON.stringify(capturedUseQueryCalls)}`,
    ).toBeDefined();
  });

  it("does NOT call useQuery with queryKey [\"cart-count\"] (old broken key)", () => {
    const RootLayout = Route.component as React.ComponentType;
    render(React.createElement(RootLayout));

    const staleQuery = capturedUseQueryCalls.find(
      (c) =>
        Array.isArray(c.queryKey) &&
        c.queryKey.some((k) => k === "cart-count"),
    );

    expect(
      staleQuery,
      'useQuery was called with the old stale key ["cart-count"] — fix not applied',
    ).toBeUndefined();
  });

  it("passes enabled: !!user so the query only fires when logged in", () => {
    const RootLayout = Route.component as React.ComponentType;
    render(React.createElement(RootLayout));

    const cartQuery = capturedUseQueryCalls.find(
      (c) => Array.isArray(c.queryKey) && c.queryKey[0] === "cart",
    );
    // With a logged-in user mocked above, enabled should be true
    expect(cartQuery?.enabled).toBe(true);
  });
});
