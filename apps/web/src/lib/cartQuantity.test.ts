import { describe, expect, it } from "vitest";
import { getNextCartQuantity } from "./cartQuantity";

describe("getNextCartQuantity", () => {
  it("decrements quantity when above one", () => {
    expect(getNextCartQuantity(3, -1)).toBe(2);
  });

  it("does not allow quantity below one when decrementing", () => {
    expect(getNextCartQuantity(1, -1)).toBeNull();
  });

  it("increments quantity", () => {
    expect(getNextCartQuantity(1, 1)).toBe(2);
  });
});
