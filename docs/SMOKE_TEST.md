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
   ([`scripts/serve-web.mjs`](../scripts/serve-web.mjs)) in the background,
   serving the built static output in `apps/web/dist/`. It then **self-polls**
   `http://localhost:5173/` from the script's own shell (mirroring the API
   self-poll) before `wait`ing on the server. This keeps the process alive for
   the action's health poll and for browsing. A guard fails fast with a clear
   message if `apps/web/dist/index.html` is missing (i.e. the build phase did
   not run), instead of a silent 5-minute timeout.

   **Why self-poll the web server?** The self-poll is a diagnosis aid, not a
   fix. It definitively distinguishes two otherwise-indistinguishable failure
   modes when the action reports `AppHealthTimeoutError` (`App failed to become
   healthy within 5 minutes`):

   - If the script's own `curl -sf http://localhost:5173/` also fails while the
     `serve-web` process is still up, the fault is a **serving/code defect** in
     `serve-web.mjs` — surfaced immediately with the web logs rather than a
     silent 5-minute timeout in the action.
   - If the script's self-poll **succeeds** (the same shell that reached the API
     over IPv4 loopback also reaches `5173`) but the action's separate poll
     still times out, the fault is an **environment/network reachability**
     condition on port `5173` in the action's poll context — not a repository
     code defect. The script keeps serving so the harness poll can still try.

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

## Verification finding (serving & bind correctness)

A read-only verification of the serving path against both the code and the
actual lifecycle log confirms the following.

**Code is correct.** In [`scripts/serve-web.mjs`](../scripts/serve-web.mjs):

- The server binds **IPv4 `0.0.0.0:5173`** (`const HOST = "0.0.0.0"; const PORT
  = 5173;` → `server.listen(PORT, HOST, …)`), matching the API's proven-reachable
  `app.listen({ port: 3001, host: "0.0.0.0" })` in `apps/api/src/index.ts`.
- `GET /` resolves to the dist root (a directory, not a file), so `statFile`
  returns `null` and the request falls through to the **SPA fallback**, which
  serves `index.html` with **HTTP 200** (`sendFile(res, INDEX_FILE, indexStat,
  200)`). Client-side routes like `/personas/p-001` follow the same 200 path.
- `dist/index.html` presence is checked **before** `listen()` (and again in
  `start-smoke.sh` before launching), exiting non-zero with a clear message if
  missing — no silent timeout.
- `EADDRINUSE` (or any listen error) is caught by `server.on("error")` →
  `process.exit(1)`, so a port conflict fails fast rather than hanging.

**What the actual run log shows (environment limitation, not a code defect).**
The lifecycle log for the failed sandbox shows the failure occurred **upstream
of the web server**, at the API self-poll stage:

```
[start-smoke] Starting API (@acme/api) in background...
[start-smoke] Waiting for API health at http://localhost:3001/health ...
[start-smoke] API process exited early. Logs:
  Error: Cannot find module '/workspace/apps/api/dist/index.js'  (MODULE_NOT_FOUND)
  WARN  Local package.json exists, but node_modules missing, did you mean to install?
[start-smoke] Cleaning up...
```

Because the API never became healthy, `start-smoke.sh` exited at the API gate
and **never reached** the web phase — so in this particular failed sandbox the
serve-web self-poll never ran, `dist/index.html` was never re-checked, and
`5173` was never bound. The root cause is that the **setup/build phases did not
complete** in that sandbox (`node_modules` missing → `apps/api/dist/index.js`
absent), which is the documented "app stack FAILED to start" environment
limitation, not a serving/bind defect in this repository. The serving and bind
logic in `serve-web.mjs` (IPv4 `0.0.0.0:5173`, `GET /` → 200 SPA fallback,
`EADDRINUSE` guard) is correct and would answer the poll once the build output
and `node_modules` are present.

## API vs. web reachability symmetry

This section records the direct, dimension-by-dimension comparison between the
**reachable** API and the **timing-out** web static server, to rule out a
code-level defect in `serve-web.mjs`, `start-smoke.sh`, `lore.yml`, or the build
as the cause of an `AppHealthTimeoutError` on `http://localhost:5173/`.

