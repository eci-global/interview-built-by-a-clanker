import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

const tokenStore = new Map<string, string>();

beforeEach(() => {
  tokenStore.clear();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => tokenStore.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => tokenStore.set(key, value)),
    removeItem: vi.fn((key: string) => tokenStore.delete(key)),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

describe("Given the API client has no auth token", () => {
  it("When a GET request succeeds, Then JSON is returned without an authorization header", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.get("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/health",
      expect.objectContaining({
        headers: {},
      }),
    );
  });

  it("When VITE_API_BASE_URL is configured, Then requests use the configured base URL", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ status: "ok" }));
    vi.stubGlobal("fetch", fetchMock);
    const { api: configuredApi } = await import("./api");

    await expect(configuredApi.get("/health")).resolves.toEqual({ status: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/health",
      expect.any(Object),
    );
  });
});

describe("Given the API client has an auth token", () => {
  it("When a POST request is sent, Then JSON body and bearer token are included", async () => {
    tokenStore.set("auth_token", "token-123");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.post("/cart", { personaId: "p-001" })).resolves.toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/cart",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ personaId: "p-001" }),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer token-123",
        },
      }),
    );
  });
});

describe("Given the API returns an error", () => {
  it("When the error body has a message, Then ApiError exposes status and message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: "Nope" }, { status: 400 })),
    );

    await expect(api.put("/cart/item", { quantity: 0 })).rejects.toMatchObject({
      status: 400,
      message: "Nope",
    });
  });

  it("When the error body is not JSON, Then a fallback message is used", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("broken", { status: 500 })),
    );

    await expect(api.delete("/cart/item")).rejects.toEqual(
      new ApiError(500, "Request failed: 500"),
    );
  });

  it("When a DELETE request has no body, Then no JSON content-type is sent", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.delete("/favorites/p-001")).resolves.toEqual({
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/favorites/p-001",
      expect.objectContaining({
        method: "DELETE",
        headers: {},
      }),
    );
  });
});
