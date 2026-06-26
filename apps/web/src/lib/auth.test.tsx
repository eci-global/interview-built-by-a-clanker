import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth";

// AuthProvider calls api.get("/auth/me") when a token exists; stub it.
vi.mock("./api", () => ({
  api: { get: vi.fn().mockResolvedValue({ id: "u1", username: "a", email: "e@x.com" }) },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthProvider logout (B12)", () => {
  beforeEach(() => localStorage.clear());

  it("removes the token from localStorage on logout", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login({
        token: "tok-123",
        user: { id: "u1", username: "a", email: "e@x.com" },
      });
    });
    expect(localStorage.getItem("auth_token")).toBe("tok-123");
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => result.current.logout());

    // Regression: logout must clear the persisted token, otherwise a reload
    // reads it back and silently logs the user back in.
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(result.current.user).toBeNull();
  });
});
