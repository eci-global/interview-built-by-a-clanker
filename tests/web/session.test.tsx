// @vitest-environment happy-dom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "../../apps/web/src/lib/auth";
import { queryClient } from "../../apps/web/src/lib/queryClient";
import { mount } from "../helpers/mount";

let controls: {
  login: (response: {
    token: string;
    user: { id: string; username: string; email: string };
  }) => void;
  logout: () => void;
} | null = null;

function Probe() {
  const auth = useAuth();
  controls = auth;
  return null;
}

afterEach(() => {
  controls = null;
  localStorage.clear();
  queryClient.clear();
  vi.unstubAllGlobals();
});

describe("sign out", () => {
  it("drops the saved token and cached cart and favorites", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "user-1",
            username: "ada",
            email: "ada@example.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const view = mount(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await act(async () => {
      controls!.login({
        token: "token-ada",
        user: { id: "user-1", username: "ada", email: "ada@example.com" },
      });
    });

    queryClient.setQueryData(["cart"], {
      items: [{ id: "cart-ada" }],
      total: 49.99,
    });
    queryClient.setQueryData(["favorites"], {
      favorites: [{ id: "p-001" }],
    });

    await act(async () => {
      controls!.logout();
    });

    expect.soft(localStorage.getItem("auth_token")).toBeNull();
    expect.soft(queryClient.getQueryData(["cart"])).toBeUndefined();
    expect.soft(queryClient.getQueryData(["favorites"])).toBeUndefined();

    view.unmount();
  });
});
