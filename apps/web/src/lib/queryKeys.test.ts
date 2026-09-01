import { describe, expect, it } from "vitest";
import {
  AUTHENTICATED_QUERY_KEYS,
  CART_QUERY_KEY,
  FAVORITES_IDS_QUERY_KEY,
  FAVORITES_LIST_QUERY_KEY,
  buildPersonasQueryPath,
  personasQueryKey,
} from "./queryKeys";

describe("queryKeys", () => {
  it("uses a unified cart query key across the app", () => {
    expect(CART_QUERY_KEY).toEqual(["cart"]);
  });

  it("uses separate favorites query keys for list and ids", () => {
    expect(FAVORITES_LIST_QUERY_KEY).toEqual(["favorites", "list"]);
    expect(FAVORITES_IDS_QUERY_KEY).toEqual(["favorites", "ids"]);
    expect(FAVORITES_LIST_QUERY_KEY).not.toEqual(FAVORITES_IDS_QUERY_KEY);
  });

  it("lists authenticated query keys cleared on logout", () => {
    expect(AUTHENTICATED_QUERY_KEYS).toEqual(
      expect.arrayContaining([CART_QUERY_KEY, FAVORITES_LIST_QUERY_KEY, FAVORITES_IDS_QUERY_KEY]),
    );
  });

  it("includes search params in the personas query key", () => {
    const search = { q: "Rex", specialty: "Engineering", tier: "Pro" };
    expect(personasQueryKey(search)).toEqual(["personas", search]);
  });

  it("changes the personas query key when search params change", () => {
    const first = personasQueryKey({ q: "Rex" });
    const second = personasQueryKey({ q: "Zara" });
    expect(first).not.toEqual(second);
  });

  it("builds API paths from search params", () => {
    expect(buildPersonasQueryPath({ q: "Rex", specialty: "Engineering" })).toBe(
      "/personas?q=Rex&specialty=Engineering",
    );
    expect(buildPersonasQueryPath({})).toBe("/personas");
  });
});
