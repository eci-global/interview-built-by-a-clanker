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
| start   | `bash scripts/start-smoke.sh`       | API-first ordering (see below).                                   |

Additional parameters:

- **`workingDir: .`** — all root scripts run from the monorepo root.
- **`baseUrl: http://localhost:5173`** — this **overrides** the Lore reference
  default (port 3000). `5173` is the Vite dev server origin and the CORS-allowed
  origin for the API.
- **`healthPath: /`** — the action polls `curl -sf {baseUrl}{healthPath}`, i.e.
  `http://localhost:5173/`, against the foregrounded process (Vite). `/` returns
  the SPA shell (HTTP 200). The API's own `/health` is gated inside the start
  script, **not** via the action's poll (Vite does not serve `/health`).
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
3. Once the API is healthy, launches the Vite dev server in the **foreground**
   (`pnpm --filter @acme/web dev -- --host 0.0.0.0`). This keeps the process
   alive for the action's health poll and for browsing.

A `trap cleanup EXIT` kills the background API when the foregrounded Vite process
terminates, avoiding orphaned processes across runs.

This ordering matters because the frontend hardcodes `API_BASE =
"http://localhost:3001"` (`apps/web/src/lib/api.ts`) and the API's CORS is locked
to `origin: "http://localhost:5173"`. If the frontend came up before the API,
browse steps would show fetch failures.

## Caveats — how this project differs from the Lore reference stack

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
- **Port conflicts:** Vite uses `strictPort: true` (`apps/web/vite.config.ts`),
  so it fails fast if `5173` is occupied. The API has no equivalent guard; if
  `3001` is taken, the API start errors and the script's early-exit check surfaces
  it via the API logs.
- **Health-poll target:** The action polls the **frontend**, not the API. Keep
  `startCommand` pointed at `scripts/start-smoke.sh`; pointing it directly at
  `pnpm --filter @acme/web dev` would let the frontend come up before the API.
- **Vite host-check (403 "Blocked request"):** The dev server binds to
  `0.0.0.0` (`host: true` plus `--host 0.0.0.0`). Vite 6's hardened host-check
  validates the incoming `Host` header against `server.allowedHosts` and returns
  **HTTP 403 "Blocked request"** for hosts it doesn't recognize. Because the
  health poll runs `curl -sf http://localhost:5173/`, a 403 makes `curl -f` fail
  and the poll times out even though Vite is "ready" and listening. To avoid
  this, `apps/web/vite.config.ts` sets `server.allowedHosts: true`, disabling the
  host-check so any `Host` header (`localhost` plus sandbox network
  hostnames/IPs) is accepted and the poll returns **HTTP 200** instead of 403.
  This is safe here because the smoke-test/dev context is a trusted, ephemeral
  sandbox rather than a public-facing server.

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
bash scripts/start-smoke.sh      # start (API-gated, then Vite in foreground)
```

Then, in another shell:

```bash
curl -sf http://localhost:3001/health   # -> {"status":"ok"}
curl -sf http://localhost:5173/          # -> HTTP 200 (SPA shell)
```

Open `http://localhost:5173/` and `http://localhost:5173/personas/p-001` and
confirm both render content without auth prompts.
