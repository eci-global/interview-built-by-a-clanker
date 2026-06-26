import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("smoke: react testing harness", () => {
  it("renders a component", () => {
    render(<div>hello</div>);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });
});
