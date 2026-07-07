# Blueprint: Wire the Storefront Monorepo for Lore's `project-smoke-test` Action

## Overview

This blueprint wires the "Agentic Personas Storefront" monorepo so Lore's `project-smoke-test` action can install, build, verify, launch, and browse it inside a sandbox. The action consumes an `AppLifecycleParams` contract (defined in `.lore-agent/lib/app-lifecycle.ts`): `setupCommand`, `buildCommand`, `verifyCommand`, `startCommand`, `baseUrl`, `healthPath`, and `workingDir`, plus a set of paths to browse/screenshot.

The core work is to (1) introduce a repository-root configuration manifest that declares these parameters with values matched to this project (pnpm, Turbo build, typecheck as the verify signal, port `5173` frontend, port `3001` API), (2) add a robust start script that brings up the API, waits for its `/health` endpoint, then serves the Vite frontend and keeps it foregrounded, and (3) add clear documentation flagging this project's differences from the Lore reference stack (no database/.NET, no auth bypass in the frontend, no test/lint suites).

Key decisions made up front and detailed below:
- Configuration is stored in a new `lore.yml` at the repo root (there is no existing manifest).
- The verify signal is `pnpm typecheck` (strongest available; there is no test suite and no real lint scripts).
- The start command runs a dedicated shell script (`scripts/start-smoke.sh`) that gates the frontend on the API's health.
- `healthPath` is set to `/` so the action's `baseUrl + healthPath` poll targets the Vite frontend (which is the process kept in the foreground), while the start script independently gates on the API's `/health` before launching Vite.
- Screenshot targets are the two public pages: `/` and `/personas/p-001`.

## Detailed plan

### 1. Add the Lore action manifest (`lore.yml`)

Create a new file `lore.yml` at the repository root. This is the configuration surface the `project-smoke-test` action reads for its `AppLifecycleParams`. There is currently no such manifest (confirmed by the repository analysis), and `.gitignore` does not exclude root-level YAML, so it will be tracked normally.

The manifest must declare a `project-smoke-test` block that maps directly onto the `AppLifecycleParams` fields consumed by `.lore-agent/lib/app-lifecycle.ts`. Populate it as follows:

```yaml
# Lore action configuration for the Agentic Personas Storefront.
# This project is a pnpm + Turborepo TypeScript monorepo with an in-memory
# data store. It has NO database daemon, NO .NET/Aspire, and NO auth bypass in
# the frontend. See docs/SMOKE_TEST.md for the full set of caveats.

project-smoke-test:
  workingDir: .
  setupCommand: pnpm install --frozen-lockfile
  buildCommand: pnpm build
  verifyCommand: pnpm typecheck
  startCommand: bash scripts/start-smoke.sh
  baseUrl: http://localhost:5173
  healthPath: /
  browsePaths:
    - /
    - /personas/p-001
```

Rationale for each field:

- **`workingDir: .`** — All root scripts (`turbo` delegation) run from the monorepo root.
- **`setupCommand: pnpm install --frozen-lockfile`** — pnpm installs devDependencies by default, so this satisfies the "install dev dependencies without manual intervention" criterion. `--frozen-lockfile` ensures reproducible installs in CI/sandbox; the repo pins `packageManager` and ships a `pnpm-lock.yaml`, so this is safe. If the sandbox lacks a lockfile for any reason, the fallback documented below applies.
- **`buildCommand: pnpm build`** — Delegates to `turbo build`, which respects the `dependsOn: ["^build"]` graph and builds `@acme/shared` → `@acme/api` → `@acme/web` in dependency order. This is essential because `@acme/shared` compiles to `dist/` and is consumed via `workspace:*`; a per-package raw `tsc` would fail to resolve `@acme/shared`.
- **`verifyCommand: pnpm typecheck`** — Delegates to `turbo typecheck` (`tsc --noEmit` per package), which also honors `^build` so the shared package's `dist/` exists first. This is the strongest available signal; there is no test suite and `turbo lint` has no underlying `lint` scripts (would no-op or error), so lint is explicitly not used.
- **`startCommand: bash scripts/start-smoke.sh`** — Delegates to a script (added below) that enforces API-before-frontend ordering. This is a bare command that `resolveCommand`/`tryResolveCommand` in `file-resolution.ts` will pass through untouched.
- **`baseUrl: http://localhost:5173`** — Overrides the Lore reference default (port 3000). This is the Vite dev server origin and the CORS-allowed origin for the API.
- **`healthPath: /`** — The action polls `curl -sf {baseUrl}{healthPath}` against the foregrounded process. Since the foregrounded process is Vite, the health poll must target a path Vite serves. `/` returns the SPA shell (HTTP 200), satisfying `curl -sf`. The API's own `/health` gating happens inside the start script (see below), not via the action's poll.
- **`browsePaths`** — Only the two public pages that render meaningfully without authentication.

