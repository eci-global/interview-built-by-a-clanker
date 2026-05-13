import { describe, expect, it } from "vitest";
import { favoriteToggleRequest } from "./favorites";

describe("Given a persona is not favorited", () => {
  it("When the favorite button is clicked, Then the frontend posts a new favorite", () => {
    expect(favoriteToggleRequest(false, "p-001")).toEqual({
      method: "POST",
      path: "/favorites",
      body: { personaId: "p-001" },
    });
  });
});

describe("Given a persona is already favorited", () => {
  it("When the favorite button is clicked, Then the frontend deletes the favorite", () => {
    expect(favoriteToggleRequest(true, "p-001")).toEqual({
      method: "DELETE",
      path: "/favorites/p-001",
    });
  });
});
