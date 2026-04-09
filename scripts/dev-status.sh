#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
RUN_DIR="${RUN_DIR:-.run}"
SERVER_PID_FILE="$RUN_DIR/server.pid"
NGROK_PID_FILE="$RUN_DIR/ngrok.pid"

print_status() {
  local label="$1"
  local pid_file="$2"
  local fallback_pid="${3:-}"

  if [ -f "$pid_file" ]; then
    local pid
    pid="$(cat "$pid_file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      echo "$label: running (PID $pid)"
      return
    fi
  fi

  if [ -n "$fallback_pid" ] && kill -0 "$fallback_pid" >/dev/null 2>&1; then
    echo "$label: running (PID $fallback_pid, discovered)"
    return
  fi

  echo "$label: not running"
}

SERVER_FALLBACK_PID="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
NGROK_FALLBACK_PID="$(pgrep -f "ngrok http $PORT" | head -n 1 || true)"

print_status "server" "$SERVER_PID_FILE" "$SERVER_FALLBACK_PID"
print_status "ngrok" "$NGROK_PID_FILE" "$NGROK_FALLBACK_PID"

if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
  echo "healthz: ok"
else
  echo "healthz: unavailable"
fi

URL="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); tunnels=[t.get("public_url","") for t in data.get("tunnels",[]) if t.get("proto")=="https"]; print(tunnels[0] if tunnels else "")' || true)"
if [ -n "$URL" ]; then
  echo "ngrok_url: $URL"
else
  echo "ngrok_url: unavailable"
fi
