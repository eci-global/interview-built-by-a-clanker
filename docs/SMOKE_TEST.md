# Smoke-Test Wiring

This document describes how the **Agentic Personas Storefront** monorepo is wired
for Lore's `project-smoke-test` action, and — just as importantly — how this
project diverges from the Lore reference stack. Read the caveats before
interpreting any smoke-test result.

## What the action does here

The `project-smoke-test` action reads its `AppLifecycleParams` from
[`lore.yml`](../lore.yml) at the repository root. The phase-to-command mapping is:

| Phase   | Command                             | Notes                                                             |
| ------- | ----------------------------------- | ----------------------------------------------------------------- |
| setup   | `pnpm install --frozen-lockfile`    | pnpm installs devDependencies by default; frozen for determinism. |
| build   | `pnpm build`                        | `turbo build`: `@acme/shared` → `@acme/api` → `@acme/web`.        |
| verify  | `pnpm typecheck`                    | `turbo typecheck` (`tsc --noEmit`); strongest available signal.   |
| start   | `scripts/start-smoke.sh`            | API-first ordering (see below). The harness prefixes `bash`, so the manifest value must **not** start with `bash` (otherwise `bash bash scripts/...` fails). |

Additional parameters:

- **`workingDir: .`** — all root scripts run from the monorepo root.
- **`baseUrl: http://localhost:5173`** — this **overrides** the Lore reference
  default (port 3000). `5173` is the static server origin and the
  CORS-allowed origin for the API.
- **`healthPath: /`** — the action polls `curl -sf {baseUrl}{healthPath}`, i.e.
  `http://localhost:5173/`, against the foregrounded process (the
  middleware-free Node static server, `scripts/serve-web.mjs`). `/` returns the
  built SPA shell (HTTP 200). The API's own `/health` is gated inside the start
  script, **not** via the action's poll (the static server does not serve
  `/health`).
- **`browsePaths`** — only the two public pages that render meaningfully without
  authentication:
  - `/` — the Browse page.
  - `/personas/p-001` — a persona detail page (`p-001`…`p-015` are seeded).

## Start ordering

[`scripts/start-smoke.sh`](../scripts/start-smoke.sh) enforces the ordering that
`lore.yml` alone cannot express, because the action polls the **frontend**
(`baseUrl + healthPath`), not the API:

1. Starts the compiled API (`pnpm --filter @acme/api start` → `node dist/index.js`)
   in the background. The build phase already produced `apps/api/dist/index.js`.
2. Polls `http://localhost:3001/health` until it returns HTTP 200
   (`{"status":"ok"}`), with a bounded retry loop (60 attempts × 2s = 2 minutes).
   If the API exits early or never becomes healthy, the script prints the API
   logs and exits non-zero so the action fails fast.
3. Once the API is healthy, launches a **middleware-free Node static server**
   ([`scripts/serve-web.mjs`](../scripts/serve-web.mjs)) in the background (and
   `wait`s on it), serving the built static output in `apps/web/dist/`. This
   keeps the process alive for the action's health poll and for browsing. A
   guard fails fast with a clear message if `apps/web/dist/index.html` is
   missing (i.e. the build phase did not run), instead of a silent 5-minute
   timeout.

   **Why not `vite preview`?** The smoke target used to be Vite's `preview`
   server, but it proved unreliable for the harness poll on this project's
   pinned Vite (6.4.x). Vite's preview server runs a **Host-header /
   DNS-rebinding host-check middleware** that could reject `http://localhost:5173/`
   even with `allowedHosts: true` configured, so `curl -sf http://localhost:5173/`
   never returned HTTP 200 and the start step timed out after 5 minutes — even
   though the identically-bound API poll succeeded. Rather than keep fighting
   Vite's preview host-check, the smoke path now serves `apps/web/dist/` with a
   tiny dependency-free Node static server (`node:http` + `node:fs` only, so
   `pnpm install --frozen-lockfile` stays valid). It performs **no** Host-header
   check, binds explicitly to IPv4 `0.0.0.0:5173` (matching the API's
   proven-reachable bind), and serves `index.html` as a SPA fallback so both
   `/` and client-side routes like `/personas/p-001` return HTTP 200.

   The `server`/`preview` blocks in `apps/web/vite.config.ts` are left in place
   for local development but are **no longer on the smoke critical path**.

