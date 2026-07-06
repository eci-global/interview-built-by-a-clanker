import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PersonaCard } from "./PersonaCard";
import type { Persona } from "@acme/shared";

vi.mock("@tanstack/react-router", () => ({
  Link: (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: unknown }) => (
    <a href={typeof props.to === "string" ? props.to : "#"} {...props} />
  ),
}));

vi.mock("./StarRating", () => ({
  StarRating: ({ rating }: { rating: number; size?: string }) => (
    <span data-testid="star-rating">{rating}</span>
  ),
}));

const testPersona: Persona = {
  id: "persona-1",
  name: "Test Persona",
  tagline: "A great test persona",
  description: "Detailed description here",
  avatarUrl: "https://example.com/avatar.png",
  specialty: "Engineering",
  capabilities: ["TypeScript", "React", "Node.js"],
  price: 20,
  rating: 4.5,
  reviewCount: 42,
  tier: "Pro",
};

describe("PersonaCard", () => {
  it("displays price in dollars without 100x multiplier", () => {
    render(<PersonaCard persona={testPersona} />);
    // The price `$` and `20.00` are split across text nodes inside the <p>,
    // so we query the container element and check its textContent.
    const priceEl = screen.getByText((_, el) =>
      el?.tagName === "P" && (el.textContent ?? "").includes("$20.00")
    );
    expect(priceEl).toBeInTheDocument();
  });

  it("does NOT display the inflated 100x price", () => {
    render(<PersonaCard persona={testPersona} />);
    const inflated = screen.queryByText((_, el) =>
      el?.tagName === "P" && (el.textContent ?? "").includes("$2000.00")
    );
    expect(inflated).not.toBeInTheDocument();
  });
});
