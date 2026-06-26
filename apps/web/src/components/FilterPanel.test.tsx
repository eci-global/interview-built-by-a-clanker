import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterPanel } from "./FilterPanel";

function renderPanel(overrides = {}) {
  const props = {
    onSpecialtyChange: vi.fn(),
    onTierChange: vi.fn(),
    onSortChange: vi.fn(),
    onMinPriceChange: vi.fn(),
    onMaxPriceChange: vi.fn(),
    ...overrides,
  };
  render(<FilterPanel {...props} />);
  return props;
}

describe("FilterPanel price range (B22)", () => {
  it("renders min/max price inputs", () => {
    renderPanel();
    expect(screen.getByLabelText("Minimum price")).toBeInTheDocument();
    expect(screen.getByLabelText("Maximum price")).toBeInTheDocument();
  });

  it("reports a numeric value when a price is entered", () => {
    const props = renderPanel();
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "50" },
    });
    expect(props.onMinPriceChange).toHaveBeenCalledWith(50);
  });

  it("reports undefined when a price field is cleared", () => {
    const props = renderPanel({ minPrice: 50 });
    fireEvent.change(screen.getByLabelText("Minimum price"), {
      target: { value: "" },
    });
    expect(props.onMinPriceChange).toHaveBeenCalledWith(undefined);
  });
});