A `trap cleanup EXIT` kills both the background API and the backgrounded static
server (tracked via `WEB_PID`) when the script terminates, avoiding orphaned
processes across runs. The web server is started in the background and `wait`ed
on (not `exec`'d), so the trap still fires on exit.

This ordering matters because the frontend hardcodes `API_BASE =
"http://localhost:3001"` (`apps/web/src/lib/api.ts`) and the API's CORS is locked
to `origin: "http://localhost:5173"`. If the frontend came up before the API,
browse steps would show fetch failures.

## Caveats — how this project differs from the Lore reference stack

### The static server binds an explicit IPv4 address (loopback reachability)

The Node static server ([`scripts/serve-web.mjs`](../scripts/serve-web.mjs))
binds `host: "0.0.0.0"` (an explicit IPv4 address) rather than an undefined /
IPv6 host. This matters because the action's health poll runs
`curl -sf http://localhost:5173/`, and in the sandbox `localhost` resolves to
the IPv4 loopback `127.0.0.1` (the API's `curl http://localhost:3001/health`
succeeds against its own `host: "0.0.0.0"` IPv4 bind).

Binding to Node's unspecified host resolves to the IPv6 address `::`; in a
sandbox where `localhost` is IPv4, the poll cannot reach an IPv6-only listener
and times out. Binding `0.0.0.0` binds IPv4 `INADDR_ANY` (including
`127.0.0.1`), so `http://localhost:5173/` is reachable, matching the API. Do
**not** change `serve-web.mjs`'s `HOST` away from `0.0.0.0`. (The `server` and
`preview` blocks in `apps/web/vite.config.ts` also bind `0.0.0.0` for local
development, but they are no longer on the smoke critical path.)

### No database or .NET setup required

This project uses an **in-memory `Map`-based store**
(`apps/api/src/db.ts`, seeded with 15 personas). There is **no Postgres, no .NET
Aspire, and no daemon to provision.** This diverges from the Lore reference
stack; do not expect (or attempt) database migrations or a .NET runtime.

### No auth bypass in the frontend

The **API** bypasses auth by default: `apps/api/src/middleware/auth.ts` only
enforces authentication when `ENFORCE_AUTH === "true"`, so the API will not
return `401` during a smoke test.

However, the **frontend** has **no dev-login/bypass.** The `cart`, `favorites`,
and `checkout` routes are gated on `user` from `useAuth()`
(`apps/web/src/lib/auth.tsx`), which only populates after `/auth/login` sets a
token and `/auth/me` succeeds. Without that flow, those routes render only a
"Sign in to…" stub.

Consequently, the smoke test browses **only public pages** (`/` Browse and
`/personas/$personaId` detail). If authenticated pages ever need screenshots, a
frontend dev-login/bypass must be introduced first — that is out of scope for
this wiring.

### No test or lint suite

Verification uses **`pnpm typecheck`** (`turbo typecheck`, `tsc --noEmit`) as the
strongest available signal. There are **no tests**, and `turbo lint` has no
backing `lint` scripts, so lint is **not used** and would fail if invoked.

### Seeded bugs may cause legitimate failures

This repository intentionally contains **seeded bugs** (for example, the
`search()` price-filter bug in `apps/api/src/db.ts`, and the `/auth/login`
response omitting `username`).

- **Behavioral** bugs (price filter, missing `username`) do **not** fail
  `pnpm typecheck` — they only manifest at runtime.
- **Compile-time** seeded bugs (type errors) **would legitimately fail** the
  build or verify phase until fixed.

A failing build/verify may therefore be **expected** during assessment and is not
necessarily a wiring defect.

## Troubleshooting

- **Frozen-lockfile error:** `--frozen-lockfile` fails if `pnpm-lock.yaml` is out
  of sync with `package.json`. If a sandbox reports this, drop the flag and use
  plain `pnpm install`.
- **Port conflicts:** The static server (`scripts/serve-web.mjs`) binds `5173`
  and exits non-zero on an `EADDRINUSE` error (surfaced via its `server.on
  ("error")` handler), so it fails fast if `5173` is occupied. The API has no
  equivalent guard; if `3001` is taken, the API start errors and the script's
  early-exit check surfaces it via the API logs.
- **Health-poll target:** The action polls the **frontend**, not the API. Keep
  `startCommand` pointed at `scripts/start-smoke.sh`; pointing it directly at
  the static server (`node scripts/serve-web.mjs`) would let the frontend come
  up before the API.
- **Missing build output:** The static server serves `apps/web/dist/`, so the
  build phase (`pnpm build`) must run before start. Both `serve-web.mjs` and the
  start script guard against a missing `apps/web/dist/index.html` and exit
  non-zero with a clear message rather than timing out.

## Agent lifecycle scripts

The repo also provides the conventional `agent-*-command.sh` lifecycle scripts at
the root, used when the validation harness resolves lifecycle by script name rather
than reading `lore.yml`. They delegate to the same commands:

| Script                            | Command                          |
| --------------------------------- | -------------------------------- |
| `agent-setup-command.sh`          | `pnpm install --frozen-lockfile` |
| `agent-build-command.sh`          | `pnpm build`                     |
| `agent-verification-command.sh`   | `pnpm typecheck`                 |
| `agent-start-command.sh`          | `bash scripts/start-smoke.sh`    |

## Manual verification

From the repository root:

```bash
pnpm install --frozen-lockfile   # setup
pnpm build                       # build: @acme/shared → @acme/api → @acme/web
pnpm typecheck                   # verify
bash scripts/start-smoke.sh      # start (API-gated, then static server in foreground)
```

Then, in another shell:

```bash
curl -sf http://localhost:3001/health   # -> {"status":"ok"}
curl -sf http://localhost:5173/          # -> HTTP 200 (SPA shell)
```

Open `http://localhost:5173/` and `http://localhost:5173/personas/p-001` and
confirm both render content without auth prompts.
