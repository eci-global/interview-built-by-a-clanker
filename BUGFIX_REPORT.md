# Bug Fix Report — Agentic Personas Storefront

_Date: 2026-10-16_

## 1. Summary

| | Count |
|---|---|
| Bugs found and fixed (app code) | **35** (2 critical · 9 high · 17 medium · 7 low) |
| Repo / infra findings (reported, **not** fixed) | **12** |
| Automated API regression checks | **46 / 46 passing** (`node scripts/verify-fixes.mjs`) |
| Frontend fixes verified in a real browser | **None yet**: verified by typecheck + production build + code review only |

**How the evidence was gathered**

- **Before:** the exact API responses recorded during the session, *before* each fix was applied, using `curl` against the running dev API. There's no git history in this copy of the repo, so the "before" state can't be re-run. Those outputs are quoted as recorded. Frontend "before" evidence is the faulty code itself.
- **After:** `scripts/verify-fixes.mjs`. It's a dependency-free Node script that calls the live API and prints expected vs. actual with PASS/FAIL. Output is in [section 5](#5-after-evidence--regression-run).
- **Builds:** `tsc --noEmit` passes for `@acme/api` and `@acme/web`. `vite build` succeeds. `@acme/shared` builds.

---

## 2. Repo / structure / infra findings (not fixed)

| # | Finding | Evidence | Severity |
|---|---|---|---|
| I1 | **Dependency audit: 55 known vulnerabilities** (5 critical, 31 high, 16 moderate, 3 low). The runtime ones: `fast-jwt` (critical, via `@fastify/jwt`), `seroval` (critical, via TanStack Router), `fastify`, `find-my-way` and `fast-uri` (high). The rest are dev/build-time: `vite`, `postcss`, `nanoid`, `braces`, `picomatch`, `esbuild`, `@babel/core`. | `pnpm audit` → `55 vulnerabilities found — Severity: 3 low \| 16 moderate \| 31 high \| 5 critical` | 🟠 High |
| I2 | **A fresh clone can't run `pnpm dev` before `pnpm build`.** `@acme/shared` only exports `./dist/index.js`. `dist/` is gitignored. The turbo `dev` task has no `dependsOn: ["^build"]`. | `packages/shared/package.json` → `"import": "./dist/index.js"`. `.gitignore` → `dist/`. `turbo.json` → `"dev": { "cache": false, "persistent": true }`. *(A clean-copy run was attempted but blocked by a sandbox install error, so this is from config inspection.)* | 🟡 Medium |
| I3 | **Changes to `@acme/shared` aren't picked up in dev.** The shared package has no `dev`/watch script, and `tsx watch` doesn't reload when the shared `dist/` changes. The API has to be restarted manually after every schema change. | Touched `packages/shared/dist/index.js` while `tsx watch` was running: server start count stayed at **5 → 5** (no reload). | 🟡 Medium |
| I4 | **No automated tests and no CI.** No package has a `test` script, and there's no CI config. The only test in the repo is the regression script added in this session. | No `test` script in any `package.json`; no `.github/` directory. | 🟡 Medium |
| I5 | **All configuration is hardcoded, and there's no env support.** That covers the API port `3001`, the CORS origin `http://localhost:5173`, the web app's `API_BASE`, and the JWT secret. `.gitignore` lists `.env`, but nothing reads it. | `apps/api/src/index.ts:13,17,28`; `apps/web/src/lib/api.ts:1` | 🟡 Medium |
| I6 | **The default Fastify error handler leaks internal error messages** in its 500 responses. | Before the fixes: `{"statusCode":500,…,"message":"Cannot destructure property 'id' of 'request.user' as it is null."}` | 🟡 Medium |
| I7 | **`turbo build` and `turbo dev` fail when pnpm is only available through corepack.** | `x Unable to find package manager binary: cannot find binary path`. Workaround: `corepack enable`, or run the packages directly. | 🟢 Low (env) |
| I8 | **The `lint` task is wired up in `turbo.json` and the root `package.json`, but no package defines `lint`**, so there's no linting at all. | `grep lint apps/*/package.json packages/*/package.json` → none | 🟢 Low |
| I9 | **The `clean` scripts use `rm -rf`, which isn't portable to Windows.** It works here only because Git Bash's `rm` is on PATH. | `"clean": "rm -rf dist"` in all three packages | 🟢 Low |
| I10 | **The Node version isn't pinned.** `@types/node` is `^25.5.0`, but the runtime used is Node 24, and there's no `engines` field or `.nvmrc`. | `node -v` → `v24.18.0`; installed `@types/node` → `25.5.0` | 🟢 Low |
| I11 | **The Vite config uses the deprecated `TanStackRouterVite` export.** | `router-plugin/dist/esm/vite.d.ts:210` → `@deprecated Use 'tanstackRouter' instead.` | 🟢 Low |
| I12 | **Dead code:** `registerAuthHook`, `db.personas.getAll`, `db.orders.getByUserId` and `db.favorites.isFavorite` are never called. | grep: 0 call sites | 🟢 Low |

