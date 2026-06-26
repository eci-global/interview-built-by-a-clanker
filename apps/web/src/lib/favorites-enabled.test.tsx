import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useQuery, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "./api";
import { favoritesQuery } from "./favorites";

vi.mock("./api", () => ({ api: { get: vi.fn().mockResolvedValue({ favorites: [] }) } }));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("favorites query gating (B17)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does NOT call /favorites when disabled (logged-out guest)", async () => {
    renderHook(() => useQuery({ ...favoritesQuery(), enabled: false }), {
      wrapper: wrapper(),
    });
    // Give react-query a tick; the fetch must never fire.
    await new Promise((r) => setTimeout(r, 20));
    expect(api.get).not.toHaveBeenCalled();
  });

  it("calls /favorites when enabled (authenticated user)", async () => {
    renderHook(() => useQuery({ ...favoritesQuery(), enabled: true }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(api.get).toHaveBeenCalledWith("/favorites"));
  });
});
