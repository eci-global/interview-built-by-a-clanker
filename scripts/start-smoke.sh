#!/usr/bin/env bash
set -euo pipefail

API_HEALTH_URL="http://localhost:3001/health"
API_LOG="$(mktemp)"

echo "[start-smoke] Starting API (@acme/api) in background..."
# Start the compiled API. `pnpm build` (build phase) produced apps/api/dist/index.js.
nohup pnpm --filter @acme/api start >"$API_LOG" 2>&1 &
API_PID=$!

WEB_PID=""

cleanup() {
  echo "[start-smoke] Cleaning up..."
  if [ -n "$WEB_PID" ]; then
    echo "[start-smoke] Killing web (pid $WEB_PID)..."
    kill "$WEB_PID" 2>/dev/null || true
  fi
  echo "[start-smoke] Killing API (pid $API_PID)..."
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

echo "[start-smoke] Starting web (@acme/web) preview in the foreground..."
# Serve the already-built static frontend with `vite preview`. The build phase
# (`pnpm build`) must have produced apps/web/dist/. Preview is a plain static
# server that reliably answers the health poll with HTTP 200 and serves the SPA.
if [ ! -f "apps/web/dist/index.html" ]; then
  echo "[start-smoke] ERROR: apps/web/dist/index.html is missing." >&2
  echo "[start-smoke] The build phase must run before start (pnpm build produces apps/web/dist/)." >&2
  exit 1
fi

# Invoke vite directly via `pnpm exec` instead of `pnpm run preview -- <flags>`.
# The `pnpm run <script> -- <flags>` form forwards a literal `--` into the
# script, so vite's CLI (cac) treats everything after it as unparsed overflow
# args and silently drops --host/--port/--strictPort. Running vite directly
# lets the flags actually apply (binding IPv4 0.0.0.0 so localhost is reachable).
pnpm --filter @acme/web exec vite preview --host 0.0.0.0 --port 5173 --strictPort &
WEB_PID=$!
wait "$WEB_PID"
