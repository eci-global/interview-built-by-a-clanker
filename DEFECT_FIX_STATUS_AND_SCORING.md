# Defect Fix Status and Answer-Key Review

Branch: `dfredriksen-fixes`

## Executive Summary

The submitted work fixed all 12 functional bugs and the critical fail-open auth security issue from the provided answer key. It did not fully catch the answer-key code-quality issue about raw database Map access leaking into route handlers.

Recommended answer-key rating: `Exceptional`

Answer-key count: `13 / 14` caught and fixed.

Remaining answer-key issue: `Issue 13 - Duplicated DB queries inlined into route handlers`.

## Answer-Key Mapping

| Answer Key Item | Status | Notes |
|---|---|---|
| Bug 1: Cart DELETE endpoint missing user ownership check | Fixed | `DELETE /cart/:itemId` now checks both existence and `item.userId === userId`. Covered by API regression test for cross-user deletion. |
| Bug 2: Search `minPrice` filter is inverted | Fixed | `db.personas.search` now uses `price >= minPrice`. Covered by API catalog filter test. |
| Bug 3: Checkout does not clear the cart | Fixed | Checkout now calls `db.cart.clearForUser(userId)` after order creation. Covered by API and E2E checkout flow. |
| Bug 4: CORS configuration blocks DELETE requests | Fixed | CORS methods include `DELETE`. A later real-world DELETE issue was also fixed in the frontend API client by not sending JSON content-type on empty DELETE requests. |
| Bug 5: Cart badge uses wrong query key | Fixed | Cart query key is centralized as `cartQueryKey`, and nav/cart/detail/checkout use the same key. |
| Bug 6: Favorites query fires without authentication | Fixed | Persona detail favorites query uses `enabled: !!user`. |
| Bug 7: Persona card shows price in cents | Fixed | Persona cards use dollar price formatting without multiplying by 100. Covered by component test. |
| Bug 8: Cart quantity can go to zero or negative | Fixed | Decrement button is disabled at quantity `<= 1`. Covered by component test and manual/E2E flow. |
| Bug 9: Favorite toggle logic is inverted | Fixed | Favorite toggle uses `DELETE` only when currently favorited and `POST` otherwise. E2E now covers add, remove, and re-add from detail page. |
| Bug 10: Logout does not clear JWT token | Fixed | Logout removes `auth_token` from `localStorage`. Covered by auth provider test. |
| Bug 11: Browse query does not refetch when filters change | Fixed | Browse query key includes the normalized query string/search state. Covered by frontend logic test. |
| Bug 12: Login response omits username | Fixed | Login response includes `id`, `username`, and `email`. Covered by API auth contract test. |
| Issue 13: Duplicated DB queries in route handlers | Not fully fixed | This was not identified as an answer-key issue during the initial pass. Some tests touch these paths, but `favorites.ts` and `checkout.ts` still import raw Maps from `db.ts`, so storage details remain leaked. |
| Issue 14: Auth middleware defaults to disabled | Fixed | Auth middleware now always verifies JWTs. The fail-open `ENFORCE_AUTH` design was removed. Covered by unauthenticated protected-route test. |

## Recommended Score

Findings identified and fixed: `13 / 14`

Scoring-guide band: `Exceptional` because the submission caught and fixed 12-14 answer-key items.

Recommended scoring-card assessment:

| Metric | Score | Notes |
|---|---:|---|
| Perseverance / Grit | 3 | Continued through multiple rounds of testing, including a manually reported favorite-removal defect after the initial pass. |
| Executive Functions | 3 | Prioritized auth, data integrity, core purchase flow, then tooling/coverage. Added regression coverage as fixes were made. |
| Reasoning / Troubleshooting | 3 | Identified root causes across API, frontend cache state, CORS/client request behavior, and validation. |
| Exploration / Curiosity | 3 | Reviewed architecture, docs, code paths, tests, and runtime behavior. Added E2E coverage that exposed an additional real issue. |
| Technical Abilities | 3 | Demonstrated Fastify, TanStack Query, React, Vitest, Playwright, Turborepo, and TypeScript proficiency. |
| Fluidity | 3 | Moved between backend, frontend, shared schemas, tests, and dev-server verification effectively. |
| Symbiosis | 3 | Used AI-assisted iteration productively and validated outcomes with real tests instead of relying on assumptions. |

Recommended total: `21 / 21` if using seven 1-3 metrics as shown in the answer key table. If the intended total is `18`, normalize this to `18 / 18`; the provided table lists seven metrics, which totals 21.

## Defect Register Status