**Checked and found OK:**
- The lockfile is consistent (`pnpm install --frozen-lockfile` succeeds).
- The production API build plus `node dist/index.js` loads all modules (it fails only with `EADDRINUSE`, because the dev server holds the port).
- `eci.yml` is valid YAML (`product: demos\n`, LF), as the `.lore` spec requires.

---

## 3. Evidence for every fix: before → expected → after

`Test` refers to the check ID in [section 5](#5-after-evidence--regression-run). Rows marked **code** are frontend fixes: the "before" is the faulty code, and the "after" is verified by typecheck/build/code review only, not in a browser.

### 3.1 QA-reported issues

| # | Issue | Before (recorded) | Expected | After | Test | Sev |
|---|---|---|---|---|---|---|
| 1 | Favorites endpoint returned 500 | `GET /favorites` → `500 "Cannot destructure property 'id' of 'request.user' as it is null."` | 401 without a token; 200 with one | 401 / 200 | F1, F2 | 🔴 |
| 2 | Search, category and multi-category filters did nothing | **code:** `queryKey: ["personas"]`, a fixed key, so filter changes never refetched. The API itself filtered correctly (`q=security` → Zara). | The list updates on every search or filter change | Key is `["personas", qs]` | P2–P5 (API side) | 🟠 |

### 3.2 Backend bugs

| # | Issue | Before (recorded) | Expected | After | Test | Sev |
|---|---|---|---|---|---|---|
| 3 | Any user could delete another user's cart items (IDOR) | Alice `DELETE /cart/cart-1` (victim's item) → `200`; victim's cart → `{"items":[],"total":0}` | 404; victim's item untouched | 404; victim still has 1 item | C1, C2 | 🔴 |
| 4 | Checkout didn't clear the cart | `POST /checkout` → 201, then `GET /cart` → `{"items":[{"id":"cart-2",…` | Cart empty; a second checkout is rejected | 0 items; second checkout → 400 "Cart is empty" | K4, K5 | 🟠 |
| 5 | CORS blocked `DELETE` | Preflight → `access-control-allow-methods: GET, POST, PUT, OPTIONS` | DELETE allowed | `GET, POST, PUT, DELETE, OPTIONS` | X1 | 🟠 |
| 6 | Sequential user IDs restarted at `user-1` after an API restart, so old tokens mapped to new users | Register → `"id":"user-1"`, `"user-3"`, … | Non-reusable IDs | `user-<uuid>` | A10 | 🟠 |
| 7 | Cart quantity had no limit | Add qty 1e9 → `"total":49990000000`; PUT 2^53 → `"total":450269890744502100` | Max 99, including merged quantities | 400; 98+2 → 400; 98+1 → 99 | C4–C6 | 🟠 |
| 8 | `minPrice` filter was inverted | `minPrice=90` → 14 results, all ≤ 89.99 | Only prices ≥ 90 | `[99.99]` | P6, P7 | 🟡 |
| 9 | Login response was missing `username` | `"user":{"id":"user-3","email":"alice@x.com"}` | Same shape as register | Includes `username` | A9 | 🟡 |
| 10 | `POST /favorites` with no body → 500 | `500 "Cannot destructure property 'personaId' of 'request.body' as it is undefined."` | 400 | 400 "personaId is required" | F3 | 🟡 |
| 11 | Same email could register twice with different case | `ALICE@x.com` after `alice@x.com` → `201` | 409 | 409 | A4 | 🟡 |
| 12 | Search didn't match specialty or tier | `q=devops` → `[]`; `q=enterprise` → `[]` | DevOps / Enterprise personas | Pipeline Pete, Terraform Tina | P3 | 🟡 |
| 13 | Whitespace-only checkout name accepted | `{"name":"   "}` → `201`, `customerName: "   "` | 400 | 400 "Name is required"; valid input is trimmed | K1, K2 | 🟡 |
| 14 | `/personas` query wasn't validated | `minPrice=abc` → `200 []` | 400 | 400 (also for an unknown specialty) | P9, P10 | 🟢 |
| 15 | `/auth/me` returned 404 for a deleted user, so the frontend kept the stale token | **code:** `reply.status(404)` | 401, so the client clears the token | 401 | A11 | 🟢 |

