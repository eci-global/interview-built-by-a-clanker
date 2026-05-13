import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FilterPanel } from "./FilterPanel";

describe("Given active catalog filters", () => {
  it("When the filter panel renders, Then active options and sort selection are represented", () => {
    const onSpecialtyChange = vi.fn();
    const onTierChange = vi.fn();
    const onSortChange = vi.fn();
    const { container } = render(
      <FilterPanel
        specialty="Engineering"
        tier="Pro"
        sort="rating-desc"
        onSpecialtyChange={onSpecialtyChange}
        onTierChange={onTierChange}
        onSortChange={onSortChange}
      />,
    );

    expect(screen.getByRole("button", { name: "Engineering" }).className).toContain(
      "bg-indigo-100",
    );
    expect(screen.getByRole("button", { name: "Pro" }).className).toContain(
      "bg-indigo-100",
    );
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe(
      "rating-desc",
    );

    fireEvent.click(screen.getByRole("button", { name: "Engineering" }));
    fireEvent.click(screen.getByRole("button", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Pro" }));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "price-asc" },
    });

    expect(onSpecialtyChange).toHaveBeenNthCalledWith(1, undefined);
    expect(onSpecialtyChange).toHaveBeenNthCalledWith(2, "Design");
    expect(onTierChange).toHaveBeenCalledWith(undefined);
    expect(onSortChange).toHaveBeenCalledWith("price-asc");
  });
});
