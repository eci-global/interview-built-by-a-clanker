import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { StarRating } from "./StarRating";

describe("StarRating (B23)", () => {
  it("gives each gradient a unique id across multiple instances", () => {
    const { container } = render(
      <div>
        <StarRating rating={4.5} />
        <StarRating rating={3.5} />
      </div>,
    );
    const ids = Array.from(container.querySelectorAll("linearGradient")).map(
      (g) => g.id,
    );
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(new Set(ids).size).toBe(ids.length); // all unique, no "half" clash
  });

  it("shows the numeric rating", () => {
    const { getByText } = render(<StarRating rating={4.8} />);
    expect(getByText("4.8")).toBeInTheDocument();
  });
});
