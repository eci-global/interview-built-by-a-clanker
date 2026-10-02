// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount } from "../helpers/mount";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { PersonaCard } from "../../apps/web/src/components/PersonaCard";

const persona = {
  id: "p-001",
  name: "Refactor Rex",
  tagline: "Your relentless code reviewer",
  description: "Reviews code.",
  avatarUrl: "https://example.com/rex.svg",
  specialty: "Engineering" as const,
  capabilities: [
    "Code review",
    "Complexity analysis",
    "Design patterns",
    "Technical debt reduction",
  ],
  price: 49.99,
  rating: 4.8,
  reviewCount: 234,
  tier: "Pro" as const,
};

describe("persona card", () => {
  let unmount = () => {};

  afterEach(() => {
    unmount();
  });

  it("shows the monthly price in dollars", () => {
    const view = mount(<PersonaCard persona={persona} />);
    unmount = view.unmount;

    expect(view.container.textContent).toContain("$49.99");
    expect(view.container.textContent).not.toContain("4999");
    expect(view.container.textContent).toContain("+1 more");
  });
});