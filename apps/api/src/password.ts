import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LEN = 64;

/**
 * Hash a password with a per-user random salt using scrypt (a memory-hard KDF).
 *
 * Replaces the old `simpleHash`, a 32-bit non-cryptographic string hash that
 * was unsalted and trivially brute-forced/collidable — unacceptable for
 * password storage. The returned string packs the salt and digest as
 * "<saltHex>:<hashHex>" so it fits the existing single passwordHash column.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

/** Constant-time verification of a password against a stored "<salt>:<hash>". */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, KEY_LEN);
  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}
