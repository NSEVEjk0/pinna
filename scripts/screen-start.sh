#!/usr/bin/env bash
# Serve Pinna on this VPS inside a screen session named "pinna".
#
#   window 0: keeper    — holds the session open
#   window 1: web       — the built app on PORT (default 3001)
#   window 2: logs      — follows the log file
#
# Usage: bash scripts/screen-start.sh [port]
set -u
cd "$(dirname "$0")/.."
mkdir -p logs

PORT="${1:-3001}"
LOG="logs/web.log"

if [ ! -d ".next" ]; then
  echo "No build found — running npm run build first."
  npm run build >>"$LOG" 2>&1
fi

screen -dmS pinna bash -c 'while true; do sleep 3600; done'

screen -S pinna -X screen -t web bash -c \
  "cd $(pwd) && PORT=$PORT npm run start 2>&1 | tee -a $LOG; exec bash"

screen -S pinna -X screen -t logs bash -c \
  "cd $(pwd) && tail -f $LOG"

echo "screen 'pinna' started — the app is on http://127.0.0.1:$PORT"
echo "attach with: screen -r pinna"
