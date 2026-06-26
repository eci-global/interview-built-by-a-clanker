# BUGS — Agentic Personas Storefront

Catalog of issues found via **static review** + **end-to-end runtime testing**.

## ✅ RESOLUTION — all fixed, each in its own commit (branch `dev`, not pushed)

Every item below is fixed with a dedicated test, an explanatory code comment, and a single commit.
Gate is green across the monorepo: **build ✓ · 47 tests ✓ (20 api + 27 web) · lint ✓ · typecheck ✓**
(the B3 refactor also incidentally cleared a pre-existing `routeTree.gen.ts` typecheck error).
All headline flows re-verified live in the browser (prices, price+specialty filters refetch,
register→cart→checkout-clears, favorites incl. the cache-collision case, logout persistence).

Commit map: B1 `19d4915` · B2 `f7543c9` · B3 `0fbc9d3` · B4 `13d7f2e` · B5 `cbf750c` · B6 `0c1836e`
· B7 `a2cf1ad` · B8 `770428a` · B9 `cb9da7d` · B10 `d65fc17` · B11 `02305d1` · B12 `ca9d741`
· B13 `82c0c13` · B14 `5e4f96a` · B15 `718391c` · B16 `0bb932b` · B17 `91e1d2e` · B18 `f05b87a`
· B19 `a7acd38` · B20 `14533b5` · B21 `36fe8b6` · B22 `6c145a2` · B23 `8b01535` · B24 `b48787a`
· B25 `7091d50` · B26 `d25b6de` · B27 `40e0a6f` · **B28 `d7b5e31`** (new: unused `navigate` in
checkout, surfaced by the new ESLint setup). Test tooling: `29fbbb1`.

Notes on judgment calls: B22 was resolved by **adding** the missing price-range UI (rather than
deleting the working backend plumbing). B24 de-duplicated `tierColors` but deliberately kept
FilterPanel's literal enum lists — importing the runtime enums from `@acme/shared` would pull zod
into the client bundle (~13 KB gzip). The original inventory is preserved below.

---

(Original inventory — captured before fixing.)

**Verification key:** 🔬 confirmed live (API curl and/or browser) · 📖 static (read code) ·
🧩 static + strong logical inference.

**Severity:** Critical = app broken / data-exposure · High = a core flow visibly broken ·
Medium = degraded behavior or security smell · Low/Nit = cleanup, DX, style.

> Test note: every authenticated route returns **500** out of the box (B1). To exercise the
> cart/favorites/checkout flows during testing I temporarily ran the API with `ENFORCE_AUTH=true`
> (env only, no code change) and **reverted it afterward**. The app is currently back in pristine
> (500-on-auth) state.

## Summary table

