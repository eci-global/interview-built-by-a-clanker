import type { Cart } from "@acme/shared";
import { api } from "./api";

/**
 * Canonical react-query definition for the current user's cart.
 *
 * The nav badge previously used a separate key ["cart-count"], but every cart
 * mutation (add/update/remove/checkout) invalidates ["cart"]. Different keys
 * meant the badge never refetched after a change (stale count) and /cart was
 * fetched twice. Sharing this one definition keeps the badge in sync and avoids
 * the duplicate fetch.
 */
export function cartQuery() {
  return {
    queryKey: ["cart"] as const,
    queryFn: () => api.get<Cart>("/cart"),
  };
}

/** Total item count (sum of quantities) for the nav badge. */
export function cartCount(cart: Cart | undefined): number {
  return cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
}
