import { describe, it, expect } from "vitest";
import { personasQuery } from "./personas";

describe("personasQuery", () => {
  it("includes the search params in the query key so filter changes refetch (B3)", () => {
    const a = personasQuery({});
    const b = personasQuery({ specialty: "Security" });
    const c = personasQuery({ specialty: "Security", sort: "price-asc" });

    // Distinct filter combinations must produce distinct cache keys.
    expect(a.queryKey).not.toEqual(b.queryKey);
    expect(b.queryKey).not.toEqual(c.queryKey);
    expect(a.queryKey[0]).toBe("personas");
    expect(a.queryKey[1]).toEqual({});
    expect(b.queryKey[1]).toEqual({ specialty: "Security" });
  });

  it("builds the request path from the filters", () => {
    expect(personasQuery({}).path).toBe("/personas");
    expect(personasQuery({ specialty: "Security" }).path).toBe(
      "/personas?specialty=Security",
    );
    expect(personasQuery({ q: "rex", sort: "rating-desc" }).path).toBe(
      "/personas?q=rex&sort=rating-desc",
    );
  });

  it("keeps a price bound of 0 instead of dropping it (B20)", () => {
    expect(personasQuery({ minPrice: 0 }).path).toBe("/personas?minPrice=0");
    expect(personasQuery({ maxPrice: 0 }).path).toBe("/personas?maxPrice=0");
  });
});
