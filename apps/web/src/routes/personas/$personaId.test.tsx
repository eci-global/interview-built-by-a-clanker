import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import type { Persona } from "@acme/shared";

// ---------------------------------------------------------------------------
// vi.hoisted() refs
// ---------------------------------------------------------------------------
const hoisted = vi.hoisted(() => {
  const mockApiPost = vi.fn();
  const mockApiDelete = vi.fn();
  const mockApiGet = vi.fn();
  const routeRef: { component: React.ComponentType | null } = { component: null };
  const mockUseQuery = vi.fn();
  const mockUseMutation = vi.fn();
  return { mockApiPost, mockApiDelete, mockApiGet, routeRef, mockUseQuery, mockUseMutation };
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("~/lib/api", () => ({
  api: {
    get: (...args: unknown[]) => hoisted.mockApiGet(...args),
    post: (...args: unknown[]) => hoisted.mockApiPost(...args),
    delete: (...args: unknown[]) => hoisted.mockApiDelete(...args),
  },
}));

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", username: "testuser", email: "test@example.com" },
    token: "fake-token",
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("~/lib/queryClient", () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: (_path: string) => (config: { component: React.ComponentType }) => {
    hoisted.routeRef.component = config.component;
    return {
      component: config.component,
      useParams: () => ({ personaId: "p-001" }),
    };
  },
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => hoisted.mockUseQuery(...args),
  useMutation: (...args: unknown[]) => hoisted.mockUseMutation(...args),
}));

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
import "./$personaId.tsx";

const { mockApiPost, mockApiDelete, routeRef, mockUseQuery, mockUseMutation } = hoisted;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const samplePersona: Persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "Test description.",
  avatarUrl: "https://example.com/avatar.svg",
  specialty: "Engineering",
  capabilities: ["Code review"],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro",
};

// ---------------------------------------------------------------------------
// Debug test — minimal check to see what happens when mutationFn runs
// ---------------------------------------------------------------------------
describe("BUG-012: favorite toggle calls correct api method", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiPost.mockResolvedValue({});
    mockApiDelete.mockResolvedValue({});
    hoisted.mockApiGet.mockResolvedValue({});
  });

  it("when NOT favorited: mutationFn calls api.post('/favorites', {personaId}) and NOT api.delete", async () => {
    if (!routeRef.component) {
      throw new Error("routeRef.component is null");
    }

    // Set up queries: not favorited
    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === "persona") return { data: samplePersona, isLoading: false };
      if (queryKey[0] === "favorites") return { data: { favorites: [] }, isLoading: false };
      return { data: undefined, isLoading: false };
    });

    let toggleFn: (() => Promise<unknown>) | null = null;
    let callIndex = 0;

    mockUseMutation.mockImplementation(
      ({ mutationFn }: { mutationFn: () => Promise<unknown> }) => {
        callIndex++;
        if (callIndex === 2) toggleFn = mutationFn;
        return { mutate: () => mutationFn(), isPending: false };
      }
    );

    const Component = routeRef.component;
    render(React.createElement(Component));

    // Should have called useMutation twice
    expect(mockUseMutation).toHaveBeenCalledTimes(2);
    expect(toggleFn, "toggleFn was not captured").not.toBeNull();

    // Call the raw mutationFn — no isFavorited=false captured yet
    // The component at render time had isFavorited=false (empty favorites array)
    // BUG: calls api.delete; correct code would call api.post
    await toggleFn!();

    // With the BUG: api.delete is called (wrong), api.post is not.
    // These assertions describe the CORRECT expected behavior:
    expect(hoisted.mockApiPost).toHaveBeenCalledOnce();
    expect(hoisted.mockApiPost).toHaveBeenCalledWith("/favorites", { personaId: "p-001" });
    expect(hoisted.mockApiDelete).not.toHaveBeenCalled();
  });

  it("when IS favorited: mutationFn calls api.delete('/favorites/p-001') and NOT api.post", async () => {
    if (!routeRef.component) {
      throw new Error("routeRef.component is null");
    }

    mockUseQuery.mockImplementation(({ queryKey }: { queryKey: unknown[] }) => {
      if (queryKey[0] === "persona") return { data: samplePersona, isLoading: false };
      if (queryKey[0] === "favorites") return { data: { favorites: [samplePersona] }, isLoading: false };
      return { data: undefined, isLoading: false };
    });

    let toggleFn: (() => Promise<unknown>) | null = null;
    let callIndex = 0;

    mockUseMutation.mockImplementation(
      ({ mutationFn }: { mutationFn: () => Promise<unknown> }) => {
        callIndex++;
        if (callIndex === 2) toggleFn = mutationFn;
        return { mutate: () => mutationFn(), isPending: false };
      }
    );

    const Component = routeRef.component;
    render(React.createElement(Component));

    expect(mockUseMutation).toHaveBeenCalledTimes(2);
    expect(toggleFn, "toggleFn was not captured").not.toBeNull();

    await toggleFn!();

    expect(hoisted.mockApiDelete).toHaveBeenCalledOnce();
    expect(hoisted.mockApiDelete).toHaveBeenCalledWith("/favorites/p-001");
    expect(hoisted.mockApiPost).not.toHaveBeenCalled();
  });
});

// BUG-016 — the detail page shared queryKey ["favorites"] with favorites.tsx but
// stored a *different* shape (string[] vs { favorites: Persona[] }) and had no
// enabled guard. Fix: same shape + enabled: !!user so the cache is consistent.
describe("BUG-016: favorites query is shape-consistent and auth-guarded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.mockApiGet.mockResolvedValue({ favorites: [samplePersona] });
  });

  it("uses enabled:!!user and a queryFn returning { favorites: Persona[] } (not a mapped string[])", async () => {
    if (!routeRef.component) throw new Error("routeRef.component is null");

    const captured: Record<
      string,
      { queryKey: unknown[]; enabled?: boolean; queryFn: () => Promise<unknown> }
    > = {};
    mockUseQuery.mockImplementation(
      (opts: {
        queryKey: unknown[];
        enabled?: boolean;
        queryFn: () => Promise<unknown>;
      }) => {
        captured[String(opts.queryKey[0])] = opts;
        if (opts.queryKey[0] === "persona")
          return { data: samplePersona, isLoading: false };
        if (opts.queryKey[0] === "favorites")
          return { data: { favorites: [] }, isLoading: false };
        return { data: undefined, isLoading: false };
      }
    );
    mockUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });

    render(React.createElement(routeRef.component));

    const fav = captured["favorites"];
    expect(fav, "no favorites query registered").toBeDefined();
    // enabled guard present — useAuth mock returns a logged-in user
    expect(fav.enabled).toBe(true);
    // queryFn returns the SAME shape favorites.tsx caches — not a string[]
    const result = await fav.queryFn();
    expect(result).toEqual({ favorites: [samplePersona] });
    expect(Array.isArray(result)).toBe(false);
  });
});
