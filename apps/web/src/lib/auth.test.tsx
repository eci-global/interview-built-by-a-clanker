import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./auth";
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