### 3.3 Signup / login validation

| # | Issue | Before (recorded) | Expected | After | Test | Sev |
|---|---|---|---|---|---|---|
| 16 | Whitespace-only username accepted | `{"username":"   "}` → `201` with a token | 400 | 400 | A1 | 🟡 |
| 17 | Any characters allowed in username | `<script>` accepted (no charset rule) | 400 | 400 | A2 | 🟡 |
| 18 | Email not trimmed | `"  pad@x.com "` → `400 Invalid email` | Trimmed and lowercased | 201, stored lowercase | A3 | 🟡 |
| 19 | No maximum password length | 20,000-char password → `201` | 400 above 128 | 400 | A5 | 🟡 |
| 20 | Login accepted an empty password | `""` → `401` (reached the hash comparison) | 400 "Password is required" | 400 | A7 | 🟢 |
| 21 | Validation errors rendered as `[object Object]` in the UI | **code:** `new ApiError(status, body.error)` with `body.error` being Zod's flatten object | Readable messages | `formatError()` joins the field messages | (A1/A7 bodies) | 🟡 |

### 3.4 Frontend bugs (code evidence; not yet browser-verified)

| # | Issue | Before (code) | Expected | After | Sev |
|---|---|---|---|---|---|
| 22 | Favorite heart toggle inverted | `!isFavorited ? api.delete(…) : api.post(…)` | Click empty heart → add | `isFavorited ? delete : post` | 🟠 |
| 23 | Two pages stored different data under the `["favorites"]` cache key | Detail page cached `string[]`; Favorites page cached `{favorites: Persona[]}` | One shape, so no empty list or crash | Detail page uses `select` on the shared shape | 🟠 |
| 24 | Card prices shown 100× too high | `${(persona.price * 100).toFixed(2)}` → `$4999.00` | `$49.99` | `persona.price.toFixed(2)` | 🟠 |
| 25 | Sign out kept the token, so a refresh logged you back in | `logout()` didn't touch localStorage or the query cache | Fully signed out; previous user's data gone | Removes `auth_token` + `queryClient.clear()` | 🟠 |
| 26 | Header cart badge never updated | Header used `["cart-count"]`; mutations invalidated `["cart"]` | Badge updates | Header uses `["cart"]` | 🟡 |
| 27 | Rapid "+" clicks lost updates | Each click sent `item.quantity + 1` from stale data; buttons stayed enabled; refetch window | Each click counts | Buttons disabled while a change is in flight; cache set from the API response | 🟡 |
| 28 | No error state on the browse page | API errors showed "No personas found" | Error message + retry | Error view with "Try again" / "Clear filters" | 🟡 |
| 29 | No redirect back after sign-in | `navigate({ to: "/" })` always | Return to the page you came from | `?redirect=` on all sign-in links; same-origin paths only | 🟡 |
| 30 | "Sign in to…" flashed on refresh | Pages ignored the auth `isLoading` flag | No flash | Pages and header wait for the auth check | 🟡 |
| 31 | No navigation on mobile | Nav links `hidden sm:flex` with no fallback | Browse/Favorites reachable on a phone | Links always visible; brand text and username hidden on xs | 🟡 |
| — | Cart "−" could go below 1 (silent 400) | Disabled styles present, no `disabled` prop | Disabled at 1 | `disabled={… \|\| quantity <= 1}` | 🟢 |
| — | Detail page fetched favorites while logged out | No `enabled` flag → 401 | Only fetch when logged in | `enabled: !!user` | 🟢 |
| — | Half-star ratings identical on every card | Every SVG used `id="half"` | Each card's own fill | `useId()`-based gradient id | 🟢 |
| — | `tsc` typecheck failed | `TS4023: … 'SearchParams' … cannot be named` | Typecheck passes | `export interface SearchParams` | 🟢 |

---

## 4. Changes made, by file