| # | Sev | Ver | Area | Location | One-liner |
|---|-----|-----|------|----------|-----------|
| B1 | Critical | 🔬 | API auth | `apps/api/src/middleware/auth.ts:3-18` | Auth disabled by default → `request.user` never set → **every** `/cart`,`/favorites`,`/checkout`,`/auth/me` request 500s |
| B2 | High | 🔬 | Web pricing | `apps/web/src/components/PersonaCard.tsx:63` | Browse-card price ×100 ($49.99 → **$4999.00/mo**) |
| B3 | High | 🔬 | Web data | `apps/web/src/routes/index.tsx:42-48` | `queryKey:["personas"]` omits filters → search/specialty/tier/sort **never refetch** |
| B4 | High | 🔬 | Web favorites | `apps/web/src/routes/personas/$personaId.tsx:40-48` | Favorite toggle inverted (POST/DELETE swapped) — can't add or remove |
| B5 | High | 🔬 | API search | `apps/api/src/db.ts:364-366` | `minPrice` filter uses `<=` (should be `>=`) — returns the cheapest, not the priciest |
| B6 | High | 🔬 | API checkout | `apps/api/src/routes/checkout.ts:9-53` | Order placed but cart **never cleared** → can re-checkout same cart forever |
| B7 | High | 🔬 | API security | `apps/api/src/routes/cart.ts:73-85` | **IDOR**: `DELETE /cart/:itemId` has no ownership check — any user deletes any user's item |
| B8 | High | 🔬 | Contract | `apps/api/src/routes/auth.ts:62-65` | Login response omits `username` → violates `AuthResponse`; blank nav name under real config |
| B9 | High | 🔬 | Web↔API DELETE | `apps/web/src/lib/api.ts:22-34` | `api.delete` sends `Content-Type: application/json` with empty body → Fastify **400 `FST_ERR_CTP_EMPTY_JSON_BODY`** on every cart/favorite removal |
| B10 | High | 🧩 | Build/DX | `turbo.json:8-11` + `packages/shared/package.json` | `pnpm dev` on a clean clone fails: `@acme/shared` has no `dev` script and `dev` task lacks `dependsOn:["^build"]`, so `dist/` is missing |
| B11 | Medium | 🔬 | Web favorites | `$personaId.tsx:22-28` vs `favorites.tsx:16-20` | Same `["favorites"]` key holds two shapes (`string[]` vs `{favorites:Persona[]}`) → visiting a detail page makes the Favorites page show "empty" |
| B12 | Medium | 🔬 | Web auth | `apps/web/src/lib/auth.tsx:55-58` | `logout()` doesn't `removeItem("auth_token")` → reload silently re-logs in |
| B13 | Medium | 🔬 | CORS | `apps/api/src/index.ts:15` | CORS `methods` lacks `DELETE` → browser preflight blocks cart/favorite removal (compounds B9) |
| B14 | Medium | 📖 | Web data | `apps/web/src/routes/__root.tsx:16-19` | Nav cart badge keyed `["cart-count"]` but mutations invalidate `["cart"]` → stale count + double-fetch |
| B15 | Medium | 🔬 | Web/UX | `apps/web/src/components/CartItem.tsx:40-45` | "−" button styled-disabled but no `disabled` prop → at qty 1 sends qty 0 → API 400, silent fail |
| B16 | Medium | 📖 | Security | `apps/api/src/routes/auth.ts:8-16`, `index.ts:17` | Non-crypto, unsalted `simpleHash` for passwords; hard-coded JWT secret |
| B17 | Medium | 🧩 | Web/Authz | `$personaId.tsx:22-28` | Favorites query missing `enabled:!!user` → fires for guests (401 under enforced auth, console errors) |
| B18 | Low | 📖 | Dead code | `apps/api/src/middleware/auth.ts:20-22` | `registerAuthHook` / `app.authenticate` decorator exported but never wired up |
| B19 | Low | 📖 | DX | `turbo.json:12-14`, root `package.json:6` | `turbo lint` task but no ESLint config and no workspace `lint` scripts |
| B20 | Low | 📖 | Web data | `index.tsx:38-39` | `if (search.minPrice)` truthiness drops a legitimate `minPrice=0` |
| B21 | Low | 📖 | Consistency | `personas.ts:5-16` vs `packages/shared/.../persona.ts:41-54` | Route hand-parses query; `personaFilterSchema` exported but unused (no enum validation) |
| B22 | Low | 📖 | Dead feature | `index.tsx` + `FilterPanel.tsx` | min/max price plumbed end-to-end but no UI exposes it |
| B23 | Nit | 📖 | Web SVG | `apps/web/src/components/StarRating.tsx:22-24` | Duplicate `id="half"` gradient across stars → invalid DOM, half-fills can render wrong |
| B24 | Nit | 📖 | Smell | `PersonaCard.tsx:5` / `$personaId.tsx:73` / `persona.ts:3-16` | Duplicated `tierColors`; `PersonaSpecialty`/`PersonaTier` enums exported but unused |
| B25 | Nit | 📖 | Config | `tsconfig.base.json:5` | API (Node/tsx runtime, `.js` import suffixes) uses `moduleResolution:"bundler"` — should be `nodenext` |
| B26 | Nit | 📖 | Smell | `main.tsx:13` vs `queryClient.ts:7` | `defaultPreloadStaleTime:0` vs 60s query `staleTime` — contradictory caching |
| B27 | Nit | 📖 | Smell | `apps/api/src/db.ts:1` | Unused `CartItem` type import |

