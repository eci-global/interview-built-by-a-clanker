import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { buildApiTestApp } from "../test-utils.js";

describe("GET /personas", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApiTestApp();
  });

  after(async () => {
    await app.close();
  });

  it("returns all personas without filters", async () => {
    const response = await app.inject({ method: "GET", url: "/personas" });

    assert.equal(response.statusCode, 200);
    const personas = response.json<unknown[]>();
    assert.ok(personas.length > 0);
  });

  it("filters personas by search query", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?q=Rex",
    });

    assert.equal(response.statusCode, 200);
    const personas = response.json<{ name: string }[]>();
    assert.ok(personas.length >= 1);
    assert.ok(personas.every((p) => p.name.toLowerCase().includes("rex")));
  });

  it("filters personas by specialty", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?specialty=Security",
    });

    assert.equal(response.statusCode, 200);
    const personas = response.json<{ specialty: string }[]>();
    assert.ok(personas.length >= 1);
    assert.ok(personas.every((p) => p.specialty === "Security"));
  });

  it("filters personas by tier", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?tier=Enterprise",
    });

    assert.equal(response.statusCode, 200);
    const personas = response.json<{ tier: string }[]>();
    assert.ok(personas.length >= 1);
    assert.ok(personas.every((p) => p.tier === "Enterprise"));
  });

  it("combines search, specialty, and tier filters", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?q=Zara&specialty=Security&tier=Enterprise",
    });

    assert.equal(response.statusCode, 200);
    const personas = response.json<{ name: string; specialty: string; tier: string }[]>();
    assert.equal(personas.length, 1);
    assert.equal(personas[0]?.name, "Zero-Day Zara");
    assert.equal(personas[0]?.specialty, "Security");
    assert.equal(personas[0]?.tier, "Enterprise");
  });

  it("filters personas by minimum price", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/personas?minPrice=50",
    });

    assert.equal(response.statusCode, 200);
    const personas = response.json<{ price: number }[]>();
    assert.ok(personas.length > 0);
    assert.ok(personas.every((p) => p.price >= 50));
    assert.ok(personas.some((p) => p.price >= 89.99));
  });
});
