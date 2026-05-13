import { describe, expect, it } from "vitest";
import { cartQueryKey } from "./cartKeys";

describe("Given cart state is used in multiple UI locations", () => {
  it("When cart queries are referenced, Then they share one canonical cache key", () => {
    expect(cartQueryKey).toEqual(["cart"]);
  });
});