---

## Details

### B1 — Auth disabled by default crashes every authenticated route (Critical) 🔬
`middleware/auth.ts`: `ENFORCE_AUTH = process.env.ENFORCE_AUTH === "true"` defaults **false**. When
false, `authenticate()` `return`s immediately without `request.jwtVerify()`, so `request.user` is
never populated. Handlers then do `const { id: userId } = request.user as {id}` and destructure
`null`.
**Confirmed:** `GET /cart` and `GET /auth/me` with a valid token → `500 {"message":"Cannot
destructure property 'id' of 'request.user' as it is null."}`. This takes down cart, favorites,
checkout, and `/auth/me` entirely. Also cascades: in `auth.tsx` the `/auth/me` `.catch` only handles
401, so a 500 leaves the user half-initialized.
*Fix direction:* always `jwtVerify()` (401 on failure), or populate a guest `request.user` when not enforcing.

### B2 — Browse-card price ×100 (High) 🔬
`PersonaCard.tsx:63` renders `${(persona.price * 100).toFixed(2)}`. **Confirmed in browser:** first
card shows `$4999.00/mo`. Detail page (`$personaId.tsx:125`) and cart format correctly → inconsistent.

### B3 — Browse list never refetches on filter/search/sort (High) 🔬
`index.tsx` `useQuery({ queryKey: ["personas"], ... })` — key omits the filters; `queryFn` closes over
`queryString`. With 60s `staleTime` the cached first page is reused. **Confirmed in browser:** clicked
"Security", URL → `?specialty=Security`, but grid still showed all 15 personas. API filtering itself works.

### B4 — Favorite toggle inverted (High) 🔬
`$personaId.tsx`: `!isFavorited ? api.delete(...) : api.post(...)`. Reversed — not-favorited sends
DELETE (404), favorited sends POST (re-add). **Confirmed via API:** DELETE of a non-favorite returns
404. The heart never adds a new favorite nor removes an existing one.

### B5 — `minPrice` uses `<=` instead of `>=` (High) 🔬
`db.ts:365`. **Confirmed:** `GET /personas?minPrice=80` returns 13 personas (everything ≤80) instead
of the 2 priced ≥80. (Only reachable via query string today — no UI, see B22.)

### B6 — Checkout never clears the cart (High) 🔬
`checkout.ts` returns the order without calling `db.cart.clearForUser(userId)` (helper exists at
`db.ts:445`). **Confirmed:** add 2 items → checkout 201 → `GET /cart` still returns 2 items / total
189.97. Frontend invalidates `["cart"]` but the refetch shows the still-full cart.

### B7 — IDOR on cart item DELETE (High, security) 🔬
`cart.ts:73-85` fetches by id and removes with **no `item.userId === userId` check** (the PUT handler
at `:63-64` does check). IDs are sequential (`cart-1`,`cart-2`…). **Confirmed:** user B deleted user
A's `cart-3` (HTTP 200, A's cart emptied).

### B8 — Login response omits `username` (High, contract) 🔬
`auth.ts:62-65` returns `user:{id,email}` — no `username`, violating `AuthResponse`/`User`
(`shared/schemas/auth.ts`). **Confirmed:** login JSON lacks `username`. Masked at runtime only because
`auth.tsx` then calls `/auth/me` (which includes it) — but under the real broken middleware (B1)
`/auth/me` 500s, so the nav name stays blank. Register returns username correctly; login is inconsistent.

### B9 — Bodyless DELETE sent with JSON content-type → 400 (High) 🔬
`api.ts` `request()` always sets `Content-Type: application/json`; `api.delete` passes no body. Fastify
rejects empty-body + JSON content-type. **Confirmed:** `DELETE /cart/:id` with `Content-Type:
application/json` and no body → `400 FST_ERR_CTP_EMPTY_JSON_BODY`; the same call without the header →
200. Independent of B13 — both must be fixed for cart/favorite removal to work from the browser.
*Fix direction:* don't set the JSON content-type when there's no body (set it only in post/put, or only when body present).

