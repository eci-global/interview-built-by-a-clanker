import { describe, it, expect, vi, beforeEach } from "vitest";
import { api } from "./api";
import { toggleFavoriteRequest } from "./favorites";

vi.mock("./api", () => ({
  api: { post: vi.fn(), delete: vi.fn() },
}));

describe("toggleFavoriteRequest (B4)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ADDS (POST) when the persona is not yet favorited", () => {
    toggleFavoriteRequest(false, "p-001");
    expect(api.post).toHaveBeenCalledWith("/favorites", { personaId: "p-001" });
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("REMOVES (DELETE) when the persona is already favorited", () => {
    toggleFavoriteRequest(true, "p-001");
    expect(api.delete).toHaveBeenCalledWith("/favorites/p-001");
    expect(api.post).not.toHaveBeenCalled();
  });
});