If the exact key names the `project-smoke-test` action expects differ from the above (e.g. the action reads a nested `params` object), preserve the same field values under whatever structure the action library documents; the `AppLifecycleParams` fields are the source of truth. Given the analysis found no schema in-repo, the flat structure above under a `project-smoke-test` key is the chosen convention.

### 2. Add the start script (`scripts/start-smoke.sh`)

Create a new directory `scripts/` and a file `scripts/start-smoke.sh`. This script encapsulates the start-phase ordering that `app-lifecycle.ts` cannot express on its own, because the action polls `baseUrl + healthPath` (the frontend), not the API. The API (port 3001) must be healthy before the frontend is useful, since the frontend hardcodes `API_BASE = "http://localhost:3001"` (`apps/web/src/lib/api.ts`) and CORS is locked to `origin: "http://localhost:5173"`.

The script must:

1. Start the compiled API in the background (`pnpm build` has already run in the build phase, producing `apps/api/dist/index.js`). Use `pnpm --filter @acme/api start`, which runs `node dist/index.js` per the API package's `start` script. Do not use `dev`/`tsx watch` for the smoke start — the production `start` is deterministic and does not require `tsx`.
2. Poll `http://localhost:3001/health` until it returns `{ status: "ok" }` (HTTP 200), with a bounded retry loop (60 attempts × 2s = 2 minutes). Exit non-zero if the API never becomes healthy, so the action fails fast with a clear message.
3. Once the API is healthy, launch the Vite dev server in the **foreground** via `pnpm --filter @acme/web dev`. This keeps the process alive so the action's own health poll against `http://localhost:5173/` succeeds and the frontend stays up for browsing. Bind Vite to `0.0.0.0` so the sandbox can reach it (pass `--host 0.0.0.0` through Vite, or set it in `vite.config.ts` — see step 3).

Concrete implementation:

```bash
#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="http://localhost:3001/health"
API_LOG="$(mktemp)"

echo "[start-smoke] Starting API (@acme/api) in background..."
# Start the compiled API. `pnpm build` (build phase) produced apps/api/dist/index.js.
nohup pnpm --filter @acme/api start >"$API_LOG" 2>&1 &
API_PID=$!

cleanup() {
  echo "[start-smoke] Cleaning up API (pid $API_PID)..."
  kill "$API_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "[start-smoke] Waiting for API health at $API_HEALTH_URL ..."
for attempt in $(seq 1 60); do
  if curl -sf "$API_HEALTH_URL" >/dev/null 2>&1; then
    echo "[start-smoke] API is healthy (after $attempt attempts)."
    break
  fi
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "[start-smoke] API process exited early. Logs:" >&2
    cat "$API_LOG" >&2
    exit 1
  fi
  if [ "$attempt" -eq 60 ]; then
    echo "[start-smoke] API did not become healthy within 2 minutes. Logs:" >&2
    cat "$API_LOG" >&2
    exit 1
  fi
  sleep 2
done

echo "[start-smoke] Starting web (@acme/web) in the foreground..."
# Run Vite in the foreground so the action's health poll (baseUrl + healthPath)
# hits a live server and the frontend stays up for browsing.
exec pnpm --filter @acme/web dev -- --host 0.0.0.0
```

