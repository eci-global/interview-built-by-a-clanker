# Test Coverage Assessment

## Current State

Before this work, the repository had no test files and no test runner configuration. Effective automated test coverage was zero.

The repository now has a Vitest-based test suite wired through Turborepo:

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm build
```

## Coverage Added

### API BDD Tests

File: `apps/api/src/app.test.ts`

Covered scenarios:

- Given API authentication is required, when a guest requests the cart, then the API returns `401`.
- Given a registered user, when the user logs in, then the response includes the full shared user contract.
- Given catalog price filters, when `minPrice` is supplied, then cheaper personas are excluded.
- Given multiple users have carts, when one user deletes another user's cart item, then deletion is denied.
- Given a user checks out a non-empty cart, when checkout succeeds, then an order is created and the cart is cleared.

### Frontend Logic Tests

Files:

- `apps/web/src/lib/format.test.ts`
- `apps/web/src/lib/favorites.test.ts`
- `apps/web/src/lib/personaSearch.test.ts`
- `apps/web/src/lib/cartKeys.test.ts`

Covered scenarios:

- Persona card monthly price formatting is not multiplied.
- Favorite toggle chooses `POST` for new favorites and `DELETE` for existing favorites.
- Persona search query strings retain zero-valued numeric filters.
- Persona query keys change when search parameters change.
- Cart-related UI paths share a canonical query key.

## Bugs Covered By Tests

The new tests directly cover fixes for:

- Protected API routes requiring authentication.
- Login response missing `username`.
- `minPrice` using the wrong comparison.
- Cross-user cart item deletion.
- Checkout not clearing carts.
- Persona card prices being multiplied by 100.
- Inverted favorite toggle behavior.
- Persona search cache keys ignoring search parameters.
- Numeric zero filters being dropped.
- Cart cache-key mismatch.

## Remaining Gaps

This is now a useful regression suite, but it is not full coverage.

Remaining areas that would benefit from additional tests:

- React component interaction tests for full page behavior with a DOM runner.
- End-to-end browser tests covering register, login, browse, favorite, cart, checkout, and logout as a real user journey.
- Validation edge cases for malformed API requests.
- Favorites API ownership and duplicate-add behavior.
- Auth token expiry/invalid-token frontend behavior.
- Accessibility and keyboard interaction checks.
- Persistence behavior if a real database is introduced.

## Recommendation

Keep the current Vitest suite as the fast TDD regression layer. Add Playwright or equivalent E2E coverage next for one happy path and two failure paths:

- Register/login, browse, add favorite, add cart item, checkout.
- Anonymous user cannot access protected pages/API features.
- Cart and checkout handle invalid quantities and empty carts correctly.

