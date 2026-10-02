// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { StarRating } from "../../apps/web/src/components/StarRating";
import { mount } from "../helpers/mount";

describe("star rating", () => {
  let unmount = () => {};

  afterEach(() => {
    unmount();
  });

  it("gives each partial star its own gradient and fill", () => {
    const view = mount(
      <div>
        <StarRating rating={4.8} />
        <StarRating rating={4.1} />
      </div>,
    );
    unmount = view.unmount;

    const gradients = [...view.container.querySelectorAll("linearGradient")];
    const ids = gradients.map((gradient) => gradient.id);
    const offsetOf = (gradient: Element | undefined) =>
      Number.parseFloat(gradient?.querySelector("stop")?.getAttribute("offset") ?? "");

    expect(offsetOf(gradients[0])).toBeCloseTo(80, 4);
    expect(offsetOf(gradients[1])).toBeCloseTo(10, 4);
    expect(new Set(ids).size).toBe(gradients.length);
  });
});
