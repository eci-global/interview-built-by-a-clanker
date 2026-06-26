import { describe, it, expect } from "vitest";
import { queryClient, STALE_TIME } from "./queryClient";

describe("query client config (B26)", () => {
  it("uses the shared STALE_TIME constant for query staleTime", () => {
    expect(STALE_TIME).toBe(60_000);
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(STALE_TIME);
  });
});