Notes on the script:
- `set -euo pipefail` ensures the script fails loudly on any error.
- The `trap cleanup EXIT` kills the background API when the foregrounded Vite process terminates, avoiding orphaned processes across runs.
- The early-exit check (`kill -0`) surfaces API startup failures (including seeded-bug-induced crashes) immediately with logs, rather than waiting the full timeout.
- `exec` replaces the shell with Vite so signals propagate cleanly and the persistent process is the one the action supervises.
- The `-- --host 0.0.0.0` passes the host flag through pnpm to Vite. If step 3 sets `host` in `vite.config.ts` instead, this flag is redundant but harmless.

Make the script executable (`chmod +x scripts/start-smoke.sh`). Even so, invoking it via `bash scripts/start-smoke.sh` in the manifest does not depend on the executable bit.

### 3. Ensure Vite binds to all interfaces (`apps/web/vite.config.ts`)

The Vite dev server defaults to `localhost` only, which can prevent the sandbox host (and any external health poller) from reaching port 5173. Update `apps/web/vite.config.ts` to explicitly set the server host and preserve the existing port `5173`. Add (or extend) the `server` block:

```ts
server: {
  host: true,        // bind 0.0.0.0 so the sandbox/action can reach the dev server
  port: 5173,
  strictPort: true,  // fail fast if 5173 is taken rather than silently using another port
},
```

`strictPort: true` guarantees the port matches the manifest's `baseUrl`; if the port drifted, the action's health poll and browse steps would target the wrong origin. If a `server` block already exists with `port: 5173`, merge these keys in rather than duplicating.

### 4. Verify the API `start` script exists and starts cleanly (`apps/api/package.json`)

Confirm `apps/api/package.json` has a `start` script running the compiled entry point. Per the analysis it does (`node dist/index.js`), and the API listens on `port: 3001, host: 0.0.0.0` with `GET /health` → `{ status: "ok" }`. No change is required if the script is present. If it is missing, add:

```json
"start": "node dist/index.js"
```

Do not change the API port or host; `3001` / `0.0.0.0` are correct and referenced by the frontend and the start script.

### 5. Document the smoke-test wiring and caveats (`docs/SMOKE_TEST.md`)

Create `docs/SMOKE_TEST.md` capturing the full picture so future runs are informed. It must clearly flag the three caveats the specification calls out, plus how the wiring works. Include the following sections:

- **What the action does here** — Summarize the phase-to-command mapping (setup/build/verify/start), the `baseUrl` override to `http://localhost:5173`, `healthPath: /`, and the two browse paths (`/`, `/personas/p-001`).
- **No database or .NET setup required** — State explicitly that this project uses an in-memory `Map`-based store (`apps/api/src/db.ts`, seeded with 15 personas). There is no Postgres, no .NET Aspire, and no daemon to provision. This diverges from the Lore reference stack.
- **No auth bypass in the frontend** — Explain that the API bypasses auth by default (`apps/api/src/middleware/auth.ts` only enforces when `ENFORCE_AUTH === "true"`), so the API will not 401. However the **frontend** has no dev-login/bypass: `cart`, `favorites`, and `checkout` are gated on `user` from `useAuth()` (`apps/web/src/lib/auth.tsx`), which only populates after `/auth/login` sets a token and `/auth/me` succeeds. Consequently those routes render only a "Sign in to…" stub. The smoke test therefore browses **only public pages** (`/` Browse and `/personas/$personaId` detail). If authenticated pages ever need screenshots, a frontend dev-login/bypass must be introduced first.
- **No test or lint suite** — State that verification uses `pnpm typecheck` (`turbo typecheck`, `tsc --noEmit`) as the strongest available signal. There are no tests, and `turbo lint` has no backing `lint` scripts, so lint is not used and would fail if invoked.
- **Seeded bugs may cause failures** — Note that this repo intentionally contains seeded bugs (e.g. the `search()` price-filter bug in `apps/api/src/db.ts`, and the `auth/login` response omitting `username`). Behavioral bugs will not fail typecheck; compile-time seeded bugs would legitimately fail the build/verify phases until fixed. A failing build/verify may be expected during assessment.
- **Start ordering** — Explain that `scripts/start-smoke.sh` launches the API first, waits for `http://localhost:3001/health`, then serves the Vite frontend in the foreground, because the frontend hardcodes the API base URL and CORS is locked to the frontend origin.

