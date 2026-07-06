import { describe, it, expect } from "vitest";
import { personaSchema } from "./schemas/persona.js";

// BUG-014 — bare z.string() / z.number() validators on avatarUrl, price, reviewCount
// allow invalid values that break <img src>, cart totals, and review counts.

const validPersona = {
  id: "persona-1",
  name: "Alex Engineer",
  tagline: "Full-stack wizard",
  description: "Builds end-to-end systems with precision.",
  avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  specialty: "Engineering" as const,
  capabilities: ["TypeScript", "React", "Node.js"],
  price: 99,
  rating: 4.5,
  reviewCount: 42,
  tier: "Pro" as const,
};

describe("BUG-014: personaSchema rejects invalid avatarUrl, price, reviewCount", () => {
  it("accepts a fully-valid persona", () => {
    const result = personaSchema.safeParse(validPersona);
    expect(result.success).toBe(true);
  });

  it("rejects avatarUrl that is not a URL", () => {
    const result = personaSchema.safeParse({ ...validPersona, avatarUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects negative price", () => {
    const result = personaSchema.safeParse({ ...validPersona, price: -10 });
    expect(result.success).toBe(false);
  });

  it("rejects zero price", () => {
    const result = personaSchema.safeParse({ ...validPersona, price: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects negative reviewCount", () => {
    const result = personaSchema.safeParse({ ...validPersona, reviewCount: -3 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer reviewCount (float)", () => {
    const result = personaSchema.safeParse({ ...validPersona, reviewCount: 2.5 });
    expect(result.success).toBe(false);
  });
});
