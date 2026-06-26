# SCRATCH — Session Handoff Notes

## Goal
Clone the "Agentic Personas Storefront" debugging assessment repo, find & fix the
intentionally-introduced bugs, and get it running locally for the user to inspect in a browser.

## Repo facts
- Source: https://github.com/eci-global/interview-built-by-a-clanker (branch: master)
- Working dir: /Users/aaron/Code/debug-challenge
- Working branch: `dev` (created off master)
- There is a `remotes/origin/answer-key` branch — the official answer key. NOT consulting it
  unless we get stuck (we want to find bugs independently first).
- HEAD commit message hints: "Technical Assessment (14 findings)" → expect ~14 planted bugs.

## Tech stack
- Monorepo: Turborepo + pnpm workspaces (pnpm@9.15.0)
- apps/web: React 19, TanStack Router + Query, Tailwind v4, Vite (port 5173)
- apps/api: Fastify 5, JWT auth, in-memory DB (port 3001)
- packages/shared: TS types + Zod schemas

## How to run
```
pnpm install
pnpm build
pnpm dev
```
Frontend: http://localhost:5173 · API: http://localhost:3001

## Progress log
- [x] Cloned repo, created `dev` branch
- [x] Created SCRATCH.md and BUGS.md
- [x] pnpm install
- [x] Read through all source files (every file in apps/ and packages/)
- [x] Cataloged 11 bugs in BUGS.md and fixed all of them
- [x] `pnpm build` passes clean after fixes
- [x] Browser verification done — see results below

## Verification results (browser + API)
- API smoke tests (curl): minPrice `>=` works; register/login both return `username`;
  protected routes 401 without token and 200 with token; checkout clears cart; favorites work.
- Browser (localhost:5173): browse grid renders, prices correct ($49.99, not $4999 — fix #9);
  clicking Security filter refetches to just the 2 Security personas (fix #7); register→nav shows
  "aaron" + Favorites link + cart icon (fixes #2/#3); zero console errors.

## Running servers (this session)
- API: standalone `pnpm dev` in apps/api on :3001 (in-memory DB, resets on restart!).
- Web: managed by the Claude preview server on :5173 (.claude/launch.json, autoPort:false because
  API CORS only allows origin http://localhost:5173).
- NOTE: in-memory DB means accounts/cart/favorites vanish on API restart — re-register each time.
- To run normally without the preview tooling: just `pnpm dev` from repo root (turbo runs both).

## Git state
- On branch `dev`. Source tree is at PRISTINE clone state (my earlier fixes were reverted per-file
  on user request to do a clean-room audit). `git status` shows only untracked: BUGS.md, SCRATCH.md, .claude/.

## PHASE 2 — clean-room audit (current)
- User asked to start over: do a STATIC review + END-TO-END flow testing, catalog everything, DO NOT FIX.
- Reverted my 11 earlier fixes (git checkout per-file) so the audit runs against the real buggy code.
- BUGS.md was rewritten as the authoritative catalog: **27 findings (B1–B27)**, each tagged
  static/live-confirmed + severity. Highlights beyond the original pass:
  - B9 (NEW, live): `api.delete` sends `Content-Type: application/json` w/ empty body → Fastify
    400 `FST_ERR_CTP_EMPTY_JSON_BODY`. Breaks cart/favorite removal *independently* of the CORS bug (B13).
  - B11 (live): `["favorites"]` query key holds two different shapes → Favorites page shows "empty"
    after visiting a detail page first.
  - B16 weak hashing + hard-coded JWT secret; B10 `pnpm dev` clean-clone build-order failure;
    B17 detail favorites query missing `enabled`; plus dead code / config nits B18–B27.
- An independent static-review subagent was run in parallel and corroborated the e2e findings.

### Testing workaround used (and reverted)
- B1 (auth middleware) 500s ALL authed routes, blocking flow testing. Temp workaround: ran the API
  with `ENFORCE_AUTH=true` (env only — makes the middleware actually jwtVerify + populate request.user).
  REVERTED: API now runs plain `pnpm dev` again; `/cart` with token 500s as in pristine. Confirmed.

### Verified-correct backend behavior (not bugs)
- cart per-user isolation; add de-dupes+sums qty; favorites idempotent + per-user (no IDOR); checkout/
  auth Zod validation all reject bad input; persona 404; `/auth/me` returns full user incl. username.

## Servers right now
- API: plain `pnpm dev` (apps/api) on :3001, PRISTINE → authed routes 500 by design-bug B1.
- Web: Claude preview server on :5173 (serverId changes per session).
- In-memory DB resets on API restart.

## PHASE 3 — fixes landed (DONE)
- All B1–B27 fixed + B28 (new: unused `navigate` in checkout, found via the new ESLint).
- One commit per bug, in severity/dependence order, each with: a test (failing→passing), an
  explanatory code comment, and a descriptive commit message. See BUGS.md for the commit map.
- Added test tooling first (commit `29fbbb1`): Vitest in api (Fastify `inject` via a new
  `buildApp()` factory) + web (jsdom + Testing Library). Also added a real ESLint flat config (B19).
- Monorepo gate all green: `pnpm build`, `pnpm test` (47), `pnpm lint`, `pnpm typecheck`.
- Re-verified every major flow live in the browser; zero console errors.
- Testing workaround note: no env workaround needed this phase — B1 was fixed first, which
  unblocked all authed-route testing directly.
- NOT pushed (per user). Branch `dev`, ~29 commits ahead of `master`.
- BUGS.md / SCRATCH.md / .claude/ remain UNTRACKED working notes (never committed).

## Possible follow-ups (not requested)
- Order history endpoint exists in db (`orders.getByUserId`) but no route/UI surfaces it.
- `simpleHash`→scrypt means any pre-existing seeded user hashes would be invalid, but there are
  none (users are created at runtime only), so no migration needed.

## Bugs at a glance (see BUGS.md for full detail + fixes)
API: (1) minPrice filter inverted `<=`→`>=`  (2) login response missing `username`
(3) auth middleware never ran jwtVerify → request.user undefined → all protected routes 500
(4) CORS missing DELETE  (5) checkout never cleared the cart
Web: (6) logout didn't clear localStorage token  (7) browse queryKey missing filters → no refetch
(8) favorite toggle logic inverted  (9) PersonaCard price ×100  (10) cart "−" button not disabled at qty 1
(11) nav cart badge used a stale separate query key

## Approach notes for a fresh session
- Build passes types-clean, so all bugs are runtime/logic, not compile errors.
- `origin/answer-key` is the official answer key branch. I did NOT look at it — found bugs by
  reading the code. If picking this up, `git diff origin/master origin/answer-key` reveals the
  canonical set; cross-check against my 11, esp. #11 (medium-confidence) and any I may have missed.

## How to run (servers)
- `pnpm dev` from repo root runs both via turbo. Web on :5173, API on :3001.
- The web dev server proxies nothing — frontend calls http://localhost:3001 directly (see
  apps/web/src/lib/api.ts API_BASE). Both must be up.

## Open questions / notes
- Did not exhaustively confirm there are exactly 14 planted bugs; found 11 by reading. Browser
  smoke test pending to catch anything behavioral I missed.
