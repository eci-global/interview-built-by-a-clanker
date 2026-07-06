import { describe, it, expect, afterEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";
import type { Persona } from "@acme/shared";

// BUG-002 — minPrice filter uses `<=` instead of `>=`, so it excludes
// expensive personas instead of cheap ones.
describe("BUG-002: GET /personas?minPrice only returns personas at or above minPrice", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app?.close();
  });

  it("returns only personas with price >= 60 when minPrice=60", async () => {
    app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/personas?minPrice=60" });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ personas: Persona[] }>();
    const list: Persona[] = Array.isArray(body) ? body : body.personas ?? [];
    expect(list.length).toBeGreaterThan(0);

    for (const p of list) {
      expect(p.price).toBeGreaterThanOrEqual(60);
    }

    // Zero-Day Zara (p-002) has price 89.99 — must be present
    const zara = list.find((p) => p.id === "p-002");
    expect(zara).toBeDefined();

    // A11y Alex (p-009) has price 39.99 — must be absent
    const alex = list.find((p) => p.id === "p-009");
    expect(alex).toBeUndefined();
  });

  it("returns a band minPrice=60&maxPrice=90 — all prices in [60, 90]", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/personas?minPrice=60&maxPrice=90",
    });
    expect(res.statusCode).toBe(200);

    const body = res.json<{ personas: Persona[] }>();
    const list: Persona[] = Array.isArray(body) ? body : body.personas ?? [];
    expect(list.length).toBeGreaterThan(0);

    for (const p of list) {
      expect(p.price).toBeGreaterThanOrEqual(60);
      expect(p.price).toBeLessThanOrEqual(90);
    }

    // Compliance Carl (p-011) has price 99.99 — must be excluded by maxPrice=90
    const carl = list.find((p) => p.id === "p-011");
    expect(carl).toBeUndefined();
  });
});
