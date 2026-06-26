import { describe, it, expect } from "vitest";
import { tierColors } from "./tiers";

describe("tierColors (B24)", () => {
  it("defines a class string for every tier", () => {
    expect(Object.keys(tierColors).sort()).toEqual([
      "Enterprise",
      "Pro",
      "Starter",
    ]);
    for (const cls of Object.values(tierColors)) {
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
    }
  });
});
