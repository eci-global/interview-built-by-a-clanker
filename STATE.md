# STATE.md — Defect Inventory

**Project**: `agentic-personas-storefront` (Turborepo + pnpm; `apps/web` React 19 / TanStack, `apps/api` Fastify 5, `packages/shared` Zod)
**Date**: 2026-07-29
**Status**: Discovery complete. **Tiers 1–3 (Critical, High, Medium) are fixed and verified** — 23 of 44 items closed (`S-1`–`S-23`). Tier 4 (Low/latent/quality) open: `S-24`–`S-44`, 21 items. See [Fix log](#fix-log--2026-07-29).

## Method

Two independent read-only agents reviewed the stack in parallel with disjoint ownership:

- **Frontend agent** — owned `apps/web`; read `packages/shared` read-only; produced the frontend→API contract.
- **Backend agent** — owned `apps/api` + `packages/shared`; produced the actually-implemented API contract.

Neither agent could see the other's findings. Both were required to emit their API contract so the two could be diffed. A third, independent verification lane (this session) then ran the real toolchain — `tsc`, `vite build`, and a **live server with end-to-end HTTP probes** — to confirm or refute each claim.

Every finding below carries a verification tag:

| Tag | Meaning |
|---|---|
| **`PROVEN`** | Reproduced against a running server or a real compiler run. Not an inference. |
| **`VERIFIED`** | I read the code myself and confirmed it. |
| **`STATIC`** | Single-agent code reading, plausible, not executed. |
| **`REFUTED`** | Agent claimed it; tooling proved otherwise. Do **not** "fix". |

**Corroboration** records whether the two agents found it independently. Agreement across two blind reviewers is the strongest signal in this report; single-agent findings are weaker and marked as such.

---

## Executive summary

- **44 distinct issues** catalogued after de-duplication (60 raw findings across both agents; overlaps merged) — `S-1`–`S-44`.
- **15 are high-confidence deliberately-seeded bugs** — matching the seed commit `22f9cc5` ("Technical Assessment (14 findings)") closely enough to suggest near-complete coverage.
- **2 agent claims were REFUTED by tooling.** Acting on them would have meant editing correct code.
- **1 build-blocking defect was found only by tooling** — both a compiler run and the backend agent caught it; the frontend agent, which owned the file, missed it.
- **The app is currently non-functional beyond login/register.** `S-1` alone makes every authenticated route return HTTP 500.

**Recommended fix order**: `S-1` first (it masks everything else — no authenticated behavior can be tested until it is fixed), then `S-2`/`S-3` (build gate + crash), then the High tier.

---

## Fix log — 2026-07-29

**13 items closed**: `S-1`–`S-12` (all of Tier 1 + Tier 2) plus `S-23`. Implemented by two scope-isolated agents (frontend → `apps/web` only, backend → `apps/api` only) and independently verified by a third lane that ran the toolchain and a live server.

Diff footprint: 10 files, +25/−19 (web) and 5 files (api). No file was touched by both agents.

### Toolchain gates — all green

| Gate | Before | After |
|---|---|---|
| `@acme/shared` build | clean | clean |
| `apps/api` `tsc --noEmit` | clean | clean |
| `apps/web` `tsc --noEmit` | **1 error (S-2)** | **clean** |
| `apps/web` `vite build` | pass | pass (CSS 19.89 kB) |

### Behavioural proof (live server, incl. regression checks)

| Probe | Result |
|---|---|
| `GET /cart` no auth | **401** (was 500) — proves `S-1` |
| `GET /cart` garbage token | 401 |
| `GET /cart` **valid** token | **200** — auth still functions, not merely blocked |
| `POST /auth/login` | now returns `username` — proves `S-10` |
| `?minPrice=60` | 6 items, all ≥60 — proves `S-11` |
| `?maxPrice=50` | 5 items, all ≤50 — no regression |
| `?minPrice=50&maxPrice=70` | 6 items, 54.99–69.99 — range correct for the first time |
| no filter | all 15 |
| checkout → `GET /cart` | **items=0, total=0** — proves `S-12` |
| second checkout | **400 "Cart is empty"** — duplicate-order loop closed |
| CORS preflight `DELETE` | `GET,HEAD,PUT,PATCH,POST,DELETE` — proves `S-5` |
| favorites POST/GET/DELETE | 200 / envelope / 200 |

Consistency greps: zero remaining `ENFORCE_AUTH` refs, zero `cart-count` refs, no `* 100` at any price render site.

### Implementation notes worth keeping

- **`S-3`** was split into `["favorites"]` (list) and `["favorites","ids"]` (detail). Both `invalidateQueries({queryKey:["favorites"]})` call sites were left untouched, relying on TanStack Query's default `exact: false` prefix matching to refresh both entries. Verified working. **This is load-bearing implicit behaviour** — adding `exact: true` or renaming the list key would silently desync the detail-page heart with no type error and no test failure.
- **`S-5`** was fixed by removing the `methods` option entirely rather than appending `"DELETE"`, so the plugin default applies. This also permits `HEAD`/`PATCH`; no route uses them, so there is no reachable surface, but the allowlist is now broader than the defect strictly required.
- **`S-10`** added the `AuthResponse` type annotation as well as the missing field. The annotation is the part that prevents recurrence — its absence is why `tsc` never caught the original.
- **`S-7`** moved the query-string builder inside `queryFn` so the key and the request cannot drift apart. Also pulled in the `!== undefined` numeric guard from `S-27` (same lines); the missing price-range **UI** from `S-27` was deliberately left out of scope.
- **`S-4`** added `queryClient.clear()` alongside the `localStorage` removal, so a previous user's cached cart/favorites cannot leak to the next session. No circular import: `lib/queryClient.ts` imports only `@tanstack/react-query`.

### Interaction created by the Tier 1/2 fixes

Fixing `S-1` **changed the character of `S-20`**: the persona detail page's ungated favorites query began returning 401 instead of 500 for anonymous visitors. Resolved in the Tier 3 batch below.

---

## Fix log — Tier 3 (Medium), 2026-07-29

**10 items closed**: `S-13`–`S-22`. Same two-agent scope-isolated pattern (frontend → `apps/web`; backend → `apps/api` + `packages/shared` + `turbo.json`), independently verified against a live server.

Cumulative diff footprint across all three tiers: **23 files, +181/−97**.

### Toolchain gates — all green

`@acme/shared` build clean · `apps/api` `tsc` clean · `apps/web` `tsc` clean · `apps/web` `vite build` pass (CSS 19.89 kB)

### Behavioural proof (live server)

| Probe | Result |
|---|---|
| **`S-13` IDOR** — user A adds `cart-1`; user B deletes it with B's own token | **404**, and A's cart still holds `cart-1` (total 49.99) — attack now fails |
| `S-13` — A deletes A's own `cart-1` | 200 — owner path still works, not over-blocked |
| **`S-14`** — `PUT /cart/:id {"quantity":0}` | `{"error":"Validation failed","details":{"fieldErrors":{"quantity":[…]}}}` — `error` is a **string** |
| `S-14` — `POST /checkout {"name":"","email":"bad"}` | 400, both field errors in `details` |
| `S-14` regression — non-validation errors | still plain strings: `"Persona not found"`, `"Unauthorized"` |
| **`S-16`** — `?minPrice=abc` | **400** (was `200 []`) |
| `S-16` — `?specialty=Bogus` / `?sort=nonsense` / `?tier=Platinum` | 400 each — invalid enums now rejected, not silently `[]` |
| **`S-17`** — `POST /favorites` `{"personaId":""}` / `{}` | 400 in the shared envelope |
| `S-17` — valid `personaId` | 200 `{"success":true}` |

### Filter regression sweep — every value the real UI can emit

All 200, all correct: no params (15) · `minPrice=60` (6, all ≥60) · `maxPrice=50` (5, all ≤50) · `minPrice=50&maxPrice=70` (6, 54.99–69.99) · `specialty=Engineering` (4) · `specialty=DevOps` (2) · `tier=Pro` (7) · `tier=Enterprise` (4) · `q=Rex` (1) · combined `q+specialty+tier+sort` (1). Sort ordering verified unsorted: `price-asc` → 34.99, 39.99, 44.99… · `price-desc` → 99.99, 89.99, 79.99… · `name-asc` → A11y Alex, Compliance C… · `rating-desc` → 4.9, 4.9, 4.8…

**Enum cross-check** (the real risk in `S-16`, since it converts "silently ignore" into "400"): the frontend's hardcoded `FilterPanel` lists were diffed against `personaFilterSchema` — specialties (6), tiers (3), and all four `sort` values match exactly. No legitimate UI input can now produce a 400. `S-32` (four duplicated copies of these enums) remains the standing drift risk that would break this in future.

### Implementation notes worth keeping

- **`S-18`** converted `AuthResponse`/`Cart` to `z.infer` while keeping both type names and shapes identical — `cartItemSchema` already contained `persona: personaSchema`, so `Cart` retains `items[].persona` and no `apps/web` consumer changed.
- **`S-16`** required **no** change to `personaFilterSchema`: its literal-union fields are structurally assignable to `db.personas.search`'s wider `string` params, and all fields were already `.optional()`.
- **`S-14` client half** (`lib/api.ts`) is deliberately shape-agnostic: it handles both the new `{error: string, details}` contract and the legacy `{error: {formErrors, fieldErrors}}` object, deriving a readable sentence from the latter. So the client and server fixes are independent — neither depends on the other shipping. `body` stays `unknown` with real type guards (`isApiErrorDetails`), not blind casts. Verified against both payload shapes: neither yields `[object Object]`.
- **`ApiError.details` is populated but not yet consumed by any form.** Field-level error display is new UI behaviour and was intentionally left out of scope.
- **`S-21`** merged the auth-loading check into each page's *existing* skeleton markup and moved it **above** the `if (!user)` branch — placing it anywhere later would let `!user` fire first during the load window and reproduce the very bug being fixed. In `checkout.tsx` it also sits above the `order` branch; safe because `order` is only set post-checkout. Anonymous visitors still correctly get "Sign in to checkout" rather than a permanent skeleton, because a disabled query reports `isLoading: false`.
- **`S-21`/`__root.tsx`**: the nav renders `null` (not a spinner) for the auth cluster while loading — smallest change that removes the wrong state without inventing markup.

---

## Tier 1 — Critical · ✅ ALL FIXED (2026-07-29)

### S-1 · `ENFORCE_AUTH` defaults off, making `authenticate` a no-op → every protected route HTTP 500
- **Location**: `apps/api/src/middleware/auth.ts:3-11`
- **Verification**: **`PROVEN`** · **Corroboration**: **both agents, independently**
- **Evidence** — the flag is read from an env var that is set nowhere in the repo (no `.env` files exist, no `env` in `turbo.json`, no env in any script):
```ts
const ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true";
export async function authenticate(request, reply) {
  if (!ENFORCE_AUTH) return;          // ← jwtVerify() never runs; request.user stays null
  try { await request.jwtVerify(); } catch { reply.status(401).send({ error: "Unauthorized" }); }
}
```
  `@fastify/jwt` decorates `request.user` as `null`. Every protected handler then destructures it. Live probes against the running server:
```
GET /cart     → 500 {"message":"Cannot destructure property 'id' of 'request.user' as it is null."}
GET /auth/me  → 500 {"message":"Cannot read properties of null (reading 'id')"}
```
- **Impact**: `/auth/me`, all 4 `/cart` routes, all 3 `/favorites` routes, and `/checkout` return 500 unconditionally. Login and register work; nothing else does. **This masks every other backend defect** — I had to run the server with `ENFORCE_AUTH=true` to test the rest of the stack.
- **Fix**: Delete the escape hatch; always `await request.jwtVerify()` and `return reply` on failure (see `S-24`).

### S-2 · `SearchParams` not exported → `tsc` build failure
- **Location**: `apps/web/src/routes/index.tsx:9` (surfaces at `apps/web/src/routeTree.gen.ts:45`)
- **Verification**: **`PROVEN`** (compiler) · **Corroboration**: **tooling + backend agent. The frontend agent, which owned this file, missed it.**
- **Evidence** — real `tsc --noEmit` output:
```
src/routeTree.gen.ts(45,7): error TS4023: Exported variable 'IndexRoute' has or is using
name 'SearchParams' from external module ".../src/routes/index" but cannot be named.
```
  Cause: `interface SearchParams { ... }` at `index.tsx:9` has **no `export`**. It enters `IndexRoute`'s inferred type via `validateSearch`, and `routeTree.gen.ts` re-exports `IndexRoute` — unnameable under the `declaration: true` inherited from `tsconfig.base.json:12`.
- **Why both a compiler run and static reading were needed**: `vite build` **passes** (Vite does not typecheck), so only `pnpm typecheck` fails. Reading the file alone doesn't reveal it either — the error materialises in a *generated* file.
- **Fix**: `export interface SearchParams`. One keyword.

### S-3 · `["favorites"]` query key used for two incompatible shapes → runtime `TypeError` / falsely-empty page
- **Location**: `apps/web/src/routes/favorites.tsx:17` vs `apps/web/src/routes/personas/$personaId.tsx:23`
- **Verification**: **`VERIFIED`** · **Corroboration**: frontend agent only (backend agent confirmed the response envelope, ruling out a server cause)
- **Evidence** — same key, two return types:
```ts
// favorites.tsx:17 — caches the envelope object
queryKey: ["favorites"], queryFn: () => api.get<{ favorites: Persona[] }>("/favorites")
// $personaId.tsx:23 — caches a string[] under the SAME key
queryKey: ["favorites"], queryFn: async () => (await api.get<{favorites:Persona[]}>("/favorites")).favorites.map(p => p.id)
```
  One cache entry, `staleTime: 60s` (`lib/queryClient.ts:6`), so whichever mounts first wins:
  - Favorites → detail: cached value is an object, so the `= []` default doesn't apply → `favorites.includes(...)` throws → **white screen**.
  - Detail → Favorites: cached value is an array → `data?.favorites` is `undefined` → renders "no favorites" **even when favorites exist**.
- **Fix**: Distinct keys (`["favorites"]` / `["favorites","ids"]`), or one shape with `select`.

---

## Tier 2 — High · ✅ ALL FIXED (2026-07-29)

### S-4 · `logout()` never clears the persisted token → sign-out doesn't sign out
- **Location**: `apps/web/src/lib/auth.tsx:55-58` · **`VERIFIED`** · frontend agent only
```ts
const logout = useCallback(() => { setToken(null); setUser(null); }, []);   // no localStorage.removeItem
```
  `login` *does* persist (`auth.tsx:50`), and the 401 path *does* clear (`auth.tsx:42`) — so the omission is clearly the bug, not the convention. `auth_token` survives, so `getToken()` (`lib/api.ts:13-15`) keeps attaching `Authorization`, and `useState(() => localStorage.getItem("auth_token"))` (`auth.tsx:24`) **silently signs the user back in on next load**.
- **Fix**: `localStorage.removeItem("auth_token")` in `logout`; also `queryClient.clear()` to drop the previous user's cached cart/favorites.

### S-5 · CORS `methods` omits `DELETE` → all deletes blocked by preflight
- **Location**: `apps/api/src/index.ts:12-16` · **`PROVEN`** · **both agents, independently**
- **Evidence** — live preflight against the running server:
```
$ curl -X OPTIONS /cart/cart-1 -H 'Origin: http://localhost:5173' \
       -H 'Access-Control-Request-Method: DELETE'
HTTP/1.1 204 No Content
access-control-allow-methods: GET, POST, PUT, OPTIONS      ← DELETE absent
```
  The API defines two DELETE routes (`cart.ts:73`, `favorites.ts:41`) and the client sends `Content-Type` on every request (`lib/api.ts:22`), forcing a preflight on all of them.
- **Impact**: "Remove from cart" and "unfavorite" fail with a CORS error **in the browser only** — they work fine via curl. Classic misleading symptom. Note this means fixing `S-6` alone will *not* restore unfavouriting.
- **Fix**: Add `"DELETE"`, or drop `methods` to take the plugin default.

### S-6 · Favorite toggle inverted — favouriting deletes, unfavouriting adds
- **Location**: `apps/web/src/routes/personas/$personaId.tsx:40-48` · **`VERIFIED`** · frontend agent only
```ts
mutationFn: () => !isFavorited                       // ← negated
  ? api.delete(`/favorites/${personaId}`)
  : api.post("/favorites", { personaId }),
```
  Not favourited → sends DELETE → backend 404s (`favorites.ts:46`) → throws → `onSuccess` never fires. Already favourited → sends POST → no-op re-add. **The heart button can neither add nor remove.**
- **Fix**: `isFavorited ? api.delete(...) : api.post(...)`.

### S-7 · Browse `queryKey` omits all search/filter/sort params → filters are inert
- **Location**: `apps/web/src/routes/index.tsx:42-48` · **`VERIFIED`** · frontend agent only
```ts
queryKey: ["personas"],                              // ← constant
queryFn: () => { const qs = queryString.toString();  // ← but closes over the params
                 return api.get<Persona[]>(`/personas${qs ? `?${qs}` : ""}`); },
```
  Changing a filter updates the URL and re-renders, but the key is unchanged → cached result served, no refetch. With `staleTime: 60s` the entire search/filter/sort UI is dead.
- **Fix**: `queryKey: ["personas", search]`; build the query string inside `queryFn`.

### S-8 · Nav cart badge reads `["cart-count"]` while every mutation invalidates `["cart"]`
- **Location**: `apps/web/src/routes/__root.tsx:16` · **`VERIFIED`** · frontend agent only
- **Evidence** — the producer is the only user of its key; all five invalidations target a different one:
```
__root.tsx:16               queryKey: ["cart-count"]   ← never invalidated by anything
cart.tsx:27,34  checkout.tsx:30  $personaId.tsx:36     invalidateQueries(["cart"])
```
  `["cart-count"]` is not a prefix-child of `["cart"]`, so they are unrelated entries. Add-to-cart, quantity change, remove, and checkout all leave the badge stale for 60s — most visibly, **the badge still shows items after a completed order**. Also causes a duplicate `GET /cart` on every page.
- **Fix**: Use `["cart"]` in `__root.tsx` and derive the count with `select`.

### S-9 · `PersonaCard` multiplies price by 100 → `$4999.00` instead of `$49.99`
- **Location**: `apps/web/src/components/PersonaCard.tsx:63` · **`VERIFIED`** · frontend agent (backend agent independently confirmed prices are dollars end-to-end)
```tsx
${(persona.price * 100).toFixed(2)}
```
  Every other price site treats `price` as dollars: `$personaId.tsx:125`, `CartItem.tsx:35,59`, `cart.tsx:113`, `checkout.tsx:113`. Live API confirms `price: 49.99` and `total: 99.98` for qty 2 — decimal dollars, never cents. **The browse grid advertises 100× the real price and contradicts the detail page for the same item.**
- **Fix**: `${persona.price.toFixed(2)}`.

### S-10 · `POST /auth/login` omits `user.username`, violating the shared `AuthResponse` contract
- **Location**: `apps/api/src/routes/auth.ts:61-65` · **`PROVEN`** · **both agents, independently**
- **Evidence** — live responses from the running server:
```
POST /auth/register → {"token":"…","user":{"id":"user-1","username":"tester","email":"t@example.com"}}
POST /auth/login    → {"token":"…","user":{"id":"user-1","email":"t@example.com"}}   ← username MISSING
GET  /auth/me       → {"id":"user-1","username":"tester","email":"t@example.com"}
```
  Root cause is a missing type annotation. Register is annotated and correct; login is not:
```ts
const response: AuthResponse = { … username: user.username … };  // auth.ts:40  ✓ typed
const response = { token, user: { id: user.id, email: user.email } };  // auth.ts:62  ✗ untyped
```
  That is exactly why `tsc` stays silent — see `S-31`.
- **Impact**: `__root.tsx:81` renders `{user.username}` → blank in the header after login, reappearing only after a refresh (because `/auth/me` does return it). Confusing intermittent symptom.
- **Fix**: Annotate `const response: AuthResponse` and add `username: user.username`.

### S-11 · `minPrice` filter uses `<=` instead of `>=` → behaves identically to `maxPrice`
- **Location**: `apps/api/src/db.ts:364-366` · **`PROVEN`** · **both agents, independently**
```ts
if (filters.minPrice !== undefined) results = results.filter(p => p.price <= filters.minPrice!);
if (filters.maxPrice !== undefined) results = results.filter(p => p.price <= filters.maxPrice!);
```
- **Evidence** — live: `GET /personas?minPrice=60` returns **9 items, every one *cheaper* than 60**:
```
count: 9 | prices: 34.99, 39.99, 44.99, 49.99, 49.99, 54.99, 54.99, 59.99, 59.99
```
  Combined with `maxPrice`, both collapse to `price <= min(minPrice, maxPrice)`.
- **Fix**: `p.price >= filters.minPrice!`.
- **Note**: Currently unreachable through the UI (`S-27`) and masked by `S-7`. It becomes user-visible the moment either is fixed — fix all three together.

### S-12 · `POST /checkout` never clears the cart
- **Location**: `apps/api/src/routes/checkout.ts:44-52` · **`PROVEN`** · backend agent only
- **Evidence** — live sequence against the running server:
```
POST /cart {personaId:p-001, qty:2} → cart has cart-1, total 99.98
POST /checkout                      → 201 order-1, total 99.98
GET  /cart                          → STILL {"items":[cart-1…],"total":99.98}   ← not cleared
```
  `db.cart.clearForUser(userId)` is implemented at `db.ts:445` and **has zero call sites** (grepped).
- **Impact**: Purchased items persist. The frontend invalidates `["cart"]` correctly and refetches the same items back, so the cart page and badge still show them, and **the user can re-checkout indefinitely, creating duplicate orders**.
- **Fix**: Call `db.cart.clearForUser(userId)` after `db.orders.create(order)`.

---

## Tier 3 — Medium · ✅ ALL FIXED (2026-07-29)

### S-13 · `DELETE /cart/:itemId` has no ownership check → cross-user deletion (IDOR)
- **Location**: `apps/api/src/routes/cart.ts:73-85` · **`PROVEN`** · backend agent only
- **Evidence** — reproduced live with two real accounts:
```
victim (user-2) adds p-002        → victim cart: [cart-2]
attacker (user-1) DELETE /cart/cart-2 with ITS OWN token → HTTP 200
GET /cart as victim              → items: []   total: 0     ← victim's cart destroyed
```
  `userId` is read but never used for authorization. The sibling PUT handler does it correctly (`cart.ts:63-66`: `if (!item || item.userId !== userId)`); DELETE checks only `if (!item)`. Cart ids are sequential and guessable (`cart-1`, `cart-2`, … from `db.ts:23`).
- **Fix**: Match the PUT guard — `if (!item || item.userId !== userId)`.
- **Note**: Genuinely exploitable, but gated behind `S-5` in a browser. Not reachable from the web UI today; fully reachable from any HTTP client.

### S-14 · Zod 400s put an **object** in `error`, so users see `[object Object]`
- **Locations**: server `apps/api/src/routes/auth.ts:22,51`, `cart.ts:40,60`, `checkout.ts:13` · client `apps/web/src/lib/api.ts:36-42`
- **Verification**: **`PROVEN`** · **Corroboration**: **both agents, independently** (backend `BE-7` + frontend `FE-10` — same root defect from both sides)
- **Evidence** — live 400 body:
```
PUT /cart/cart-1 {"quantity":0}
→ {"error":{"formErrors":[],"fieldErrors":{"quantity":["Number must be greater than or equal to 1"]}}}
```
  Every *other* error in the API puts a string in `error` (`"Persona not found"`, `"Unauthorized"`, `"Cart is empty"`). The client does `new ApiError(status, body.error ?? …)` (`api.ts:38-41`), so `Error` stringifies the object → **`[object Object]`** rendered at `checkout.tsx:171`, `login.tsx:33`, `register.tsx:33`. No type guard, and `body` is `any` from `response.json()`, which is why `tsc` misses it.
- **Cross-reference resolution**: Both agents flagged this from opposite ends and **both recommended fixing the server**. Two different `error` payload types on one field is a broken contract regardless of client.
- **Fix**: Server → `{ error: "Validation failed", details: parsed.error.flatten() }`. Client → defensively use `body.error` only when it's a string, keeping the structured payload on `ApiError` for field-level display.

### S-15 · Cart "−" button is never disabled → sends `quantity: 0`, gets a 400
- **Location**: `apps/web/src/components/CartItem.tsx:40-45` · **`VERIFIED`** · **both agents** (frontend `FE-7` + shared `SH-6`)
- **Evidence** — the element carries `disabled:opacity-30 disabled:cursor-not-allowed` styling but **no `disabled` attribute is ever passed**. At `quantity === 1`, "−" sends `{quantity: 0}` → rejected by `updateCartItemSchema` (`shared/src/schemas/cart.ts:20-22`, `min(1)`) → 400, confirmed live above. No error UI, so the click silently does nothing forever. The `disabled:` classes are dead style — strong evidence the attribute was removed.
- **Cross-reference resolution**: The backend agent explicitly asked whether to relax the schema instead. **Resolved: fix the client, keep `min(1)`.** `min(1)` is the cleaner contract; the defect is the missing attribute.
- **Fix**: `disabled={item.quantity <= 1}` (or route 0 to `onRemove()`).

### S-16 · `GET /personas` bypasses `personaFilterSchema`; bad input silently returns `[]`
- **Location**: `apps/api/src/routes/personas.ts:5-17` · **`PROVEN`** · backend agent only
- **Evidence** — live: `GET /personas?minPrice=abc` → **`HTTP 200 []`** (should be 400). `Number("abc")` is `NaN`, `NaN !== undefined` so the filter runs, and every `p.price <= NaN` is `false`. Invalid `specialty`/`tier` also silently yield `[]`; invalid `sort` is silently ignored. `personaFilterSchema` — which exists with `z.coerce.number()` and enum validation — is **imported nowhere**.
- **Fix**: `safeParse(request.query)`, 400 on failure, pass `parsed.data` to `db.personas.search`.

### S-17 · `POST /favorites` performs no validation — raw unchecked cast
- **Location**: `apps/api/src/routes/favorites.ts:24-30` · **`STATIC`** · backend agent only
- The only mutating endpoint with no schema (cf. `cart.ts:38`, `checkout.ts:11`, `auth.ts:20,49`). `const { personaId } = request.body as { personaId: string }` guarded only by truthiness. Practical impact is low (`getById` 404s for non-strings), but the pattern is unsafe and there is no favorites schema to validate against — see `S-19`.
- **Fix**: Add `addFavoriteSchema` to shared and `safeParse` it.

### S-18 · `AuthResponse` and `Cart` are hand-written interfaces, not Zod-derived
- **Location**: `packages/shared/src/schemas/auth.ts:26-29`, `cart.ts:26-29` · **`VERIFIED`** · backend agent only
- Every other contract is schema-first (`personaSchema`→`Persona`, `cartItemSchema`→`CartItem`, `orderSchema`→`Order`, `userSchema`→`User`). These two — **the most-consumed response shapes in the app** — have no runtime representation, so nothing on either side of the wire can assert them.
- **This is the direct root cause of `S-10`**: an `authResponseSchema.parse()`, or even just the annotation register uses, would have caught the missing `username` immediately.
- **Fix**: Add `authResponseSchema` and `cartSchema`, derive types via `z.infer`, export from `index.ts`.

### S-19 · No favorites schema exists at all, despite three `/favorites` endpoints
- **Location**: `packages/shared/src/schemas/` · **`VERIFIED`** · backend agent only
- The `{ favorites: Persona[] }` envelope is hand-declared independently on **both** sides (`favorites.ts:12,21` server; `favorites.tsx:18` + `$personaId.tsx:25` client). Rename it server-side and only a runtime `undefined` reveals the break. Favorites is the one feature with no shared contract — and the reason `S-17` has nothing to validate against.
- **Fix**: Add `schemas/favorites.ts` with `addFavoriteSchema` + `favoritesResponseSchema`.

### S-20 · Favorites query on the detail page lacks `enabled: !!user`
- **Location**: `apps/web/src/routes/personas/$personaId.tsx:22-28` · **`VERIFIED`** · frontend agent only
- `useAuth()` is already destructured at line 15 but never used to gate this query, unlike **every** other authenticated query (`favorites.tsx:19`, `cart.tsx:20`, `checkout.tsx:23`, `__root.tsx:18`). Anonymous visitors fire a protected endpoint and, with `retry: 1`, do it twice.
- **Severity note**: The frontend agent assumed this yields a 401. Per `S-1` it currently yields a **500**, and it poisons the shared `["favorites"]` entry (`S-3`) with an error state.
- **Fix**: Add `enabled: !!user`.

### S-21 · `AuthContext.isLoading` is computed but consumed nowhere → auth flash on every reload
- **Location**: `apps/web/src/lib/auth.tsx:27` (produced), no consumers · **`VERIFIED`** · frontend agent only
- Grep of all seven `useAuth()` call sites shows nobody reads `isLoading`. On a hard reload with a valid token, `user` is `null` until `/auth/me` resolves, so `cart.tsx:38`, `checkout.tsx:34`, `favorites.tsx:30` all take their `if (!user)` branch and show **"Sign in to view your cart"** to an already-authenticated user, and `__root.tsx:94` renders Sign in / Sign up — then everything flips. The bootstrap state was designed for and never wired up.
- **Interaction with `S-1`**: `/auth/me` currently 500s, and `auth.tsx:41` only clears the token on `err.status === 401` — so a stale token is never cleared. Resolves once `S-1` is fixed.
- **Fix**: Gate protected routes on `isLoading` with a spinner.

### S-22 · `turbo.json` `dev` lacks `dependsOn: ["^build"]`, and `@acme/shared` has no watch script
- **Location**: `turbo.json:8-11`; `packages/shared/package.json:12-16` · **`VERIFIED`** · **both agents**
- `@acme/shared`'s only entry is `./dist/index.js` with no `dev`/`watch` script and no source condition. On a clean clone `pnpm dev` without a prior build fails for both apps; the README's ordering papers over it. Worse day-to-day: **while `turbo dev` runs, editing `packages/shared/src/**` has zero effect** until a manual rebuild. (`build`/`lint`/`typecheck` correctly declare `dependsOn`, so the build graph itself is fine.)
- **Latent trap**: All current web imports of shared are `import type`, so Vite erases them. The moment anyone imports a *value* (e.g. a Zod schema, as `S-16`/`S-30` recommend) this becomes a hard dev-server failure.
- **Fix**: Add `"dependsOn": ["^build"]` to `dev`; give shared a `"dev": "tsc --watch"`.

---

## Tier 4 — Low / latent / quality

| ID | Defect | Location | Verify | Found by |
|---|---|---|---|---|
| S-23 ✅ **FIXED** | `authenticate` 401s from an async preHandler without `return reply`; works only by accident (payload is small + sync, so `writableEnded` is already true). Any future async `onSend` would let the handler run against `user === null`. **Shipped with S-1 — same function, same failure mode.** | `middleware/auth.ts:13-17` | `STATIC` | BE |
| S-24 | JWTs signed with no `expiresIn` — tokens never expire. (Sign/verify payload shape is otherwise correct.) | `routes/auth.ts:39,61` | `VERIFIED` | BE |
| S-25 | JWT secret hardcoded, no `process.env.JWT_SECRET` fallback. | `index.ts:17` | `VERIFIED` | BE |
| S-26 | `simpleHash` is a 32-bit unsalted non-crypto hash used as a password hash — trivially collidable. **The comparison itself is correct** (hash-to-hash, not plaintext-to-hash). | `routes/auth.ts:8-16` | `VERIFIED` | BE |
| S-27 | `minPrice`/`maxPrice` are plumbed through search params, query string, and the shared schema but **have no UI** — reachable only by editing the URL. Truthiness guards also drop a legitimate `0`. | `routes/index.tsx:38-39`; `FilterPanel.tsx:19-26` | `VERIFIED` | FE |
| S-28 | `StarRating` hardcodes SVG gradient `id="half"`; rendered once per card, so duplicate DOM ids mean `url(#half)` resolves to the *first* match document-wide — every partial star inherits the first card's fill fraction. | `StarRating.tsx:14-28` | `VERIFIED` | FE |
| S-29 | Debounce effect depends on an unstable inline `onChange`, so any parent re-render re-arms the 300 ms timer. Latent stale-closure hazard. | `SearchBar.tsx:15-22` | `VERIFIED` | FE |
| S-30 | Shared Zod schemas are **never executed client-side** — all 11 web imports of `@acme/shared` are `import type`. No response validated, no form parsed. `register.tsx` enforces `minLength={3}` but not `maxLength={30}`, so a >30-char username round-trips to a 400 that renders per `S-14`. | `register.tsx:59-68`; all web imports | `VERIFIED` | FE |
| S-31 | Large parts of shared's export surface are dead: `personaFilterSchema`, `cartItemSchema`, `orderSchema`, `userSchema`, and **every** `*Input` type. Unused `*Input` types are why the `/auth/login` annotation was omitted (`S-10`); unused `personaFilterSchema` **is** `S-16`. | `shared/src/index.ts` | `VERIFIED` | BE |
| S-32 | Enum values duplicated **four times**: `PersonaSpecialty`/`PersonaTier` const maps (exported, unused) → `personaSchema` literals → `personaFilterSchema` literals → `FilterPanel.tsx:1-10`. Values match today; adding one needs four coordinated edits, and a miss yields a silent `[]` (`S-16`). | `schemas/persona.ts:3-16,24-31,43-46`; `FilterPanel.tsx:1-10` | `VERIFIED` | **both** |
| S-33 | `personaSchema.rating` is `.min(1)`, so a legitimate 0-rating (new persona, `reviewCount: 0`) is invalid. All seeded data is ≥4.1 and the schema is never used at runtime, so latent. | `schemas/persona.ts:34` | `STATIC` | BE |
| S-34 | Weak field constraints: `avatarUrl` not `.url()`, `price` not `.nonnegative()`, `reviewCount` not `.int()`, `createdAt` not `.datetime()`, `customerEmail` a bare string though `checkoutSchema.email` **is** `.email()`. | `schemas/persona.ts:23,33,35`; `order.ts:17,18` | `VERIFIED` | BE |
| S-35 | `/checkout` duplicates `enrichCartItems` byte-for-byte instead of reusing it, bypassing the `db` accessors. Also its emptiness guard runs *before* the `if (!persona) continue` loop, so an all-missing-persona cart mints a **201 order with `items: []`, `total: 0`**. | `checkout.ts:16-38` vs `cart.ts:6-26` | `VERIFIED` | BE |
| S-36 | `db.ts` exports `personas`/`cartItems`/`favorites` as mutable `Map`s and two route modules reach past the `db` facade to mutate them. `users`/`orders` are correctly private — inconsistent. This duplicated read logic is how `S-12`/`S-35` slipped in. | `db.ts:14,16,17`; `favorites.ts:3`; `checkout.ts:3` | `VERIFIED` | BE |
| S-37 | Order history unreachable: `db.orders.getByUserId` exists with **no route**. Orders are written on checkout and can never be read. Also dead: `db.personas.getAll`, `db.favorites.isFavorite`. **Cross-referenced: the frontend never calls `/orders`,** so latent, not broken. | `db.ts:479` | `VERIFIED` | BE |
| S-38 | Email lookup is case-sensitive → register `Jane@Example.com`, log in as `jane@example.com` → 401. Same human can register twice with different casing, bypassing the 409. `username` uniqueness never checked. | `db.ts:397-399`; `auth.ts:27` | `VERIFIED` | BE |
| S-39 | No `setErrorHandler`/`setNotFoundHandler`. Fastify defaults emit `{statusCode, error, message}` where `error` is the generic reason phrase — so every unhandled 500 (per `S-1`, currently *all* protected routes) reaches the client as the useless string `"Internal Server Error"`, since `api.ts` reads only `body.error`. | `index.ts:10-33` | `PROVEN` | BE |
| S-40 | API base URL hardcoded `http://localhost:3001` with **no Vite proxy and no env override** — nothing reads `import.meta.env.VITE_API_URL`. All traffic is cross-origin, making the CORS allowlist a hard dependency (amplifies `S-5`). | `lib/api.ts:1`; `vite.config.ts:14-16` | `VERIFIED` | FE |
| S-41 | `Content-Type: application/json` set on GET/DELETE requests that have no body — makes every request non-"simple", forcing an `OPTIONS` preflight on reads too. Directly amplifies `S-5`. | `lib/api.ts:22-25` | `VERIFIED` | FE |
| S-42 | Dead code: unused `useNavigate()` in checkout; unused `registerAuthHook` decorator helper with no call site and no `declare module` augmentation. | `checkout.tsx:15`; `middleware/auth.ts:20-22` | `VERIFIED` | both |
| S-43 | `tsconfig.base.json` uses `moduleResolution: "bundler"` and ships `DOM`/`DOM.Iterable` libs to the Node packages. Extensions are all written correctly today so runtime is fine, but `tsc` would accept a future extensionless import that crashes with `ERR_MODULE_NOT_FOUND`, and backend code typechecks against browser globals. | `tsconfig.base.json:5-6` | `VERIFIED` | BE |
| S-44 | `@acme/shared` `exports` lists `import` before `types`, has no `default` condition, and no top-level `main`/`types`. **See REFUTED note below** — resolution works; this is convention/robustness only. | `shared/package.json:6-11` | `VERIFIED` | both |

---

## REFUTED — agent claims contradicted by tooling

These were reported as defects. **Do not "fix" them as described.** Recorded so they aren't re-investigated.

### R-1 · "`createRouter({ context })` with plain `createRootRoute` causes a `tsc` error"
- Claimed: frontend `FE-11`, predicting `TS2353`/`TS2345` at `main.tsx:12`.
- **Refuted**: a real `tsc --noEmit` on `apps/web` produced **exactly one** error — the `TS4023` of `S-2` — and not this one.
- **Residue**: the *dead-configuration* half is valid and kept as a Low: no route declares a `loader` or reads `context`, so `queryClient` is threaded through the router for nothing while every component imports the singleton directly. Cosmetic.

### R-2 · "`@acme/shared` exports-map ordering breaks type resolution"
- Claimed: frontend `FE-19` and backend `SH-5`, predicting `TS7016`/`TS2307`.
- **Refuted**: both `apps/api` and `apps/web` typecheck **clean** once shared is built. The ordering is against convention but resolution succeeds. Downgraded to `S-44` (robustness/polish).

### R-3 · The 21 `apps/api` "type errors"
- Before `packages/shared` was built, `apps/api` reported 21 errors: `TS2307 Cannot find module '@acme/shared'` plus cascading `Property 'email'/'id' does not exist on type 'StoredUser'` and an implicit-`any` at `db.ts:352`.
- **All 21 vanished** once shared was built. They are artifacts of build order, **not defects**. `apps/api` typechecks clean.
- **Lesson**: always `pnpm --filter @acme/shared build` before typechecking anything, or you will chase 21 phantoms.

---

## Verified-correct — checked and clear

Recorded so these aren't re-investigated. Several were specifically suspected and ruled out.

- **Tailwind v4 setup is correct.** `app.css:1` is `@import "tailwindcss"` (v4 form), `@tailwindcss/vite` is in devDependencies and registered in the plugin array, `app.css` is imported by `main.tsx`, and no stray `postcss.config.*`/`tailwind.config.*` conflicts. **Proven**: `vite build` emits **19.89 kB** of CSS.
- **No route-prefix mismatch.** All five plugins are registered with **no `{ prefix }`**, so paths are exactly as written — matching the client's `API_BASE` which prepends nothing. Verified from both sides independently.
- **Money is decimal dollars end-to-end.** No cents/dollars confusion, no missing `* quantity`, no double-counted tax. Live: `49.99 × 2 = 99.98`. The only violation is `S-9`.
- **`db.cart.add` correctly merges duplicate lines** via `existing.quantity += quantity` rather than creating a second row.
- **Password comparison is correct** — hash-to-hash (`auth.ts:57`), not plaintext-to-hash, and no missing `await`. Only the hash *algorithm* is weak (`S-26`).
- **JWT sign/verify payload shapes match** — `{id, email}` signed, `{id, email}` read back in all four consumers. Bearer-prefix handling is correct on both sides.
- **Router registration is complete**: all 7 route files present in `routeTree.gen.ts`, every `createFileRoute` id matches its generated path, and `$personaId` matches `useParams()` and all `params={{…}}` call sites.
- **`~` path alias wired in both** `tsconfig.json` and `vite.config.ts`. Token storage key `"auth_token"` consistent across all 4 sites. All list renders have `key` props.
- **`packages/shared` compiles clean**; all four schema files correctly re-exported; `zod` correctly a direct dependency (required, since zod types appear in the public `.d.ts`); `.js`-extensioned relative imports correct for the emitted ESM.
- **`sort` enum values match across all three layers** — shared schema, backend `switch` (`db.ts:373-386`), frontend `sortOptions`.
- **No endpoint returns `204`/empty body**, so the client's unconditional `response.json()` on 2xx is safe today.

---

## Cross-reference analysis

**Independently corroborated by both agents (7)** — strongest signal: `S-1`, `S-5`, `S-10`, `S-11`, `S-14`, `S-22`, `S-32`. Plus `S-15`, where the two arrived from opposite directions (frontend "missing attribute" vs shared "schema rejects 0") and the conflict was resolved in favour of the client fix.

**Single-agent findings**: 12 frontend-only, 18 backend-only. Expected — each owned files the other couldn't see. Weaker evidence, hence the per-item verification tags.

**Contract diff produced no path/shape mismatches.** Both agents independently emitted their API contract and the two agree on every route, method, envelope, and field name. The four cross-cutting defects (`S-5`, `S-10`, `S-14`, `S-15`) are **behavioural**, not structural. This is a meaningful negative result: it rules out the whole class of "frontend calls a URL the backend doesn't serve".

**One asymmetry, deliberately not filed as a defect**: `GET /personas` returns a bare array while `GET /favorites` returns a `{ favorites: … }` envelope. Both agents noted it; the client codes to both correctly. Inconsistent, but working — and it is arguably what made `S-3` easy to introduce.

**Coverage check**: seed commit `22f9cc5` says "14 findings". The 15 high-confidence seeded bugs — `S-1` … `S-15` — track that count closely, which suggests near-complete coverage of the intended set. `S-16` onward are genuine but read as pre-existing quality debt rather than planted bugs.

### Notable process outcomes

1. **`S-2` was missed by the agent that owned the file.** Static reading cannot see it: the error surfaces in a *generated* file, and `vite build` passes because Vite doesn't typecheck. Only `tsc` catches it. Both the compiler run and the *backend* agent flagged it — a useful argument for overlapping review scopes.
2. **`S-1` masked the entire backend.** Every protected route 500s, so no cart, favorites, or checkout behaviour is observable until it's fixed. Running the server with `ENFORCE_AUTH=true` was what made `S-10`, `S-12`, `S-13`, `S-14`, and `S-16` provable rather than merely argued.
3. **Two of 60 findings were wrong in a way that would have caused harm** (`R-1`, `R-2`), and 21 more were build-order phantoms (`R-3`). Running the toolchain, not just reading code, is what separated them.

---

## Suggested fix sequence

1. ~~**`S-1`** — unblocks all observable backend behaviour.~~ ✅ done
2. ~~**`S-2`** — restores the `pnpm typecheck` gate.~~ ✅ done
3. ~~**`S-3`, `S-4`** — crash and auth-correctness.~~ ✅ done
4. ~~**`S-5` … `S-12`** — the High tier.~~ ✅ done
5. ~~**`S-13` … `S-22`** — Medium.~~ ✅ done
6. **Tier 4** — ← **next.** `S-31` is the highest-leverage remaining item (wiring the unused `*Input` types is what would have prevented `S-10`); `S-32` (four duplicated enum copies) is the standing drift risk that `S-16`'s new strict validation now makes user-visible if they ever diverge. `S-24`/`S-25`/`S-26` are the security-hygiene trio (JWT expiry, hardcoded secret, weak password hash). `S-35`/`S-36` are the structural cleanups that let `S-12` slip in originally.

**Verification gates for every fix** — all four must pass, and the first is mandatory before the others:
```bash
pnpm --filter @acme/shared build      # REQUIRED FIRST — else 21 phantom errors (R-3)
pnpm --filter @acme/api  exec tsc --noEmit
pnpm --filter @acme/web  exec tsc --noEmit    # currently fails on S-2
pnpm --filter @acme/web  exec vite build
```
For behavioural fixes, re-run the live HTTP probes — a passing typecheck did not catch a single defect in the High tier.
