import { describe, expect, it } from "vitest";
import { buildPersonaQueryString, personaQueryKey } from "./personaSearch";

describe("Given catalog search parameters", () => {
  it("When numeric filters are zero, Then they are retained in the query string", () => {
    expect(buildPersonaQueryString({ minPrice: 0, maxPrice: 0 })).toBe(
      "minPrice=0&maxPrice=0",
    );
  });

  it("When the query string changes, Then the query key changes too", () => {
    expect(personaQueryKey("q=security")).not.toEqual(personaQueryKey("q=data"));
  });
});
