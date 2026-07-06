# Defect Log

One ticket per bug. Filled in live as bugs are found and fixed.

Legend — **Risk:** critical (crash/security/data-loss/cross-user leak) · high (core
feature broken) · medium (wrong edge-case behavior) · low (minor/cosmetic/latent).

**State (after final audit pass):** BUG-001…BUG-015 **fixed & verified** — full repo green
(`pnpm typecheck` 4/4, `pnpm test` 37/37, `pnpm build` 3/3); each landed via an isolated
worktree, reviewed for minimal root-cause diff (no `any`/`@ts-ignore`/non-null suppressions,
no weakened tests) and re-verified on merge. A second adversarial sweep of the whole codebase
then found **5 new bugs the first pass missed — BUG-016…BUG-020, now all FIXED & verified**
(actioned directly by the orchestrator with TDD, full suite green after each), plus accepted
known-limitations and test-hardening follow-ups. **Full suite: 47 tests passing.** Test map (fixed set):

| Bug | Test file | Bug | Test file |
|---|---|---|---|
| 001 | `web` typecheck (routeTree TS4023 gone) | 009 | `apps/web/src/lib/auth.test.tsx` |
| 002 | `apps/api/src/routes/personas.test.ts` | 010 | `apps/web/src/routes/__root.test.tsx` |
| 003 | `apps/api/src/routes/auth.test.ts` | 011 | `apps/web/src/components/PersonaCard.test.tsx` |
| 004 | `apps/api/src/cors.test.ts` | 012 | `apps/web/src/routes/personas/$personaId.test.tsx` |
| 005 | `apps/api/src/middleware/auth.test.ts` | 013 | `apps/web/src/components/CartItem.test.tsx` |
| 006 | `apps/api/src/routes/cart.test.ts` | 014 | `packages/shared/src/persona.test.ts` |
| 007 | `apps/api/src/routes/checkout.test.ts` | 015 | `packages/shared/src/order.test.ts` |
| 008 | `apps/web/src/routes/index.test.tsx` | | |

---

### BUG-001 — Route search params type not exported (typecheck failure)
- **Package / file:** `apps/web` · `src/routes/index.tsx:9`
- **How it surfaced:** `tsc --noEmit` → `routeTree.gen.ts(45,7): TS4023: 'IndexRoute' ... uses name 'SearchParams' ... but cannot be named`
- **Symptom:** `pnpm typecheck` fails in `@acme/web`; the whole build is red.
- **Root cause:** `interface SearchParams` is declared but not exported. `validateSearch` returns it, so the generated route tree re-exports `IndexRoute` whose type references a type it cannot name across the module boundary.
- **Fix:** Add `export` to the interface (`export interface SearchParams`).
- **Verification:** `pnpm --filter @acme/web exec tsc --noEmit` clean.
- **Status:** fixed

### BUG-002 — `minPrice` filter is inverted
- **Package / file:** `apps/api` · `src/db.ts:365`
- **How it surfaced:** code review (personas search)
- **Symptom:** `GET /personas?minPrice=60` returns personas *cheaper* than 60 and excludes expensive ones; price-range queries never work.
- **Root cause:** Predicate is `p.price <= filters.minPrice!` — a lower bound must use `>=`. (The `maxPrice` block below correctly uses `<=`, making the two redundant.)
- **Fix:** Change to `p.price >= filters.minPrice!`.
- **Verification:** `db.personas.search({ minPrice: 60 })` → every result `price >= 60`.
- **Status:** fixed

### BUG-003 — Login response omits `username`
- **Package / file:** `apps/api` · `src/routes/auth.ts:62-65`
- **How it surfaced:** code review (auth contract)
- **Symptom:** `POST /auth/login` returns `{ token, user: { id, email } }` — no `username`; nav greeting is blank after login (register/`/auth/me` include it).
- **Root cause:** Login handler builds a bare object literal missing `username`; it isn't annotated `AuthResponse` so it slips past typecheck. `userSchema` requires `username`.
- **Fix:** Include `username: user.username` in the response user object.
- **Verification:** login response satisfies `userSchema.parse(res.user)`.
- **Status:** fixed

