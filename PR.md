# PR: Fix critical bugs across the monorepo

## Summary

This PR fixes **13 bugs** discovered during a comprehensive audit of the codebase — including logic errors, security gaps, type errors, and runtime crashes. A test suite has been added to validate the critical fixes.

---

## Backend Fixes (`@acme/api`)

### Logic Bugs

| Fix | File | Details |
|-----|------|---------|
| **`minPrice` filter inverted** | `apps/api/src/db.ts` | `p.price <= filters.minPrice` → `p.price >= filters.minPrice`. Previously returned items *below* the minimum instead of at/above. |
| **Login response missing `username`** | `apps/api/src/routes/auth.ts` | Login response now includes `username` in the user object, matching the `AuthResponse` type. Previously caused `undefined` to render in the navbar. |
| **Checkout didn't clear cart** | `apps/api/src/routes/checkout.ts` | Added `db.cart.clearForUser(userId)` after order creation. Previously the cart persisted after checkout. |

### Security

| Fix | File | Details |
|-----|------|---------|
| **CORS missing `DELETE` method** | `apps/api/src/index.ts` | Added `"DELETE"` to CORS `methods` array. Browser preflight was blocking all DELETE requests (remove from cart, unfavorite). |
| **Cart DELETE missing ownership check** | `apps/api/src/routes/cart.ts` | Added `item.userId !== userId` guard to `DELETE /cart/:itemId`. Previously any authenticated user could delete another user's cart items. |
| **Auth defaulted to disabled** | `apps/api/src/middleware/auth.ts` | Renamed `ENFORCE_AUTH` (default `false`) to `SKIP_AUTH` (default `false`), so auth is **on by default**. Previously all protected routes silently skipped JWT verification, leaving `request.user` undefined and causing runtime crashes. |
| **Dead code removed** | `apps/api/src/middleware/auth.ts` | Removed unused `registerAuthHook` function and `FastifyInstance` import. |

---

## Frontend Fixes (`@acme/web`)

### Logic Bugs

| Fix | File | Details |
|-----|------|---------|
| **Price multiplied by 100** | `apps/web/src/components/PersonaCard.tsx` | `persona.price * 100` → `persona.price`. A $49.99 persona was displaying as $4,999.00. |
| **`toggleFavorite` inverted** | `apps/web/src/routes/personas/$personaId.tsx` | Swapped ternary branches — `isFavorited` now triggers DELETE, `!isFavorited` triggers POST. Was backwards. |
| **Cart decrement to 0** | `apps/web/src/components/CartItem.tsx` | Added `disabled={item.quantity <= 1}` to the `-` button. Previously sent `quantity: 0` which the API rejects (min 1). |
| **Query cache never refreshed** | `apps/web/src/routes/index.tsx` | Changed `queryKey` from `["personas"]` to `["personas", search]`. Cache now varies by filter/search params. |
| **Favorites query fires when logged out** | `apps/web/src/routes/personas/$personaId.tsx` | Added `enabled: !!user` to the favorites query. Previously fired unauthenticated and errored. |
| **Logout didn't clear token** | `apps/web/src/lib/auth.tsx` | Added `localStorage.removeItem("auth_token")` to the `logout` callback. Previously the stale token persisted across sessions. |

### TypeScript / Config

| Fix | File | Details |
|-----|------|---------|
| **Typecheck error** | `apps/web/src/routes/index.tsx` | Exported `SearchParams` interface so `routeTree.gen.ts` can reference the type. |
| **Deprecated `baseUrl`** | `apps/web/tsconfig.json` | Removed deprecated `baseUrl` while keeping `paths` for the `~/` alias (works without `baseUrl` in TS 5.x). |

---

## Test Coverage Added

Added **vitest** to `@acme/api` with **14 tests** across 5 test files:

| Test File | Tests | What it validates |
|-----------|-------|-------------------|
| `db.test.ts` | 4 | `minPrice`/`maxPrice` filter correctness |
| `auth.test.ts` | 5 | Register returns username, login returns username, auth enforcement (rejects unauthenticated, rejects bad tokens, allows valid tokens) |
| `cart.test.ts` | 2 | Cart item ownership checks on DELETE and PUT |
| `checkout.test.ts` | 2 | Cart cleared after checkout, empty cart rejection |
| `cors.test.ts` | 1 | DELETE method accepted in CORS preflight |

```
 ✓ src/__tests__/db.test.ts (4 tests)
 ✓ src/__tests__/cors.test.ts (1 test)
 ✓ src/__tests__/auth.test.ts (5 tests)
 ✓ src/__tests__/cart.test.ts (2 tests)
 ✓ src/__tests__/checkout.test.ts (2 tests)

 Test Files  5 passed (5)
      Tests  14 passed (14)
```

---

## How to verify

```bash
pnpm install
pnpm run typecheck   # 0 errors
pnpm run build       # all 3 packages succeed
pnpm --filter @acme/api test  # 14/14 tests pass
```