### B10 — `pnpm dev` fails on a clean clone (High, DX) 🧩
`@acme/shared` `exports` points only at `./dist/*` and has **no `dev` script**; `turbo.json` `dev`
task has **no `dependsOn:["^build"]`**. So `turbo dev` starts api (`tsx watch`) and web (`vite`)
without building shared → `dist/index.js` missing → module-not-found until a manual `pnpm build`.
README's "build then dev" hides it. (Not runtime-retested to avoid breaking the live servers; config is unambiguous.)

### B11 — `["favorites"]` cache key holds two shapes (Medium) 🔬
`$personaId.tsx` query returns `string[]` (ids); `favorites.tsx` returns `{favorites:Persona[]}` — same
key. **Confirmed in browser:** fresh Favorites load shows 1 card (Zero-Day Zara); after first visiting
`/personas/p-002` then navigating to `/favorites`, it shows "You haven't favorited any personas yet"
(0 cards) because `data?.favorites` is `undefined` over the poisoned `string[]` cache.

### B12 — Logout leaves JWT in localStorage (Medium) 🔬
`auth.tsx` `logout()` clears React state but not `localStorage`. **Confirmed in browser:** after Sign
out the token remained; a reload silently logged back in as the same user.

### B13 — CORS missing DELETE (Medium) 🔬
`index.ts:15` `methods:["GET","POST","PUT","OPTIONS"]`. DELETE is used by cart & favorites. Browser
preflight won't allow it → removal blocked cross-origin (web :5173 → api :3001). Compounds B9.

### B14 — Nav cart badge stale (Medium) 📖
`__root.tsx` badge keyed `["cart-count"]`; all mutations invalidate `["cart"]`. Different keys → badge
never refetches after add/update/remove/checkout, and `/cart` is fetched twice.

### B15 — Quantity "−" not actually disabled (Medium) 🔬
`CartItem.tsx` has `disabled:` classes but no `disabled` prop. At qty 1, clicking "−" sends qty 0;
`updateCartItemSchema` requires `min(1)`. **Confirmed:** API rejects qty 0 / -5 with 400; the mutation
fails silently (no error UI).

### B16 — Weak password hashing + hard-coded JWT secret (Medium, security) 📖
`auth.ts` `simpleHash` is a 32-bit non-crypto hash, unsalted, stored as `hashed_<int>` — reversible /
collision-prone. JWT secret is the literal `"agentic-personas-dev-secret"` in `index.ts`. (Plausibly
intentional for a dev assessment, but flagged.)

### B17 — Detail-page favorites query missing `enabled:!!user` (Medium) 🧩
`$personaId.tsx` runs the `/favorites` query unconditionally, unlike the other authed queries. For
guests it 401s (and 500s under B1). Also feeds B11.

### B18–B27 — see summary table
Dead code (`registerAuthHook` B18; unused `CartItem` import B27), DX (`lint` task with no ESLint B19),
data edge (`minPrice=0` dropped B20), unused `personaFilterSchema`/manual parsing B21, dead price-range
feature B22, duplicate SVG gradient id B23, duplicated `tierColors` + unused shared enums B24,
`moduleResolution:"bundler"` for a Node runtime B25, contradictory stale-time config B26.

---

## Notes
- `origin/answer-key` branch (official key) was **not** consulted — findings are independent
  (static read + live testing). Worth a `git diff origin/master origin/answer-key` to reconcile.
- Backend behavior that is **correct** (verified): cart per-user isolation; cart add de-dupes and sums
  quantity; favorites are idempotent and per-user isolated (no favorites IDOR); checkout/register/login
  Zod validation (empty name, bad email, short password/username, empty cart, dup email, wrong password)
  all reject with 400/401/409 as expected; persona 404s; `/auth/me` returns full user.