### BUG-004 — CORS allow-list missing `DELETE`
- **Package / file:** `apps/api` · `src/app.ts` (CORS `methods` array; moved here from `index.ts` during the testability refactor)
- **How it surfaced:** code review (CORS vs registered routes)
- **Symptom:** Browser DELETE preflights fail; remove-from-cart and un-favorite are unusable from the SPA (work via curl).
- **Root cause:** `methods: ["GET","POST","PUT","OPTIONS"]` omits `DELETE` (and `PATCH`), but `DELETE /cart/:itemId` and `DELETE /favorites/:personaId` exist.
- **Fix:** Add `"DELETE"` (and `"PATCH"` for completeness) to the methods list.
- **Verification:** OPTIONS preflight for DELETE returns `access-control-allow-methods` including `DELETE`.
- **Status:** fixed

### BUG-005 — Auth guard is a no-op by default (`ENFORCE_AUTH`) — NEEDS DECISION
- **Package / file:** `apps/api` · `src/middleware/auth.ts:3,9-11`
- **How it surfaced:** code review (auth middleware)
- **Symptom:** With `ENFORCE_AUTH` unset (default), `authenticate` returns without `jwtVerify`; protected routes are reachable with no token, and `/auth/me` 500s (reads `undefined.id`).
- **Root cause:** `const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true"` defaults false; `if (!ENFORCE_AUTH) return;` skips verification. Auth is opt-in rather than on-by-default.
- **Fix:** (DECIDED — enforce always) Removed the `ENFORCE_AUTH` bypass so `authenticate` always calls `jwtVerify`, and made the catch `return reply...` to hard-stop the request. Applied in the harness base commit (entangled with how every protected-route test authenticates), not delegated to a worktree.
- **Verification:** `apps/api/src/middleware/auth.test.ts` — `/auth/me` with no token → 401, garbage token → 401, valid token → 200. 3/3 green (verified by orchestrator).
- **Status:** fixed

### BUG-006 — `DELETE /cart/:itemId` missing ownership check
- **Package / file:** `apps/api` · `src/routes/cart.ts:73-85`
- **How it surfaced:** code review (cross-user isolation)
- **Symptom:** Any authenticated user can delete another user's cart item by id; caller gets 200, victim's item vanishes.
- **Root cause:** Handler checks only `if (!item)` and omits `item.userId === userId` (the sibling PUT at line 64 has it).
- **Fix:** Guard with `if (!item || item.userId !== userId)` → 404 before `remove`.
- **Verification:** User B deleting user A's item → 404; A's cart unchanged.
- **Status:** fixed

### BUG-007 — Checkout never clears the cart
- **Package / file:** `apps/api` · `src/routes/checkout.ts:50-52`
- **How it surfaced:** code review (purchase flow)
- **Symptom:** After a 201 checkout, `GET /cart` still returns the items; a second checkout re-orders the same personas (double-billing).
- **Root cause:** Handler persists the order but never calls the existing `db.cart.clearForUser(userId)`.
- **Fix:** Call `db.cart.clearForUser(userId)` before returning the order.
- **Verification:** After checkout, `GET /cart` → `{ items: [], total: 0 }`.
- **Status:** fixed

### BUG-008 — Browse query ignores search/filter/sort (static queryKey)
- **Package / file:** `apps/web` · `src/routes/index.tsx:43`
- **How it surfaced:** code review (TanStack Query)
- **Symptom:** Changing search/specialty/tier/sort updates the URL but not the grid; results stay stale for `staleTime`.
- **Root cause:** `queryKey: ["personas"]` is constant, so Query serves cache and never refetches when `queryString` changes.
- **Fix:** Include the search params in the key, e.g. `queryKey: ["personas", search]`.
- **Verification:** Changing a filter triggers a new `api.get('/personas?...')` call.
- **Status:** fixed

### BUG-009 — Logout doesn't clear the persisted token
- **Package / file:** `apps/web` · `src/lib/auth.tsx:55-58`
- **How it surfaced:** code review (auth lifecycle)
- **Symptom:** After "Sign out", a page refresh silently logs the user back in.
- **Root cause:** `logout` clears React state but never `localStorage.removeItem("auth_token")`; on mount the provider re-reads the stale token and `/auth/me` re-authenticates. (The 401 branch already removes the key — logout is missing the same line.)
- **Fix:** Add `localStorage.removeItem("auth_token")` in `logout`.
- **Verification:** After `logout()`, `localStorage.getItem("auth_token") === null`.
- **Status:** fixed