| File | Change | Fixes |
|---|---|---|
| `apps/api/src/middleware/auth.ts` | Removed the `ENFORCE_AUTH` toggle (auth always enforced); `return` after sending 401 | 1 |
| `apps/api/src/index.ts` | Added `DELETE` to the CORS methods | 5 |
| `apps/api/src/db.ts` | `minPrice` uses `>=`; search also matches `specialty` and `tier` | 8, 12 |
| `apps/api/src/routes/auth.ts` | UUID user IDs; login returns `username`; `/auth/me` returns 401 for a missing user | 6, 9, 15 |
| `apps/api/src/routes/cart.ts` | Ownership check on DELETE; merged-quantity cap | 3, 7 |
| `apps/api/src/routes/checkout.ts` | Uses the `db` API instead of the raw Maps; clears the cart after the order; empty-cart check after filtering | 4 |
| `apps/api/src/routes/favorites.ts` | Uses the `db` API; validates the body, so a missing body returns 400 instead of 500 | 10 |
| `apps/api/src/routes/personas.ts` | Validates the query with the (previously unused) `personaFilterSchema` | 14 |
| `packages/shared/src/schemas/auth.ts` | Username trim/3–30/charset; email trim+lowercase; password 6–128; login password required | 11, 16–20 |
| `packages/shared/src/schemas/cart.ts` | `MAX_CART_QUANTITY = 99` on all quantity fields | 7 |
| `packages/shared/src/schemas/order.ts` | Checkout name trimmed and required (max 100); email trimmed | 13 |
| `packages/shared/src/index.ts` | Exports `MAX_CART_QUANTITY` | 7 |
| `apps/web/src/routes/index.tsx` | Query key includes the filters; error state; exported `SearchParams` | 2, 28 |
| `apps/web/src/routes/personas/$personaId.tsx` | Toggle fixed; shared favorites cache shape; `enabled: !!user`; sign-in redirect; auth-loading guard | 22, 23, 29, 30 |
| `apps/web/src/routes/cart.tsx` | Cache set from the mutation response; buttons disabled while pending; redirect; auth-loading guard | 27, 29, 30 |
| `apps/web/src/routes/favorites.tsx`, `checkout.tsx` | Sign-in redirect; auth-loading guard | 29, 30 |
| `apps/web/src/routes/login.tsx`, `register.tsx` | Accept `?redirect=`, navigate there after auth; register `maxLength`/`pattern` | 29, 16–19 |
| `apps/web/src/routes/__root.tsx` | Cart badge cache key; mobile nav; auth-loading guard; redirect on header links | 26, 30, 31 |
| `apps/web/src/components/PersonaCard.tsx` | Price no longer × 100 | 24 |
| `apps/web/src/components/CartItem.tsx` | "−" disabled at 1, "+" at 99, all buttons while pending | 27 |
| `apps/web/src/components/StarRating.tsx` | Unique gradient id per instance | (low) |
| `apps/web/src/components/SearchBar.tsx` | Placeholder mentions specialty | 12 |
| `apps/web/src/lib/api.ts` | `formatError()` for Zod-shaped errors | 21 |
| `apps/web/src/lib/auth.tsx` | Logout clears the token and the query cache | 25 |
| `apps/web/src/lib/redirect.ts` *(new)* | `safeRedirect` / `validateAuthSearch`, same-origin only | 29 |
| `scripts/verify-fixes.mjs` *(new)* | API regression script | evidence |

---

## 5. After evidence — regression run

Command: `node scripts/verify-fixes.mjs` against the dev API (`http://localhost:3001`).

