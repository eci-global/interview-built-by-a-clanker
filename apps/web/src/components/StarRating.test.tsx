import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StarRating } from "./StarRating";

describe("Given a fractional rating", () => {
  it("When the rating renders, Then full, partial, and empty stars are represented", () => {
    const html = renderToStaticMarkup(<StarRating rating={3.5} size="sm" />);

    expect(html).toContain("3.5");
    expect(html).toContain("w-4 h-4");
    expect(html).toContain("url(#");
    expect(html).toContain('offset="50%"');
    expect(html).toContain('fill="none"');
  });

  it("When multiple ratings render, Then partial star gradient IDs are unique", () => {
    const html = renderToStaticMarkup(
      <div>
        <StarRating rating={3.5} />
        <StarRating rating={4.5} />
      </div>,
    );
    const gradientIds = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(gradientIds).toHaveLength(2);
    expect(new Set(gradientIds).size).toBe(2);
    for (const id of gradientIds) {
      expect(html).toContain(`url(#${id})`);
    }
  });
});