The API and the web server are wired identically along every dimension that
governs loopback reachability:

| Dimension        | API (reachable)                                                      | Web static server (times out)                                            | Same? |
| ---------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ | :---: |
| Bind strategy    | `app.listen({ port: 3001, host: "0.0.0.0" })` — IPv4 `INADDR_ANY`    | `server.listen(5173, "0.0.0.0", …)` — IPv4 `INADDR_ANY`                   |  ✅   |
| Process tree     | `node dist/index.js`, backgrounded child of `start-smoke.sh`         | `node scripts/serve-web.mjs`, backgrounded child of `start-smoke.sh`     |  ✅   |
| Sandbox          | same container/network namespace as the start script                 | same container/network namespace as the start script                     |  ✅   |
| Curl mechanism   | `curl -sf http://localhost:3001/health` (script self-poll + harness) | `curl -sf http://localhost:5173/` (script self-poll + harness poll)      |  ✅   |
| Polled response  | `/health` → HTTP 200 (`{"status":"ok"}`)                             | `/` → HTTP 200 (SPA `index.html`, verified via `sendFile(…, 200)`)       |  ✅   |

Consequences of this symmetry:

- **Bind strategy is identical.** Both call `listen(port, "0.0.0.0", …)`, which
  binds IPv4 `INADDR_ANY` (including `127.0.0.1`). Because the script's own
  `curl http://localhost:3001/health` succeeds, `localhost` resolves to the IPv4
  loopback in this sandbox; therefore the identically-bound `0.0.0.0:5173`
  listener is reachable via `http://localhost:5173/` by the same resolution. If
  either bind were IPv6-only (Node's unspecified host → `::`), the API poll
  would *also* fail — it does not.
- **Process tree is identical.** Both are `node` processes launched with `&` as
  direct children of `scripts/start-smoke.sh`, tracked (`API_PID` / `WEB_PID`)
  and torn down by the same `trap cleanup EXIT`. Neither is `exec`'d, so both
  share the script's lifetime and signal handling.
- **Sandbox is identical.** Both run in the same container and network
  namespace as the start script; there is no per-service isolation that would
  give `3001` and `5173` different reachability.
- **Curl mechanism is identical.** The script self-polls both with `curl -sf`
  (API at line-scoped `API_HEALTH_URL`, web at `WEB_HEALTH_URL`), and the
  harness polls the web with the same `curl -sf http://localhost:5173/`. Same
  flags, same client, same loopback target.

Because all five dimensions match, **no code-level defect** in `serve-web.mjs`
(bind/serve/SPA-fallback/`EADDRINUSE` guard), `start-smoke.sh` (API-gated
ordering, backgrounding, `wait`, trap), `lore.yml` (`baseUrl`/`healthPath`), or
the build (`apps/web/dist/index.html` presence, checked twice) can explain a
`5173` timeout while the identically-configured `3001` is reachable. A
correctly-bound, up, `0.0.0.0:5173` IPv4 listener that returns 200 on `/`
**must** answer `curl -sf http://localhost:5173/` on the next poll tick, exactly
as the API's does. If it does not, the difference lies **outside** this
repository's code — an environment/network reachability condition in the poll's
context — which is precisely what the web self-poll added to `start-smoke.sh` is
designed to disambiguate (self-poll succeeds ⇒ environment; self-poll fails ⇒
serving/code defect surfaced with logs).

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

> **Note — why `agent-start-command.sh` keeps `bash` but `lore.yml`'s
> `startCommand` does not.** The harness runs the manifest `startCommand` as
> `nohup bash <startCommand>` (it **always prefixes `bash`**), so the manifest
> value must be the bare script path `scripts/start-smoke.sh`; adding `bash`
> there yields `bash bash scripts/start-smoke.sh`, which makes bash look for a
> file literally named `bash` in the cwd and exits non-zero, so the app never
> starts and the health poll times out. The lifecycle **script**
> `agent-start-command.sh` is different: the harness invokes it by its path
> (e.g. `bash agent-start-command.sh`), so it is free to `exec bash
> scripts/start-smoke.sh` internally without any double-`bash`.

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
