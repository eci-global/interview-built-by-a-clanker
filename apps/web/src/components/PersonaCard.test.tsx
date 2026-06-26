import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Persona } from "@acme/shared";
import { PersonaCard } from "./PersonaCard";

// PersonaCard wraps its content in a router <Link>; stub it to a plain anchor
// so the component can be rendered without a full RouterProvider.
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

const persona: Persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "desc",
  avatarUrl: "https://example.com/rex.svg",
  specialty: "Engineering",
  capabilities: ["Code review", "Complexity analysis"],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro",
};

describe("PersonaCard", () => {
  it("renders the persona price as-is, not multiplied by 100 (B2)", () => {
    render(<PersonaCard persona={persona} />);
    expect(screen.getByText(/\$49\.99/)).toBeInTheDocument();
    expect(screen.queryByText(/\$4999\.00/)).not.toBeInTheDocument();
  });
});
