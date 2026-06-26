import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("smoke: app boots", () => {
  it("responds to /health and serves personas", async () => {
    const app = await buildApp();
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });

    const personas = await app.inject({ method: "GET", url: "/personas" });
    expect(personas.statusCode).toBe(200);
    expect(personas.json().length).toBe(15);
  });
});
