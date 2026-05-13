import { describe, expect, it } from "vitest";
import { formatMonthlyPrice } from "./format";

describe("Given a persona price", () => {
  it("When the monthly price is formatted, Then the value is not multiplied", () => {
    expect(formatMonthlyPrice(49.99)).toBe("$49.99");
  });
});
