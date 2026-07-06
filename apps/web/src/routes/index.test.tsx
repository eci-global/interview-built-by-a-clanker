/**
 * BUG-008: queryKey must include search params so TanStack Query refetches
 * when the user changes filters/search.
 *
 * Approach: mock @tanstack/react-query to capture useQuery calls, mock
 * @tanstack/react-router so createFileRoute returns a stub route whose
 * useSearch we can control, and stub child components that would otherwise
 * require router context to render. Then render BrowsePage twice with
 * different search values and assert the queryKey differs.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// --------------------------------------------------------------------------
// Captured calls storage — populated by the mocks below
// --------------------------------------------------------------------------
let capturedUseQueryCalls: unknown[][] = [];

// Search params injected by each test
let currentSearch: Record<string, unknown> = {};

// --------------------------------------------------------------------------
// Mock @tanstack/react-query
// --------------------------------------------------------------------------
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((opts: { queryKey: unknown[] }) => {
    capturedUseQueryCalls.push(opts.queryKey);
    return { data: [], isLoading: false };
  }),
}));

// --------------------------------------------------------------------------
// Mock @tanstack/react-router
//
// createFileRoute("/")({ component }) is called at module level and the
// returned object is stored as `Route`. BrowsePage calls Route.useSearch().
// We need that useSearch hook to return currentSearch so we can drive it
// from our tests.
// --------------------------------------------------------------------------
vi.mock("@tanstack/react-router", () => {
  const useSearch = vi.fn(() => currentSearch);
  const useNavigate = vi.fn(() => vi.fn());

  // createFileRoute returns a function that accepts route options.
  // We capture the `component` from the options and expose it on the
  // returned route object so tests can access it via Route.component.
  const createFileRoute = vi.fn(
    () => (opts: { component?: React.ComponentType }) => ({
      useSearch,
      component: opts?.component,
    }),
  );

  return { createFileRoute, useSearch, useNavigate, Link: () => null };
});

// --------------------------------------------------------------------------
// Stub child components that need router/query context we haven't set up
// --------------------------------------------------------------------------
vi.mock("~/components/PersonaCard", () => ({
  PersonaCard: () => React.createElement("div", null, "PersonaCard"),
}));
vi.mock("~/components/SearchBar", () => ({
  SearchBar: () => React.createElement("div", null, "SearchBar"),
}));
vi.mock("~/components/FilterPanel", () => ({
  FilterPanel: () => React.createElement("div", null, "FilterPanel"),
}));

// Stub api so queryFn doesn't make real network calls (it won't run anyway
// because useQuery itself is mocked, but guard against future changes)
vi.mock("~/lib/api", () => ({
  api: { get: vi.fn(() => Promise.resolve([])) },
}));

// --------------------------------------------------------------------------
// Import the component under test AFTER mocks are in place
// --------------------------------------------------------------------------
import { Route } from "./index";

describe("BUG-008 — queryKey includes search params", () => {
  beforeEach(() => {
    capturedUseQueryCalls = [];
  });

  it("passes a queryKey that includes the search object", () => {
    currentSearch = { q: "engineer", specialty: "Engineering" };

    const BrowsePage = Route.component as React.ComponentType;
    render(React.createElement(BrowsePage));

    expect(capturedUseQueryCalls.length).toBeGreaterThan(0);

    const key = capturedUseQueryCalls[0];
    // First element should still be the "personas" string discriminator
    expect(key[0]).toBe("personas");
    // Second element must be the search object so different searches →
    // different cache entries
    expect(key[1]).toEqual({ q: "engineer", specialty: "Engineering" });
  });

  it("produces a different queryKey for different search params", () => {
    // First render: search with q="engineer"
    currentSearch = { q: "engineer" };
    const BrowsePage = Route.component as React.ComponentType;
    render(React.createElement(BrowsePage));
    const firstKey = capturedUseQueryCalls[0];

    capturedUseQueryCalls = [];

    // Second render: search with q="designer"
    currentSearch = { q: "designer" };
    render(React.createElement(BrowsePage));
    const secondKey = capturedUseQueryCalls[0];

    // The two keys must differ so TanStack Query treats them as separate entries
    expect(firstKey).not.toEqual(secondKey);
  });

  it("produces identical queryKeys for identical search params (cache hit path)", () => {
    currentSearch = { specialty: "Security", tier: "Pro" };
    const BrowsePage = Route.component as React.ComponentType;
    render(React.createElement(BrowsePage));
    const keyA = capturedUseQueryCalls[0];

    capturedUseQueryCalls = [];

    currentSearch = { specialty: "Security", tier: "Pro" };
    render(React.createElement(BrowsePage));
    const keyB = capturedUseQueryCalls[0];

    expect(keyA).toEqual(keyB);
  });
});
