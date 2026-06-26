import { describe, it, expect } from "vitest";
import { db } from "./db.js";

describe("db.personas.search price filters (B5)", () => {
  it("minPrice keeps personas priced AT OR ABOVE the threshold", () => {
    const results = db.personas.search({ minPrice: 80 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.price >= 80)).toBe(true);
    // Seed data has exactly two personas priced >= 80 (89.99 and 99.99).
    expect(results.map((p) => p.price).sort()).toEqual([89.99, 99.99]);
  });

  it("maxPrice keeps personas priced at or below the threshold", () => {
    const results = db.personas.search({ maxPrice: 40 });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.price <= 40)).toBe(true);
  });

  it("min and max together form a band", () => {
    const results = db.personas.search({ minPrice: 60, maxPrice: 70 });
    expect(results.every((p) => p.price >= 60 && p.price <= 70)).toBe(true);
  });
});
