# Defect Register

This register is based on static analysis of the codebase as found. Build and runtime verification could not be completed in this environment because `pnpm` is not installed or not available on PATH.

Severity scale:

- `Critical`: blocks core app operation or creates a major security boundary failure.
- `High`: breaks an important user flow or causes cross-user data access.
- `Medium`: causes incorrect behavior, stale UI, bad data, or contract mismatch.
- `Low`: polish, maintainability, or localized UX issue.

## Summary

| ID | Severity | Area | Defect |
|---|---:|---|---|
| DEF-001 | Critical | API auth | Protected route middleware can skip JWT verification while handlers require `request.user`. |
| DEF-002 | High | API auth | JWT secret is hard-coded in source. |
| DEF-003 | High | API auth | Password hashing is non-cryptographic. |
| DEF-004 | Medium | API auth / shared contract | Login response omits `username` required by shared `AuthResponse.user`. |
| DEF-005 | Medium | Web auth | Logout does not remove `auth_token` from `localStorage`. |
| DEF-006 | Medium | Web auth | AuthProvider does not clear `user` when an existing token becomes invalid. |
| DEF-007 | Medium | Web/API auth | UI-only route protection depends on fragile backend auth behavior. |
| DEF-008 | Medium | Catalog search | `minPrice` filter uses `<=` instead of `>=`. |
| DEF-009 | Medium | Catalog search | Persona browse query key ignores search/filter/sort params, causing stale results. |
| DEF-010 | Low | Catalog search | Falsy numeric filters such as `0` are dropped by frontend query construction. |
| DEF-011 | Medium | Catalog display | Persona cards display price multiplied by 100. |
| DEF-012 | Medium | Favorites | Persona detail favorite toggle logic is inverted. |
| DEF-013 | Medium | Favorites | Persona detail fetches favorites for anonymous users. |
| DEF-014 | Medium | Cart | Nav cart count uses a different query key from cart mutations, causing stale badge counts. |
| DEF-015 | Medium | Cart | Cart quantity decrement can submit quantity `0`. |
| DEF-016 | High | Cart security | Cart delete does not verify item ownership before deleting. |
| DEF-017 | Medium | Checkout | Successful checkout does not clear the cart. |
| DEF-018 | Medium | Checkout | Checkout imports an unused `useNavigate`, indicating dead code or incomplete navigation behavior. |
| DEF-019 | Medium | API validation | Persona route does not validate query params with the shared schema. |
| DEF-020 | Low | API validation | Favorites `POST` validates only presence of `personaId`, not request shape. |
| DEF-021 | Low | API data integrity | Missing persona records in carts are silently skipped. |
| DEF-022 | Low | API data integrity | Order creation can create an order with zero enriched items if cart entries reference missing personas. |
| DEF-023 | Medium | State persistence | All users, carts, favorites, and orders are process-memory only. |
| DEF-024 | Low | UI rendering | `StarRating` reuses duplicate SVG gradient IDs. |
| DEF-025 | Low | UI text/encoding | Several source strings contain mojibake replacement text. |
| DEF-026 | Medium | API/CORS config | CORS origin and API base URL are hard-coded to localhost. |
| DEF-027 | Low | Monorepo tooling | Root `lint` script delegates to package lint tasks that are not defined. |
| DEF-028 | Medium | Verification/tooling | README setup assumes `pnpm`, but current environment cannot execute it. |

## Detailed Defects

### DEF-001 - Protected route middleware can skip JWT verification

- Severity: `Critical`
- Area: API auth
- Evidence: `apps/api/src/middleware/auth.ts`
- Description: `authenticate` returns early unless `process.env.ENFORCE_AUTH === "true"`. Protected routes still read `request.user.id`.
- Impact: With the default environment, protected endpoints such as `/cart`, `/favorites`, `/checkout`, and `/auth/me` can throw runtime errors because `request.user` is undefined. If handlers were changed to tolerate missing users, this would also risk unauthenticated access.
- Recommended fix: Always verify JWTs on protected routes. Remove `ENFORCE_AUTH` or invert it into an explicit test-only bypass that also injects a safe test user.

### DEF-002 - JWT secret is hard-coded

