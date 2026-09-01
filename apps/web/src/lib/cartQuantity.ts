export function getNextCartQuantity(
  currentQuantity: number,
  delta: number,
): number | null {
  const next = currentQuantity + delta;
  if (next < 1) {
    return null;
  }
  return next;
}