```
ID    Result  Area        Check                                                      Expected                             Actual
H1    PASS    Infra       Health endpoint                                            200 {status:ok}                      200 {"status":"ok"}
X1    PASS    CORS        Browser preflight allows DELETE                            allow-methods includes DELETE        GET, POST, PUT, DELETE, OPTIONS
A1    PASS    Validation  Register with whitespace-only username                     400                                  400 {"error":{…"username":["Username must be at least 3 chara...
A2    PASS    Validation  Register with disallowed username characters               400                                  400
A3    PASS    Validation  Register trims + lowercases email                          201, email=mixed.<run>@example.com   201 mixed.<run>@example.com
A4    PASS    Validation  Duplicate email with different case rejected               409                                  409
A5    PASS    Validation  Password longer than 128 chars rejected                    400                                  400
A6    PASS    Validation  Password shorter than 6 chars rejected                     400                                  400
A7    PASS    Validation  Login with empty password                                  400 'Password is required'           400 {…"password":["Password is required"]}}}
A8    PASS    Auth        Login with wrong password                                  401                                  401
A9    PASS    Auth        Login response includes username (same shape as register)  200, user.username='mixed'           200 {"id":"user-724444ec-…","username":"mixed",…
A10   PASS    Auth        User ids are not sequential (no 'user-1' reuse after restart) user-<uuid>                         user-724444ec-09a1-4478-b0a8-fb25037237db
A11   PASS    Auth        /auth/me without token                                     401                                  401
A12   PASS    Auth        /auth/me with valid token                                  200 with username                    200 {…"username":"mixed",…
A13   PASS    Auth        Protected route with invalid token                         401                                  401
F1    PASS    Favorites   GET /favorites without token (was the QA-reported 500)     401                                  401 {"error":"Unauthorized"}
F2    PASS    Favorites   GET /favorites with token, empty list                      200 {favorites:[]}                   200 {"favorites":[]}
F3    PASS    Favorites   POST /favorites with no body                               400                                  400 {"error":"personaId is required"}
F4    PASS    Favorites   Add favorite then list it                                  200, list=[p-004]                    200, list=["p-004"]
F5    PASS    Favorites   Favorite an unknown persona                                404                                  404
F6    PASS    Favorites   Remove favorite, then remove again                         200 then 404                         200 then 404
C1    PASS    Cart        User A deletes user B's cart item (IDOR)                   404, B's item still there            404, B has 1 item(s)
C2    PASS    Cart        Owner deletes own cart item                                200, cart empty                      200, 0 item(s)
C3    PASS    Cart        GET /cart without token                                    401                                  401
C4    PASS    Cart        Add quantity 1,000,000,000                                 400 (max 99)                         400 {…"quantity":["Quantity cannot exceed 99"]}}}
C5    PASS    Cart        Merged quantity capped: 98+2 rejected, 98+1 accepted       400, then 200 qty=99                 400, then 200 qty=99
C6    PASS    Cart        PUT quantity 2^53-1                                        400                                  400
C7    PASS    Cart        PUT quantity 0                                             400                                  400
C8    PASS    Cart        PUT quantity 2, total recomputed                           200, total=99.98                     200, total=99.98
K1    PASS    Checkout    Checkout with whitespace-only name                         400 'Name is required'               400 {…"name":["Name is required"]}}}
K2    PASS    Checkout    Checkout trims name and email                              201, 'Jane Doe' / 'jane@example.com' 201, 'Jane Doe' / 'jane@example.com'
K3    PASS    Checkout    Order total matches cart                                   99.98                                99.98
K4    PASS    Checkout    Cart is emptied after checkout                             0 items                              0 items
K5    PASS    Checkout    Second checkout of the same cart                           400 'Cart is empty'                  400 {"error":"Cart is empty"}
P1    PASS    Personas    List all                                                   15 personas                          15
P2    PASS    Search      q=security                                                 includes Zero-Day Zara               ["Zero-Day Zara","Compliance Carl"]
P3    PASS    Search      q=devops matches DevOps specialty                          Pipeline Pete, Terraform Tina        ["Pipeline Pete","Terraform Tina"]
P4    PASS    Filter      specialty=Security                                         2 results, all Security              2: ["Zero-Day Zara","Compliance Carl"]
P5    PASS    Filter      specialty=Engineering&tier=Pro (combined)                  3 results, all Engineering+Pro       3: ["Refactor Rex","Test Pilot Theo","Migrator Max"]
P6    PASS    Filter      minPrice=90                                                only prices >= 90                    [99.99]
P7    PASS    Filter      minPrice=60&maxPrice=70                                    only 60 <= price <= 70               [69.99,64.99]
P8    PASS    Sort        sort=price-asc                                             ascending prices                     [34.99,39.99,44.99,49.99,49.99,54.99,…]
P9    PASS    Validation  minPrice=abc                                               400                                  400
P10   PASS    Validation  Unknown specialty                                          400                                  400
P11   PASS    Personas    GET /personas/p-001                                        200 Refactor Rex                     200 Refactor Rex
P12   PASS    Personas    GET unknown persona                                        404                                  404

46/46 passed
```

`q=security` now returns two personas (Zara and Compliance Carl) instead of one. That's expected: fix #12 makes search match the specialty field, and Carl's specialty is Security.

---

## 6. Still open

- **Not browser-verified:** fixes 2 and 22–31 need a manual pass in a browser.
- **Low-severity gaps left as-is:**
  - Contradictory price filters return `200 []`.
  - "Add to Cart" shows no success or error message.
  - The checkout email isn't prefilled.
  - The order confirmation is lost on refresh (there's no `GET /orders`).
  - There's no price filter in the UI.
- **Out of assessment scope:** JWT expiry and secret management, password hashing, rate limiting, persistence.

## 7. Reproduce

```bash
corepack pnpm install
(cd packages/shared && npx tsc)               # build shared (see I2/I3)
(cd apps/api && npx tsx watch src/index.ts)   # API on :3001
(cd apps/web && npx vite)                     # Web on :5173
node scripts/verify-fixes.mjs                 # 46 checks, exits non-zero on failure
```