- Severity: `High`
- Area: API auth
- Evidence: `apps/api/src/index.ts`
- Description: The JWT secret is literal source code: `agentic-personas-dev-secret`.
- Impact: Any token signed with the known secret can be forged. This is unsafe outside local assessment.
- Recommended fix: Read the secret from an environment variable and fail startup if missing in non-development environments.

### DEF-003 - Password hashing is non-cryptographic

- Severity: `High`
- Area: API auth
- Evidence: `apps/api/src/routes/auth.ts`
- Description: `simpleHash` is a custom integer hash with no salt, no work factor, and trivial reversibility/collision risk.
- Impact: Stored password hashes are not secure if memory or logs are exposed.
- Recommended fix: Use `argon2`, `bcrypt`, or `scrypt` with per-password salt and appropriate cost settings.

### DEF-004 - Login response omits `username`

- Severity: `Medium`
- Area: API auth / shared contract
- Evidence: `apps/api/src/routes/auth.ts`, `packages/shared/src/schemas/auth.ts`
- Description: `AuthResponse.user` is expected to be a `User` with `id`, `username`, and `email`. Login returns only `id` and `email`.
- Impact: Frontend code renders `user.username`; after login this can appear blank or undefined until a later `/auth/me` sync.
- Recommended fix: Return `{ id, username, email }` from login, matching registration and shared types.

### DEF-005 - Logout does not remove token from localStorage

- Severity: `Medium`
- Area: Web auth
- Evidence: `apps/web/src/lib/auth.tsx`
- Description: `logout()` clears React state but does not call `localStorage.removeItem("auth_token")`.
- Impact: A page refresh can restore the previous token and log the user back in unexpectedly.
- Recommended fix: Remove `auth_token` during logout and invalidate authenticated queries.

### DEF-006 - Invalid token handling can leave stale user state

- Severity: `Medium`
- Area: Web auth
- Evidence: `apps/web/src/lib/auth.tsx`
- Description: When `/auth/me` returns `401`, the token is removed and token state is cleared, but `user` is not explicitly cleared in the catch block.
- Impact: Depending on prior state and timing, UI can temporarily retain stale user information.
- Recommended fix: Call `setUser(null)` whenever token validation fails.

### DEF-007 - Route protection is primarily UI-level

- Severity: `Medium`
- Area: Web/API auth
- Evidence: `apps/web/src/routes/cart.tsx`, `apps/web/src/routes/checkout.tsx`, `apps/web/src/routes/favorites.tsx`
- Description: Protected pages show sign-in prompts based on frontend auth state, but route loaders are not guarded and backend auth is conditional.
- Impact: Deep links and direct API calls rely entirely on the API middleware being correct, which DEF-001 shows is not currently reliable.
- Recommended fix: Add router-level before-load guards for protected pages and fix backend enforcement.

### DEF-008 - `minPrice` filter uses the wrong comparison

- Severity: `Medium`
- Area: Catalog search
- Evidence: `apps/api/src/db.ts`
- Description: The `minPrice` branch filters `p.price <= minPrice`. Minimum price semantics should filter `p.price >= minPrice`.
- Impact: Price range searches return the opposite lower-bound result.
- Recommended fix: Change the comparison to `p.price >= filters.minPrice`.

### DEF-009 - Persona browse query key ignores filters

- Severity: `Medium`
- Area: Web catalog search
- Evidence: `apps/web/src/routes/index.tsx`
- Description: The query key is always `["personas"]`, while the query function depends on URL search params.
- Impact: TanStack Query can reuse cached results when search/filter/sort params change, producing stale or incorrect catalog results.
- Recommended fix: Include the normalized search object or query string in the query key, for example `["personas", search]`.

### DEF-010 - Falsy numeric filters are dropped

- Severity: `Low`
- Area: Web catalog search
- Evidence: `apps/web/src/routes/index.tsx`
- Description: Query construction uses `if (search.minPrice)` and `if (search.maxPrice)`, so `0` is omitted.
- Impact: A valid zero lower/upper bound cannot be represented consistently.
- Recommended fix: Check `!== undefined` rather than truthiness.

### DEF-011 - Persona card price is multiplied by 100