## Decisions

1. **Where does the action read its parameters?** — The analysis found no existing manifest. **Decision:** introduce `lore.yml` at the repo root with a `project-smoke-test` block mapping to `AppLifecycleParams`. Rationale: it is the conventional, discoverable location; root YAML is tracked (not gitignored); and it keeps all action config in one declarative place. Field values are the authoritative contract regardless of any minor key-naming differences the action library imposes.

2. **What is the verify signal?** — **Decision:** `pnpm typecheck`. Rationale: no test suite exists, and `turbo lint` has no underlying scripts, so lint would no-op/error. Typecheck (`tsc --noEmit` via Turbo, honoring `^build`) is the strongest signal available and satisfies the acceptance criterion for verification.

3. **Should `healthPath` point at the API `/health` or the frontend?** — The action polls `baseUrl + healthPath`, and `baseUrl` must be the frontend (`5173`) for browsing. Pointing `healthPath` at `/health` would resolve to `http://localhost:5173/health`, which Vite does not serve. **Decision:** set `healthPath: /` (served by Vite, returns 200), and enforce API health independently inside `scripts/start-smoke.sh` by polling `http://localhost:3001/health` before launching Vite. This satisfies "launch the API and confirm it is healthy before serving the frontend" without a reverse proxy.

4. **Production `start` vs. `dev` for the API in the start phase?** — **Decision:** use the compiled `pnpm --filter @acme/api start` (`node dist/index.js`), since `pnpm build` already ran in the build phase and this avoids depending on `tsx` at runtime and is deterministic. The web side uses `dev` (Vite) because Vite's dev server is the persistent, browsable target and building a static frontend + serving it would add complexity without benefit for a smoke test.

5. **`pnpm install` vs. `pnpm install --frozen-lockfile`?** — **Decision:** `--frozen-lockfile` for reproducibility, given the repo ships `pnpm-lock.yaml` and pins `packageManager`. If a sandbox environment lacks the lockfile, the documented fallback is plain `pnpm install`; the manifest can be edited to drop the flag, but the default is frozen for determinism.

6. **Which pages to browse/screenshot?** — **Decision:** `/` and `/personas/p-001`. Rationale: these are the only routes that render meaningful content without authentication. `/login` and `/register` render forms but add little signal; `cart`/`favorites`/`checkout` render only sign-in stubs. `p-001` is a guaranteed-seeded persona id (p-001…p-015).

7. **Should Vite bind to all interfaces?** — **Decision:** yes, via `server.host: true` and `strictPort: true` in `vite.config.ts` (and a redundant `--host 0.0.0.0` pass-through in the start script). Rationale: guarantees the sandbox/action can reach `5173` and that the port never drifts from the manifest's `baseUrl`.

## Verification

Run these from the repository root to confirm the wiring end to end:

1. **Setup:** `pnpm install --frozen-lockfile` — completes without manual intervention and installs devDependencies.
2. **Build:** `pnpm build` — Turbo builds `@acme/shared` → `@acme/api` → `@acme/web`; confirm `apps/api/dist/index.js` and `packages/shared/dist/` exist afterward.
3. **Verify:** `pnpm typecheck` — passes when the code is healthy (may legitimately fail if a compile-time seeded bug is present).
4. **Start:** `bash scripts/start-smoke.sh` — observe the log lines showing the API starting, `[start-smoke] API is healthy`, then Vite serving. In another shell:
   - `curl -sf http://localhost:3001/health` returns `{"status":"ok"}`.
   - `curl -sf http://localhost:5173/` returns HTTP 200 (SPA shell).
   - Open `http://localhost:5173/` and `http://localhost:5173/personas/p-001` in a browser and confirm both render content without auth prompts.
   - Terminate the script (Ctrl-C) and confirm the background API process is reaped (no lingering `node dist/index.js`).
