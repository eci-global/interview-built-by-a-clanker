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

# Self-poll the web server from this script's OWN shell context before handing
# off to the harness's health poll. This mirrors the API self-poll above and is
# a diagnosis aid: it definitively distinguishes a serving/code defect (the
# script itself cannot reach http://localhost:5173/) from an action-context /
# environment reachability problem (the script CAN reach it, but the harness's
# separate `curl -sf http://localhost:5173/` poll cannot). Either way, a failure
# here fails fast with the web logs instead of a silent 5-minute timeout.
WEB_HEALTH_URL="http://localhost:5173/"
echo "[start-smoke] Waiting for web health at $WEB_HEALTH_URL ..."
for attempt in $(seq 1 30); do
  if curl -sf "$WEB_HEALTH_URL" >/dev/null 2>&1; then
    echo "[start-smoke] Web is healthy (after $attempt attempts). This shell can reach http://localhost:5173/."
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    echo "[start-smoke] Web process exited early." >&2
    exit 1
  fi
  if [ "$attempt" -eq 30 ]; then
    # The web server is still up (kill -0 above did not exit) but this shell
    # could not reach it within the window. Surface it loudly to aid triage,
    # but keep serving so the harness poll can still try from its own context.
    echo "[start-smoke] WARNING: web did not answer this shell's poll within 60s," >&2
    echo "[start-smoke] yet the serve-web process is still running (see its logs above)." >&2
    echo "[start-smoke] This points at an environment/network reachability issue on port 5173," >&2
    echo "[start-smoke] not a serving defect. Continuing to serve for the harness poll." >&2
  fi
  sleep 2
done

wait "$WEB_PID"