### BUG-010 — Nav cart badge never updates (query key mismatch)
- **Package / file:** `apps/web` · `src/routes/__root.tsx:16`
- **How it surfaced:** code review (cache invalidation)
- **Symptom:** Cart mutations update the cart page but not the nav badge until reload/staleTime.
- **Root cause:** Nav badge uses `queryKey: ["cart-count"]`; the cart page reads/invalidates `["cart"]`. Same endpoint, different keys, so mutations never invalidate the badge.
- **Fix:** Use a shared key (`["cart"]`) for the badge, or invalidate both.
- **Verification:** A cart mutation re-renders the badge count.
- **Status:** fixed

### BUG-011 — PersonaCard price is 100× too high
- **Package / file:** `apps/web` · `src/components/PersonaCard.tsx:63`
- **How it surfaced:** code review (rendering)
- **Symptom:** Grid cards show `$2000.00/mo` for a $20 persona; detail page and cart show the correct value.
- **Root cause:** `${(persona.price * 100).toFixed(2)}` — `persona.price` is already in dollars; the `* 100` is a spurious cents conversion (detail/cart render `price.toFixed(2)` with no multiplier).
- **Fix:** Remove `* 100`.
- **Verification:** Card for `price: 20` renders `$20.00/mo`.
- **Status:** fixed

### BUG-012 — Favorite toggle inverted on detail page
- **Package / file:** `apps/web` · `src/routes/personas/$personaId.tsx:42-44`
- **How it surfaced:** code review (favorites)
- **Symptom:** Clicking the heart on an un-favorited persona 404s and never adds; on a favorited one it re-POSTs instead of removing.
- **Root cause:** Condition reversed: `!isFavorited ? api.delete(...) : api.post(...)`. Not-favorited should POST; favorited should DELETE.
- **Fix:** Swap the branches (`isFavorited ? api.delete(...) : api.post(...)`).
- **Verification:** Un-favorited click → POST `/favorites`; favorited click → DELETE `/favorites/:id`.
- **Status:** fixed

### BUG-013 — CartItem "–" button sends quantity 0
- **Package / file:** `apps/web` · `src/components/CartItem.tsx:40-45`
- **How it surfaced:** code review (event handler)
- **Symptom:** At quantity 1, clicking "–" fails silently (400) — button looks disabled but isn't.
- **Root cause:** Minus button has `disabled:*` classes but no `disabled` attribute, so it calls `onUpdateQuantity(0)`, which `updateCartItemSchema.min(1)` rejects.
- **Fix:** Add `disabled={item.quantity <= 1}` (or route qty→0 to a remove).
- **Verification:** With `quantity: 1` the "–" button is `disabled` and does not call `onUpdateQuantity(0)`.
- **Status:** fixed

### BUG-014 — Shared persona schema missing constraints (latent)
- **Package / file:** `packages/shared` · `src/schemas/persona.ts:23,33,35`
- **How it surfaced:** code review (Zod contract)
- **Symptom:** `avatarUrl` accepts any string; `price` accepts negative/zero; `reviewCount` accepts negative/non-integer. Latent — persona data isn't runtime-parsed today, but the contract is wrong.
- **Root cause:** Bare `z.string()` / `z.number()` where `.url()`, `.positive()`, `.int().nonnegative()` are implied by intent (adjacent `rating` correctly uses `.min(1).max(5)`).
- **Fix:** `avatarUrl: z.string().url()`; `price: z.number().positive()`; `reviewCount: z.number().int().nonnegative()`.
- **Verification:** `personaSchema.safeParse` rejects `avatarUrl:"x"`, `price:-10`, `reviewCount:-3`.
- **Status:** fixed

### BUG-015 — Shared order schema `customerEmail` missing `.email()` (latent)
- **Package / file:** `packages/shared` · `src/schemas/order.ts:17`
- **How it surfaced:** code review (Zod contract)
- **Symptom:** An `Order` with a non-email `customerEmail` validates; looser than `checkoutSchema.email` which enforces `.email()`. Latent (output schema, not runtime-parsed).
- **Root cause:** `customerEmail: z.string()` drops the `.email()` constraint the input side enforces.
- **Fix:** `customerEmail: z.string().email()`.
- **Verification:** `orderSchema.safeParse({ ...valid, customerEmail: "nope" })` fails.
- **Status:** fixed