- Severity: `Medium`
- Area: Catalog display
- Evidence: `apps/web/src/components/PersonaCard.tsx`
- Description: The card renders `${(persona.price * 100).toFixed(2)}`.
- Impact: A persona priced at `49.99` displays as `$4999.00` on cards, while details/cart show the correct amount.
- Recommended fix: Render `persona.price.toFixed(2)`.

### DEF-012 - Favorite toggle logic is inverted

- Severity: `Medium`
- Area: Favorites
- Evidence: `apps/web/src/routes/personas/$personaId.tsx`
- Description: The mutation deletes when `!isFavorited` and posts when `isFavorited`.
- Impact: Users cannot add a new favorite from the detail page and clicking an active favorite may add instead of remove.
- Recommended fix: Use `isFavorited ? api.delete(...) : api.post(...)`.

### DEF-013 - Favorites query runs for anonymous users on detail page

- Severity: `Medium`
- Area: Favorites
- Evidence: `apps/web/src/routes/personas/$personaId.tsx`
- Description: `useQuery` for `["favorites"]` has no `enabled: !!user`.
- Impact: Anonymous users can trigger calls to a protected endpoint, causing avoidable errors/noise.
- Recommended fix: Add `enabled: !!user` and default favorites to an empty list.

### DEF-014 - Nav cart count query key is disconnected from cart mutations

- Severity: `Medium`
- Area: Cart
- Evidence: `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/cart.tsx`, `apps/web/src/routes/personas/$personaId.tsx`
- Description: The nav uses `["cart-count"]`; mutations invalidate `["cart"]`.
- Impact: The cart badge can remain stale after adding, updating, or removing cart items.
- Recommended fix: Use a single canonical key such as `["cart"]`, or invalidate both keys consistently.

### DEF-015 - Cart decrement can submit invalid quantity

- Severity: `Medium`
- Area: Cart
- Evidence: `apps/web/src/components/CartItem.tsx`
- Description: The decrement button calls `onUpdateQuantity(item.quantity - 1)` without a disabled condition at `quantity <= 1`.
- Impact: Quantity `0` is sent to the API and rejected by validation, producing a poor UX and avoidable failed request.
- Recommended fix: Disable decrement at `quantity <= 1` or map decrement at 1 to remove-item with confirmation.

### DEF-016 - Cart delete does not enforce ownership

- Severity: `High`
- Area: Cart security
- Evidence: `apps/api/src/routes/cart.ts`
- Description: Delete checks that the cart item exists, but it does not verify `item.userId === userId` before deleting.
- Impact: A signed-in user who knows or guesses another cart item ID can delete another user's cart item.
- Recommended fix: Match the update-route authorization check and return `404` when the item does not belong to the current user.

### DEF-017 - Checkout does not clear cart

- Severity: `Medium`
- Area: Checkout
- Evidence: `apps/api/src/routes/checkout.ts`, `apps/api/src/db.ts`
- Description: `db.cart.clearForUser` exists but checkout never calls it after successful order creation.
- Impact: After placing an order, items remain in the cart and can be checked out again.
- Recommended fix: Call `db.cart.clearForUser(userId)` after `db.orders.create(order)`.

### DEF-018 - Checkout imports unused navigation

- Severity: `Medium`
- Area: Checkout / code quality
- Evidence: `apps/web/src/routes/checkout.tsx`
- Description: `useNavigate` is imported and assigned but never used.
- Impact: With TypeScript `noUnusedLocals` enabled this would fail typechecking; even without it, it indicates incomplete or dead behavior.
- Recommended fix: Remove the unused import/variable or implement the intended navigation.

### DEF-019 - Persona route query params are not schema-validated

- Severity: `Medium`
- Area: API validation
- Evidence: `apps/api/src/routes/personas.ts`, `packages/shared/src/schemas/persona.ts`
- Description: The API manually casts query params instead of using `personaFilterSchema`.
- Impact: Invalid enum values and bad numeric strings can pass through inconsistently. `Number("bad")` becomes `NaN`, which can filter out all results unexpectedly.
- Recommended fix: Validate `request.query` with `personaFilterSchema.safeParse`.

### DEF-020 - Favorites POST has weak request validation

- Severity: `Low`
- Area: API validation
- Evidence: `apps/api/src/routes/favorites.ts`
- Description: The route casts `request.body` to `{ personaId: string }` and checks only truthiness.
- Impact: Extra fields, wrong types, or malformed request bodies are not handled consistently with the rest of the API.
- Recommended fix: Add a shared Zod schema for favorite mutations or validate with `z.object({ personaId: z.string().min(1) })`.

