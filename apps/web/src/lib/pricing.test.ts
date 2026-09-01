import { describe, expect, it } from "vitest";
import { formatPersonaMonthlyPrice } from "./pricing";

describe("formatPersonaMonthlyPrice", () => {
  it("formats stored monthly price without scaling", () => {
    expect(formatPersonaMonthlyPrice(49.99)).toBe("49.99");
  });

  it("does not multiply price by 100", () => {
    expect(formatPersonaMonthlyPrice(49.99)).not.toBe("4999.00");
  });
});