---

## New defects found in the final audit pass (OPEN)

Discovered by a second adversarial sweep after BUG-001…015 were fixed. Each verified
against source by the orchestrator. Not yet fixed — awaiting go-ahead.

### BUG-016 — Favorites query cache-shape collision + missing auth guard
- **Package / file:** `apps/web` · `src/routes/personas/$personaId.tsx:22-28` vs `src/routes/favorites.tsx:16-20`
- **How it surfaced:** final-pass frontend review (React Query key/shape audit)
- **Symptom:** After viewing a persona detail page, the `/favorites` page shows "no favorites" even when the user has some; in the reverse visit order the detail page can throw (`favorites.includes` called on an object). Also, logged-out visits to a detail page fire an unauthenticated `GET /favorites` → 401 (× retry).
- **Root cause:** Both queries use `queryKey: ["favorites"]` but store **different shapes** — the detail page's `queryFn` returns `string[]` (mapped ids) while the favorites page returns `{ favorites: Persona[] }`. React Query dedupes by key, so whichever populates the cache first is misread by the other. Separately, the detail-page query lacks the `enabled: !!user` guard that `favorites.tsx` has.
- **Fix:** `$personaId.tsx` favorites query now uses the same `queryFn` (`() => api.get<{ favorites: Persona[] }>("/favorites")`) and shape as `favorites.tsx`, derives `isFavorited` locally via `favoritesData?.favorites.some(p => p.id === personaId)`, and adds `enabled: !!user`. The `["favorites"]` cache is now consistent across both pages.
- **Verification:** `$personaId.test.tsx` (BUG-016) asserts the favorites query has `enabled: true` and a `queryFn` returning `{ favorites: Persona[] }` (not `string[]`); the two existing toggle tests updated to the shared shape still verify `isFavorited` → post/delete. Green; full suite 38/38 (was 37), typecheck 4/4.
- **Risk:** high · **Status:** fixed

### BUG-017 — Logout doesn't clear the React Query cache (cross-user data leak)
- **Package / file:** `apps/web` · `src/lib/auth.tsx:55-59`
- **How it surfaced:** final-pass frontend review (auth lifecycle)
- **Symptom:** After user A logs out and user B logs in on the same session, B can briefly see A's cart/favorites data (within the 60s `staleTime`) before the refetch completes.
- **Root cause:** `logout` clears `localStorage`/auth state (BUG-009 fix) but never evicts cached queries. The `["cart"]`/`["favorites"]` entries survive; when B logs in, `enabled` flips true and the stale data is served first.
- **Fix:** `auth.tsx` `logout` now calls `queryClient.clear()` (imported singleton from `./queryClient`) after clearing token/state.
- **Verification:** `apps/web/src/lib/auth.test.tsx` — seeds `["cart"]`/`["favorites"]`, calls `logout()`, asserts both are `undefined`. Green; full suite 38/38, typecheck 4/4.
- **Risk:** medium-high · **Status:** fixed

### BUG-018 — Auth `isLoading` ignored → "Sign in" flash for logged-in users
- **Package / file:** `apps/web` · `src/routes/cart.tsx`, `checkout.tsx`, `favorites.tsx` (each `if (!user)` gate)
- **How it surfaced:** final-pass frontend review (auth race)
- **Symptom:** A logged-in user hard-loading `/cart`, `/checkout`, or `/favorites` sees the "Sign in to …" screen for the duration of the `/auth/me` round-trip, then the real content.
- **Root cause:** `AuthProvider` exposes `isLoading` (true while `/auth/me` is in flight), but these routes only check `if (!user)` — true during loading — so they render the logged-out prompt prematurely.
- **Fix:** All three routes now destructure `isLoading: authLoading` from `useAuth` and short-circuit to a neutral loading skeleton *before* the `!user` branch.
- **Verification:** `apps/web/src/routes/auth-loading.test.tsx` — mocks `useAuth` → `{ user: null, isLoading: true }`, renders all three route components, asserts each sign-in prompt is absent. Green (3 tests); full suite 41/41, typecheck 4/4.
- **Risk:** medium · **Status:** fixed

