import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SearchBar } from "./SearchBar";

describe("Given a search value", () => {
  it("When the user types and clears search, Then changes are emitted", async () => {
    const onChange = vi.fn();
    render(<SearchBar value="security" onChange={onChange} />);

    const input = screen.getByPlaceholderText(
      "Search personas by name, capability, or description...",
    );
    expect((input as HTMLInputElement).value).toBe("security");

    fireEvent.change(input, { target: { value: "security audit" } });
    await waitFor(
      () => {
        expect(onChange).toHaveBeenCalledWith("security audit");
      },
      { timeout: 500 },
    );

    fireEvent.click(screen.getByRole("button"));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
