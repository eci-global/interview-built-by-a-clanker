import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthResponse } from "@acme/shared";
import { AuthProvider, useAuth } from "./auth";

const apiGet = vi.fn();

vi.mock("./api", () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

afterEach(() => {
  cleanup();
});

function Harness() {
  const { user, token, isLoading, login, logout } = useAuth();
  const response: AuthResponse = {
    token: "token-123",
    user: { id: "user-1", username: "jane", email: "jane@example.com" },
  };
  const expiredResponse: AuthResponse = {
    token: "expired-token",
    user: { id: "user-1", username: "jane", email: "jane@example.com" },
  };

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="user">{user?.username ?? "none"}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <button onClick={() => login(response)}>login</button>
      <button onClick={() => login(expiredResponse)}>login expired</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe("Given the auth provider has no stored token", () => {
  beforeEach(() => {
    localStorage.clear();
    apiGet.mockReset();
    apiGet.mockResolvedValue({
      id: "user-1",
      username: "jane",
      email: "jane@example.com",
    });
  });

  it("When login and logout are used, Then token and user state stay synchronized", async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("jane");
      expect(screen.getByTestId("token").textContent).toBe("token-123");
    });
    expect(localStorage.getItem("auth_token")).toBe("token-123");

    fireEvent.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("none");
      expect(screen.getByTestId("token").textContent).toBe("none");
    });
    expect(localStorage.getItem("auth_token")).toBeNull();
  });
});

describe("Given the auth provider has a stored token", () => {
  beforeEach(() => {
    localStorage.clear();
    apiGet.mockReset();
  });

  it("When the app starts, Then /auth/me hydrates the user", async () => {
    localStorage.setItem("auth_token", "stored-token");
    apiGet.mockResolvedValue({
      id: "user-1",
      username: "stored",
      email: "stored@example.com",
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    expect(apiGet).toHaveBeenCalledWith("/auth/me");
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("stored");
      expect(screen.getByTestId("loading").textContent).toBe("false");
    });
  });

  it("When a stored token is rejected after a user is present, Then stale user state is cleared", async () => {
    const { ApiError } = await import("./api");
    apiGet.mockResolvedValue({
      id: "user-1",
      username: "jane",
      email: "jane@example.com",
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("loading").textContent).toBe("false"),
    );

    fireEvent.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() => {
      expect(screen.getByTestId("user").textContent).toBe("jane");
      expect(screen.getByTestId("token").textContent).toBe("token-123");
    });

    apiGet.mockRejectedValue(new ApiError(401, "Unauthorized"));
    fireEvent.click(screen.getByRole("button", { name: "login expired" }));

    await waitFor(() => {
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(screen.getByTestId("user").textContent).toBe("none");
      expect(screen.getByTestId("token").textContent).toBe("none");
    });
  });
});
