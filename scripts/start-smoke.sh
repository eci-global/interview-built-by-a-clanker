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

echo "[start-smoke] Starting web (static server) in the background..."
# Serve the already-built static frontend with a dependency-free Node static
# server (scripts/serve-web.mjs). The build phase (`pnpm build`) must have
# produced apps/web/dist/. Unlike Vite's preview server, this server performs no
# Host-header / DNS-rebinding checks, so http://localhost:5173/ reliably answers
# the harness health poll with HTTP 200 and serves the SPA (with index.html
# fallback for client-side routes like /personas/p-001).
if [ ! -f "apps/web/dist/index.html" ]; then
  echo "[start-smoke] ERROR: apps/web/dist/index.html is missing." >&2
  echo "[start-smoke] The build phase must run before start (pnpm build produces apps/web/dist/)." >&2
  exit 1
fi

# Run backgrounded with WEB_PID so the `trap cleanup EXIT` handler tears it down
# (the harness kills this script's PID; `wait` keeps it in the foreground while
# still allowing the trap to fire).
node scripts/serve-web.mjs &
WEB_PID=$!
wait "$WEB_PID"
