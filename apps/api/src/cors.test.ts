import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("CORS (B13)", () => {
  it("allows DELETE in preflight responses", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "OPTIONS",
      url: "/cart/cart-1",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "DELETE",
      },
    });
    // Browser preflight must advertise DELETE, or the browser blocks cart/
    // favorite removal cross-origin (web :5173 → api :3001).
    const allow = res.headers["access-control-allow-methods"] as string;
    expect(allow).toContain("DELETE");
  });
});
