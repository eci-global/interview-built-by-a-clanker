import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Persona } from "@acme/shared";
import { api } from "./api";
import {
  toggleFavoriteRequest,
  favoritesQuery,
  isPersonaFavorited,
} from "./favorites";

vi.mock("./api", () => ({
  api: { post: vi.fn(), delete: vi.fn() },
}));

const persona = (id: string) => ({ id }) as Persona;

describe("favoritesQuery / isPersonaFavorited (B11)", () => {
  it("exposes a single canonical key and shape", () => {
    expect(favoritesQuery().queryKey).toEqual(["favorites"]);
  });

  it("checks membership against the canonical { favorites: Persona[] } shape", () => {
    const data = { favorites: [persona("p-001"), persona("p-005")] };
    expect(isPersonaFavorited(data, "p-001")).toBe(true);
    expect(isPersonaFavorited(data, "p-999")).toBe(false);
    expect(isPersonaFavorited(undefined, "p-001")).toBe(false);
  });
});

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