### BUG-019 — StarRating gradient `id="half"` collides across cards
- **Package / file:** `apps/web` · `src/components/StarRating.tsx:23`
- **How it surfaced:** final-pass frontend review (SVG id uniqueness)
- **Symptom:** On the browse grid, personas with fractional ratings render the wrong partial-star fill — every fractional star uses one card's gradient offset.
- **Root cause:** The `<linearGradient>` uses a static `id="half"`. SVG ids are document-global, so multiple StarRatings on the page create duplicate ids and all `url(#half)` refs resolve to a single gradient. (The first pass cleared this by only checking a single component in isolation.)
- **Fix:** `StarRating.tsx` derives a per-instance base id via `useId()` and builds `halfId = `${base}-${i}``, used for both the `<linearGradient id>` and the `url(#…)` fill reference — no more shared global `id="half"`.
- **Verification:** `apps/web/src/components/StarRating.test.tsx` renders two fractional ratings in one tree and asserts all `<linearGradient>` ids are non-empty and unique. Green; full suite 42/42, typecheck 4/4.
- **Risk:** medium · **Status:** fixed

### BUG-020 — `/personas` doesn't validate/coerce query params
- **Package / file:** `apps/api` · `src/routes/personas.ts:6-16` (with `db.ts` search)
- **How it surfaced:** final-pass backend review (input validation)
- **Symptom:** `GET /personas?minPrice=abc` returns `[]` (a `NaN` bound rejects every row); `?specialty=engineering` (wrong case) or `?sort=bogus` silently returns empty/unsorted — all with 200 and no error. In-app UI sends valid values, so this is malformed-input robustness, not an in-app break.
- **Root cause:** The route casts `request.query` to strings and passes them raw to `db.personas.search`; `Number("abc")` → `NaN`, and specialty/tier use case-sensitive `===`. The shared `personaFilterSchema` (with `z.coerce.number()` + enums) exists but is never applied.
- **Fix:** `personas.ts` now runs `personaFilterSchema.safeParse(request.query)` → 400 on failure; `parsed.data` (coerced numbers, validated enums) is passed to `db.personas.search`. Removed the raw `Number(...)` cast that produced `NaN`.
- **Verification:** `personas.test.ts` (BUG-020) — `minPrice=abc`, `specialty=engineering`, `sort=bogus` each → 400; `minPrice=60` coerces and returns only `price >= 60`. Green (6 tests in file); full suite 47/47, typecheck 4/4, build 3/3.
- **Risk:** low-medium · **Status:** fixed

---

## Known limitations — reviewed and accepted (not scheduled as defects)

- **Password hashing** (`apps/api/src/routes/auth.ts:8-16`) — `simpleHash` is a non-cryptographic 32-bit hash (unsalted, collidable, trivially brute-forceable). Acceptable for an in-memory demo; would be a **critical** security defect in production (use bcrypt/argon2). Flagged, not fixed.
- **Duplicate usernames** (`auth.ts:27`) — register enforces uniqueness only on `email`; `registerSchema` implies no username-uniqueness, so this reads as by-design. Revisit if `username` becomes an identity key.
- **Empty `$0` order** (`checkout.ts`) — if every cart persona were missing from the store, checkout would persist a zero-item order. Currently unreachable (personas are never deleted); worth a post-loop `items.length === 0` guard if a delete path is added.

## Test-hardening follow-ups (fixes verified; tests could be stronger)

- **BUG-012 test** (`$personaId.test.tsx`) — captures the toggle mutation via positional `callIndex === 2`; brittle if `useMutation` calls are reordered/added. Identify the mutation by behavior instead.
- **BUG-005 coverage** — `auth.test.ts` only asserts `/auth/me` enforces auth; the `preHandler` hook on cart/checkout routes is untested. Add unauth'd `GET /cart` / `POST /checkout` → 401 cases.
- **BUG-002 test** (`personas.test.ts`) — defensively unpacks both array and `{personas}` shapes, which would mask a response-shape regression. Pin the wire shape to a plain `Persona[]`.
- **Typecheck scope** — `*.test.*` files are excluded from `tsc` by design (vitest owns test correctness), so type errors *inside tests* aren't caught by `pnpm typecheck`. Accepted trade-off; a separate `tsconfig.test.json` in CI would close it.
