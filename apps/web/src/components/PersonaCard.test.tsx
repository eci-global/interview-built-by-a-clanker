import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Persona } from "@acme/shared";
import { PersonaCard } from "./PersonaCard";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));

const persona: Persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "Reviews code",
  avatarUrl: "https://example.com/rex.svg",
  specialty: "Engineering",
  capabilities: ["Code review", "Complexity analysis", "Design patterns", "Debt"],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro",
};

describe("Given a persona card", () => {
  it("When it renders, Then key storefront details are visible with the correct monthly price", () => {
    render(<PersonaCard persona={persona} />);

    expect(screen.getByText("Refactor Rex")).toBeTruthy();
    expect(screen.getByText("Your relentless code reviewer")).toBeTruthy();
    expect(screen.getByText("$49.99")).toBeTruthy();
    expect(screen.getByText("+1 more")).toBeTruthy();
    expect(screen.queryByText("$4999.00")).toBeNull();
  });
});
