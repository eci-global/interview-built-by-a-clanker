import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api } from "./api";

function okResponse(body: unknown = {}) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response;
}

describe("api request headers (B9)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function headersOf(callIndex = 0): Record<string, string> {
    return fetchMock.mock.calls[callIndex][1].headers as Record<string, string>;
  }

  it("does NOT send a JSON content-type on a bodyless DELETE", async () => {
    // Fastify rejects an empty body with `Content-Type: application/json`
    // (FST_ERR_CTP_EMPTY_JSON_BODY → 400), which broke cart/favorite removal.
    await api.delete("/favorites/p-001");
    expect(headersOf()).not.toHaveProperty("Content-Type");
  });

  it("does NOT send a JSON content-type on a bodyless POST", async () => {
    await api.post("/some/action");
    expect(headersOf()).not.toHaveProperty("Content-Type");
  });

  it("DOES send a JSON content-type when there is a body", async () => {
    await api.post("/cart", { personaId: "p-001", quantity: 1 });
    expect(headersOf()["Content-Type"]).toBe("application/json");
  });

  it("attaches the bearer token when present", async () => {
    localStorage.setItem("auth_token", "tok123");
    await api.get("/cart");
    expect(headersOf()["Authorization"]).toBe("Bearer tok123");
  });
});
