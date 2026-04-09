#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
RUN_DIR="${RUN_DIR:-.run}"
SERVER_PID_FILE="$RUN_DIR/server.pid"
NGROK_PID_FILE="$RUN_DIR/ngrok.pid"
SERVER_LOG="$RUN_DIR/server.log"
NGROK_LOG="$RUN_DIR/ngrok.log"

mkdir -p "$RUN_DIR"

is_pid_running() {
  local pid="$1"
  kill -0 "$pid" >/dev/null 2>&1
}

find_server_pid() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

find_ngrok_pid() {
  pgrep -f "ngrok http $PORT" | head -n 1
}

start_server() {
  if [ -f "$SERVER_PID_FILE" ]; then
    local existing_pid
    existing_pid="$(cat "$SERVER_PID_FILE")"
    if is_pid_running "$existing_pid"; then
      echo "Local server already running with PID $existing_pid"
      return
    fi
    rm -f "$SERVER_PID_FILE"
  fi

  local existing_pid
  existing_pid="$(find_server_pid || true)"
  if [ -n "$existing_pid" ] && curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
    echo "$existing_pid" > "$SERVER_PID_FILE"
    echo "Local server already running with PID $existing_pid"
    return
  fi

  echo "Starting local server on http://$HOST:$PORT ..."
  HOST="$HOST" PORT="$PORT" nohup npm start >"$SERVER_LOG" 2>&1 &
  echo $! > "$SERVER_PID_FILE"
}

wait_for_server() {
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Server did not become healthy. Check $SERVER_LOG"
  exit 1
}

start_ngrok() {
  if [ -f "$NGROK_PID_FILE" ]; then
    local existing_pid
    existing_pid="$(cat "$NGROK_PID_FILE")"
    if is_pid_running "$existing_pid"; then
      echo "ngrok already running with PID $existing_pid"
      return
    fi
    rm -f "$NGROK_PID_FILE"
  fi

  local existing_pid
  existing_pid="$(find_ngrok_pid || true)"
  if [ -n "$existing_pid" ]; then
    echo "$existing_pid" > "$NGROK_PID_FILE"
    echo "ngrok already running with PID $existing_pid"
    return
  fi

  echo "Starting ngrok tunnel for port $PORT ..."
  nohup ngrok http "$PORT" >"$NGROK_LOG" 2>&1 &
  echo $! > "$NGROK_PID_FILE"
}

wait_for_ngrok_url() {
  for _ in $(seq 1 30); do
    URL="$(curl -fsS http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c 'import json,sys; data=json.load(sys.stdin); tunnels=[t.get("public_url","") for t in data.get("tunnels",[]) if t.get("proto")=="https"]; print(tunnels[0] if tunnels else "")' || true)"
    if [ -n "$URL" ]; then
      echo "$URL"
      return 0
    fi
    sleep 1
  done
  echo ""
  return 1
}

start_server
wait_for_server
start_ngrok
URL="$(wait_for_ngrok_url)"

if [ -z "$URL" ]; then
  echo "ngrok URL not available yet. Check $NGROK_LOG"
  exit 1
fi

ORIGIN="$(python3 -c 'import sys,urllib.parse; print("{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(sys.argv[1])))' "$URL")"

echo
echo "Local server: http://127.0.0.1:$PORT"
echo "ngrok URL: $URL"
echo "OAuth origin to add manually: $ORIGIN"
echo
echo "Google OAuth authorized JavaScript origin update is not fully automated here."
echo "Run 'make oauth-open' to open the credentials page, then paste the origin above."
