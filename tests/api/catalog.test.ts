import { describe, expect, it } from "vitest";
import { useApp } from "../helpers/app";

type Persona = { id: string; name: string; price: number; rating: number };

const getApp = useApp();

function ids(personas: Persona[]) {
  return personas.map((persona) => persona.id).sort();
}

describe("persona catalog", () => {
  it("lists the seeded catalog with monthly prices", async () => {
    const res = await getApp().inject({ method: "GET", url: "/personas" });
    const personas = res.json() as Persona[];

    expect(res.statusCode).toBe(200);
    expect(personas).toHaveLength(15);
    expect(personas.find((persona) => persona.id === "p-001")?.price).toBe(49.99);
  });

  it("returns one persona and 404 for an unknown id", async () => {
    const app = getApp();
    const found = await app.inject({ method: "GET", url: "/personas/p-002" });
    const missing = await app.inject({ method: "GET", url: "/personas/missing" });

    expect(found.statusCode).toBe(200);
    expect(found.json()).toMatchObject({ name: "Zero-Day Zara", price: 89.99 });
    expect(missing.statusCode).toBe(404);
  });

  it("searches name, tagline, description, and capabilities without case sensitivity", async () => {
    const app = getApp();
    const byName = await app.inject({ method: "GET", url: "/personas?q=ZARA" });
    const byCapability = await app.inject({
      method: "GET",
      url: "/personas?q=OWASP",
    });

    expect(ids(byName.json())).toEqual(["p-002"]);
    expect(ids(byCapability.json())).toEqual(["p-002"]);
  });

  it("filters by specialty and tier", async () => {
    const app = getApp();
    const engineering = await app.inject({
      method: "GET",
      url: "/personas?specialty=Engineering&tier=Pro",
    });

    expect(ids(engineering.json())).toEqual(["p-001", "p-013", "p-014"]);
  });

  it("sorts by price, rating, and name", async () => {
    const app = getApp();
    const byPrice = (await app.inject({
      method: "GET",
      url: "/personas?sort=price-asc",
    })).json() as Persona[];
    const byRating = (await app.inject({
      method: "GET",
      url: "/personas?sort=rating-desc",
    })).json() as Persona[];
    const byName = (await app.inject({
      method: "GET",
      url: "/personas?sort=name-asc",
    })).json() as Persona[];

    expect(byPrice[0]?.id).toBe("p-012");
    expect(byPrice.at(-1)?.id).toBe("p-011");
    expect(byRating[0]?.rating).toBe(4.9);
    expect(byName[0]?.name).toBe("A11y Alex");
  });

  it("keeps personas at or above the minimum price", async () => {
    const res = await getApp().inject({
      method: "GET",
      url: "/personas?minPrice=80",
    });

    expect(ids(res.json())).toEqual(["p-002", "p-011"]);
  });

  it("keeps personas at or below the maximum price", async () => {
    const res = await getApp().inject({
      method: "GET",
      url: "/personas?maxPrice=40",
    });

    expect(ids(res.json())).toEqual(["p-009", "p-012"]);
  });

  it("applies a minimum and maximum price together", async () => {
    const res = await getApp().inject({
      method: "GET",
      url: "/personas?minPrice=70&maxPrice=90",
    });

    expect(ids(res.json())).toEqual(["p-002", "p-008"]);
  });

  it("ignores or rejects a non-numeric minimum price", async () => {
    const res = await getApp().inject({
      method: "GET",
      url: "/personas?minPrice=abc",
    });

    expect([200, 400]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.json()).toHaveLength(15);
    }
  });
});