| ID | Status | Summary and Resolution |
|---|---|---|
| DEF-001 | Fixed | Protected API routes could skip JWT verification and still expect `request.user`. The auth middleware now always verifies JWTs and returns `401` for unauthenticated protected requests. |
| DEF-002 | Fixed | JWT secret was hard-coded. The app now reads `JWT_SECRET` and fails startup in production when it is missing, while retaining a development fallback only outside production. |
| DEF-003 | Fixed | Password hashing used a custom non-cryptographic hash. Registration/login now use salted Node `scrypt` with timing-safe verification. |
| DEF-004 | Fixed | Login response omitted `username` despite the shared `AuthResponse` contract. Login now returns the full user shape: `id`, `username`, and `email`. |
| DEF-005 | Fixed | Logout cleared React state but left `auth_token` in `localStorage`. Logout now removes the stored token. |
| DEF-006 | Fixed | Invalid stored token handling could leave stale user state. Failed `/auth/me` validation now clears token and user state. |
| DEF-007 | Fixed | Protected-page safety depended on fragile backend auth behavior. Backend auth is now enforced fail-closed, and frontend protected pages continue to show sign-in prompts for anonymous users. |
| DEF-008 | Fixed | `minPrice` used the wrong comparison and returned cheaper personas. It now filters with `price >= minPrice`. |
| DEF-009 | Fixed | Browse query key ignored search/filter/sort parameters, causing stale catalog results. Query construction now includes a normalized query string in the key. |
| DEF-010 | Fixed | Zero-valued numeric filters were dropped because checks used truthiness. Query construction now preserves `0` by checking for `undefined`. |
| DEF-011 | Fixed | Persona cards displayed prices multiplied by 100. Price formatting now displays the monthly dollar amount directly. |
| DEF-012 | Fixed | Favorite toggle behavior on persona detail was inverted. The toggle now posts when not favorited and deletes when favorited. |
| DEF-013 | Fixed | Detail-page favorites query fired for anonymous users. It now runs only when a user is authenticated. |
| DEF-014 | Fixed | Nav cart badge used a different query key from cart mutations. Cart state now uses a shared `cartQueryKey`. |
| DEF-015 | Fixed | Cart decrement could send quantity `0`. The decrement control is disabled at quantity `1`. |
| DEF-016 | Fixed | Cart item deletion did not verify ownership. Delete now denies removal unless the cart item belongs to the authenticated user. |
| DEF-017 | Fixed | Checkout created an order but left cart items behind. Successful checkout now clears the user's cart. |
| DEF-018 | Fixed | Checkout imported unused navigation code. The unused import/variable was removed. |
| DEF-019 | Fixed | Persona query params were manually cast and not schema-validated. The API now validates with `personaFilterSchema`. |
| DEF-020 | Fixed | Favorites POST only checked truthiness of `personaId`. It now uses a shared Zod schema for favorite mutations. |
| DEF-021 | Fixed | Missing persona records in carts were silently skipped. Orphaned cart entries are now removed during cart enrichment. |
| DEF-022 | Fixed | Checkout could create a zero-item order if all cart entries referenced missing personas. Checkout now clears orphan entries and rejects checkout when no valid items remain. |
| DEF-023 | Resolved by documentation | State is process-memory only. This is documented in `README.md` as a local/demo constraint; a production fix would require adding durable persistence and migrations. |
| DEF-024 | Fixed | `StarRating` reused duplicate SVG gradient IDs. It now uses React `useId()` to generate unique gradient IDs. |
| DEF-025 | Fixed | Source/docs contained mojibake text. README was normalized to ASCII and a scan no longer finds the corrupted sequences in the checked paths. |
| DEF-026 | Fixed | API/CORS config and frontend API URL were hard-coded. API CORS origin uses `WEB_ORIGIN`, CORS allows `DELETE`, and the frontend uses `VITE_API_BASE_URL` with a localhost fallback. |
| DEF-027 | Fixed | Root lint delegated to package lint tasks that did not exist. Workspace packages now define `lint` scripts. |
| DEF-028 | Fixed | README assumed plain `pnpm`, which was unavailable in the environment. Documentation now uses `corepack pnpm`, and test/build commands were verified with Corepack. |

## Remaining Work

The only answer-key item still remaining is code quality issue 13. Recommended follow-up:

1. Stop exporting raw Maps from `apps/api/src/db.ts`.
2. Change `apps/api/src/routes/favorites.ts` to use `db.favorites.getByUserId()` and `db.personas.getById()`.
3. Change `apps/api/src/routes/checkout.ts` to use `db.cart.getByUserId()` and `db.personas.getById()`.
4. Keep tests unchanged to verify behavior remains stable after the refactor.

## Verification Performed

The current implementation was verified with:

```bash
corepack pnpm test
corepack pnpm typecheck
corepack pnpm e2e
```

Previous full-gate verification also passed:

```bash
corepack pnpm lint
corepack pnpm coverage
corepack pnpm build
```