5. **Manifest sanity:** confirm `lore.yml` parses as valid YAML and its `baseUrl` is `http://localhost:5173` (not the default port 3000).

## Risks & notes

- **Health-poll target mismatch:** The action polls the frontend (`baseUrl + healthPath`), not the API. The whole design depends on `scripts/start-smoke.sh` gating on the API's `/health` before launching Vite. If the script is bypassed (e.g. someone points `startCommand` directly at `pnpm --filter @acme/web dev`), the frontend could come up before the API and browse steps would show fetch failures. Keep `startCommand` pointed at the script.
- **Seeded compile-time bugs:** If a seeded bug is a type error, `pnpm build`/`pnpm typecheck` will fail — this is expected per the spec and not a wiring defect. The behavioral bugs (price-filter, missing `username`) do not fail typecheck.
- **Port conflicts:** `strictPort: true` makes Vite fail if `5173` is occupied; the API has no equivalent guard. If `3001` is taken, the API start will error and the script's early-exit check will surface it via logs.
- **Lockfile drift:** `--frozen-lockfile` fails if `pnpm-lock.yaml` is out of sync with `package.json`. If the sandbox reports a frozen-lockfile error, drop the flag to plain `pnpm install` (documented in `docs/SMOKE_TEST.md`).
- **Manifest key names:** If the deployed `project-smoke-test` action expects a schema shape different from the flat `project-smoke-test:` block, adjust the structure but keep the field values identical; the `AppLifecycleParams` fields in `.lore-agent/lib/app-lifecycle.ts` are the contract.
- **Process cleanup across runs:** The `trap cleanup EXIT` handles the common case, but a hard-killed shell may leave the background API alive. The early-exit health check and `strictPort` on Vite help detect stale processes on subsequent runs.
- **Do not attempt to browse authenticated routes** (`cart`, `favorites`, `checkout`) — they will only show sign-in stubs. Expanding to those pages requires introducing a frontend dev-login/bypass, which is explicitly out of scope for this wiring.

## Task List

- [ ] **1. Add Lore action manifest** — Create a lore.yml at the repository root declaring the project-smoke-test parameters (setup, build, verify, start commands, baseUrl, healthPath, and browse paths) matched to this monorepo's pnpm/Turbo tooling and ports.
- [ ] **2. Add API-gated smoke start script** — Create scripts/start-smoke.sh that launches the compiled API in the background, polls its /health endpoint until healthy with a bounded retry loop, then serves the Vite frontend in the foreground, cleaning up the API on exit.
- [ ] **3. Bind Vite dev server to all interfaces** — Update the Vite config so the dev server binds to 0.0.0.0 on a fixed port 5173 with strictPort, ensuring the sandbox and action can reach the frontend and the port matches the manifest baseUrl.
- [ ] **4. Confirm API production start script** — Verify (and add if missing) the API package's start script that runs the compiled entry point on port 3001 with a working /health endpoint, without changing the port or host.
- [ ] **5. Document smoke-test wiring and caveats** — Create docs/SMOKE_TEST.md describing the phase-to-command mapping, the frontend baseUrl override, start ordering, and clearly flagging the absence of a database/.NET setup, no frontend auth bypass, no test/lint suite, and that seeded bugs may cause legitimate failures.
- [ ] **6. Verify end-to-end smoke-test flow** — Run the full setup, build, verify, and start sequence to confirm dependencies install, the monorepo builds and typechecks, the API becomes healthy before the frontend, and the public pages render without authentication.