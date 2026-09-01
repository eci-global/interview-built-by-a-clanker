import { describe, expect, it } from "vitest";
import { getFavoriteToggleAction } from "./favorites";

describe("getFavoriteToggleAction", () => {
  it("posts when the persona is not favorited", () => {
    expect(getFavoriteToggleAction(false, "p-001")).toEqual({
      method: "POST",
      path: "/favorites",
      body: { personaId: "p-001" },
    });
  });

  it("deletes when the persona is already favorited", () => {
    expect(getFavoriteToggleAction(true, "p-001")).toEqual({
      method: "DELETE",
      path: "/favorites/p-001",
    });
  });
});
