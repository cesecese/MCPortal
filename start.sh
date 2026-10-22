#!/usr/bin/env bash
# Arranca las webs de demo y el panel en vivo (secciones 7.1 y 7.9).
#   bash start.sh      (Ctrl+C para parar todo)
set -euo pipefail
cd "$(dirname "$0")"

PY="./.venv/Scripts/python.exe"
[ -x "$PY" ] || PY="./.venv/bin/python"
[ -x "$PY" ] || PY="python"

export PYTHONUTF8=1

trap 'kill 0' EXIT

"$PY" sites/shop/app.py &
"$PY" sites/restaurant/app.py &
"$PY" sites/gestoria/app.py &
"$PY" core/panel/server.py &

wait
