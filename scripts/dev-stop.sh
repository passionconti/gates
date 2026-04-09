#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RUN_DIR="${RUN_DIR:-.run}"
SERVER_PID_FILE="$RUN_DIR/server.pid"
NGROK_PID_FILE="$RUN_DIR/ngrok.pid"
PORT="${PORT:-3000}"

find_server_pid() {
  lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n 1
}

find_ngrok_pid() {
  pgrep -f "ngrok http $PORT" | head -n 1
}

stop_from_pid_file() {
  local label="$1"
  local pid_file="$2"
  local fallback_pid="${3:-}"

  if [ ! -f "$pid_file" ]; then
    if [ -n "$fallback_pid" ] && kill -0 "$fallback_pid" >/dev/null 2>&1; then
      kill "$fallback_pid"
      echo "$label: stopped discovered PID $fallback_pid"
    else
      echo "$label: not running"
    fi
    return
  fi

  local pid
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    echo "$label: stopped PID $pid"
  else
    echo "$label: stale pid file removed"
  fi

  rm -f "$pid_file"
}

stop_from_pid_file "server" "$SERVER_PID_FILE" "$(find_server_pid || true)"
stop_from_pid_file "ngrok" "$NGROK_PID_FILE" "$(find_ngrok_pid || true)"
