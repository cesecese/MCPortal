#!/usr/bin/env bash
# Arranca la web de recepción en http://127.0.0.1:8020
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -x .venv/bin/uvicorn ]; then
  echo "Falta el entorno. Crea el venv e instala las dependencias:" >&2
  echo "  /opt/homebrew/opt/python@3.12/bin/python3.12 -m venv .venv" >&2
  echo "  .venv/bin/pip install fastapi uvicorn httpx playwright mcp" >&2
  exit 1
fi
exec .venv/bin/uvicorn sites.hostal.app:app --host 127.0.0.1 --port 8020
