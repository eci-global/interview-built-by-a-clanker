import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";
import { queryClient } from "./queryClient";
import type { ReactNode } from "react";

// Mock ~/lib/api so the mount effect never makes real HTTP calls
vi.mock("~/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

// BUG-009 — logout must remove the persisted token from localStorage
describe("BUG-009: logout clears localStorage auth_token", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("logout removes auth_token from localStorage", async () => {
    // Arrange: seed localStorage so the provider initialises with a token
    localStorage.setItem("auth_token", "x");

    // The mock api.get resolves so the mount effect doesn't error
    const { api } = await import("~/lib/api");
    vi.mocked(api.get).mockResolvedValue({ id: "u1", username: "test", email: "t@t.com" });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Wait for the loading effect to settle
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Act: call logout
    act(() => {
      result.current.logout();
    });

    // Assert: localStorage token removed
    expect(localStorage.getItem("auth_token")).toBeNull();
  });

  it("logout sets context token and user to null", async () => {
    localStorage.setItem("auth_token", "x");

    const { api } = await import("~/lib/api");
    vi.mocked(api.get).mockResolvedValue({ id: "u1", username: "test", email: "t@t.com" });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });
});

// BUG-017 — logout must evict the React Query cache so a subsequent user
// on the same session cannot see the previous user's cart/favorites data.
describe("BUG-017: logout clears the React Query cache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("evicts cached user-scoped queries on logout", async () => {
    localStorage.setItem("auth_token", "x");

    const { api } = await import("~/lib/api");
    vi.mocked(api.get).mockResolvedValue({ id: "u1", username: "test", email: "t@t.com" });

    // Seed the cache as if user A had loaded their cart + favorites
    queryClient.setQueryData(["cart"], { items: [{ id: "c1" }], total: 10 });
    queryClient.setQueryData(["favorites"], { favorites: [{ id: "p-001" }] });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Precondition: cache is populated
    expect(queryClient.getQueryData(["cart"])).toBeDefined();
    expect(queryClient.getQueryData(["favorites"])).toBeDefined();

    act(() => {
      result.current.logout();
    });

    // The prior user's data must be gone
    expect(queryClient.getQueryData(["cart"])).toBeUndefined();
    expect(queryClient.getQueryData(["favorites"])).toBeUndefined();
  });
});