### DEF-021 - Missing persona records in carts are silently skipped

- Severity: `Low`
- Area: API data integrity
- Evidence: `apps/api/src/routes/cart.ts`
- Description: `enrichCartItems` continues when a cart entry references a missing persona.
- Impact: Cart totals and item counts can silently diverge from stored cart entries if data becomes inconsistent.
- Recommended fix: Remove orphaned cart entries or return a data-integrity error.

### DEF-022 - Checkout can create an order with zero enriched items

- Severity: `Low`
- Area: API data integrity
- Evidence: `apps/api/src/routes/checkout.ts`
- Description: The route only checks raw cart entry count before enrichment. If all referenced personas are missing, it still creates an order with `items: []` and total `0`.
- Impact: Invalid orders can be created from orphaned cart entries.
- Recommended fix: After enrichment, require `items.length > 0`.

### DEF-023 - Application state is non-durable

- Severity: `Medium`
- Area: Persistence
- Evidence: `apps/api/src/db.ts`
- Description: Users, carts, favorites, and orders are stored in process-local Maps.
- Impact: All user activity is lost on API restart, and multiple API instances would not share state.
- Recommended fix: Document as a local-only constraint or add durable persistence.

### DEF-024 - Duplicate SVG gradient IDs in star ratings

- Severity: `Low`
- Area: UI rendering
- Evidence: `apps/web/src/components/StarRating.tsx`
- Description: Partial star gradients always use `id="half"`.
- Impact: Multiple star ratings on the same page can reference duplicate IDs, causing incorrect partial-fill rendering.
- Recommended fix: Generate a stable unique gradient ID per component/star.

### DEF-025 - Mojibake in UI/source text

- Severity: `Low`
- Area: UI text/encoding
- Evidence: `README.md`, `apps/api/src/db.ts`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/checkout.tsx`
- Description: Several strings contain corrupted characters such as `â€”`, `ðŸ¤–`, and `ðŸŽ‰`.
- Impact: UI and documentation display corrupted symbols instead of intended emoji/dashes.
- Recommended fix: Normalize files to UTF-8 and replace corrupted literals with intended characters or ASCII equivalents.

### DEF-026 - Localhost API/CORS configuration is hard-coded

- Severity: `Medium`
- Area: Configuration
- Evidence: `apps/api/src/index.ts`, `apps/web/src/lib/api.ts`
- Description: API base URL and allowed CORS origin are hard-coded to localhost ports.
- Impact: The app is not portable across environments without source edits.
- Recommended fix: Read API base URL and CORS origin from environment variables.

### DEF-027 - Root lint task has no package implementations

- Severity: `Low`
- Area: Tooling
- Evidence: root `package.json`, `apps/api/package.json`, `apps/web/package.json`, `packages/shared/package.json`
- Description: Root `lint` calls `turbo lint`, but workspace packages do not define `lint` scripts.
- Impact: The advertised lint command has no effective package task or may fail depending on Turbo behavior.
- Recommended fix: Add lint scripts to packages or remove/update the root script.

### DEF-028 - `pnpm` unavailable in current environment

- Severity: `Medium`
- Area: Tooling / verification
- Evidence: command execution attempted from repo root
- Description: `pnpm typecheck` and `pnpm build` failed because `pnpm` is not recognized.
- Impact: The documented build/test workflow cannot be executed in this environment until package manager setup is fixed.
- Recommended fix: Install pnpm, enable Corepack, or document the exact required setup command for Windows.

## Recommended Fix Order

1. Fix auth enforcement and protected route assumptions: DEF-001, DEF-004, DEF-005, DEF-006.
2. Fix cross-user/data integrity risks: DEF-016, DEF-017.
3. Fix primary storefront behavior: DEF-008, DEF-009, DEF-011, DEF-012, DEF-014, DEF-015.
4. Fix validation/config/tooling gaps: DEF-019, DEF-020, DEF-026, DEF-027, DEF-028.
5. Fix polish and resilience items: DEF-010, DEF-013, DEF-018, DEF-021, DEF-022, DEF-024, DEF-025.

