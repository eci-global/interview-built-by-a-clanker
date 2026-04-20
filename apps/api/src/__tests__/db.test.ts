import { describe, it, expect } from "vitest";
import { db } from "../db.js";

describe("db.personas.search — price filters", () => {
  it("minPrice returns only personas at or above the minimum", () => {
    const results = db.personas.search({ minPrice: 70 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(70);
    }
  });

  it("maxPrice returns only personas at or below the maximum", () => {
    const results = db.personas.search({ maxPrice: 50 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeLessThanOrEqual(50);
    }
  });

  it("minPrice + maxPrice returns personas within range", () => {
    const results = db.personas.search({ minPrice: 50, maxPrice: 70 });
    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.price).toBeGreaterThanOrEqual(50);
      expect(p.price).toBeLessThanOrEqual(70);
    }
  });

  it("excludes personas below minPrice", () => {
    const all = db.personas.getAll();
    const cheapest = Math.min(...all.map((p) => p.price));
    const results = db.personas.search({ minPrice: cheapest + 1 });
    const excluded = all.filter((p) => p.price < cheapest + 1);
    for (const ex of excluded) {
      expect(results.find((r) => r.id === ex.id)).toBeUndefined();
    }
  });
});
