import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";

describe("GET /personas (B21 — validate via shared schema)", () => {
  it("applies valid filters", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/personas?specialty=Security",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().every((p: { specialty: string }) => p.specialty === "Security")).toBe(true);
  });

  it("coerces numeric price params from the query string", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/personas?minPrice=80" });
    expect(res.statusCode).toBe(200);
    expect(res.json().every((p: { price: number }) => p.price >= 80)).toBe(true);
  });

  it("rejects an invalid enum value with 400 instead of silently returning []", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/personas?specialty=Nonsense",
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects an invalid sort with 400", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/personas?sort=bogus" });
    expect(res.statusCode).toBe(400);
  });
});
