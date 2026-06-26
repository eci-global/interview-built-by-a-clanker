import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password hashing (B16)", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("wrong", stored)).toBe(false);
  });

  it("salts: identical passwords produce different stored hashes", () => {
    const a = hashPassword("samepass");
    const b = hashPassword("samepass");
    expect(a).not.toEqual(b);
    expect(verifyPassword("samepass", a)).toBe(true);
    expect(verifyPassword("samepass", b)).toBe(true);
  });

  it("does not store the plaintext password", () => {
    expect(hashPassword("plaintext-secret")).not.toContain("plaintext-secret");
  });

  it("rejects a malformed stored value", () => {
    expect(verifyPassword("x", "not-a-valid-hash")).toBe(false);
  });
});
