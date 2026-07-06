import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StarRating } from "./StarRating";

// BUG-019 — the partial-star <linearGradient> used a static id="half". SVG ids
// are document-global, so multiple StarRatings on one page (the browse grid)
// created duplicate ids and every url(#half) resolved to a single gradient.
describe("BUG-019: StarRating gradient ids are unique across instances", () => {
  it("gives each fractional star its own gradient id when several are on the page", () => {
    const { container } = render(
      <div>
        <StarRating rating={3.3} />
        <StarRating rating={4.7} />
      </div>
    );

    const gradients = Array.from(container.querySelectorAll("linearGradient"));
    // 3.3 and 4.7 each have exactly one fractional star
    expect(gradients.length).toBeGreaterThanOrEqual(2);

    const ids = gradients.map((g) => g.getAttribute("id"));
    expect(ids.every(Boolean)).toBe(true); // none empty/null
    expect(new Set(ids).size).toBe(ids.length); // all unique
  });
});
