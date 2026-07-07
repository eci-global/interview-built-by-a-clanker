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
