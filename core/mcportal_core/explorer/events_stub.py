"""Stub de eventos mientras la persona 2 no publica `mcportal_core.common.events`.

Misma interfaz que el contrato: `Events(run_dir).emit(type, **data)` escribe una línea
JSON en `events.jsonl` con `t` y `type`, y `slug_for(url)` normaliza el host.
"""

from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[3]  # <repo>/core/mcportal_core/explorer/events_stub.py
RUNS = ROOT / "runs"


def slug_for(url: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", urlsplit(url).netloc.lower()).strip("-")


class Events:
    def __init__(self, run_dir: Path):
        self.run_dir = run_dir
        run_dir.mkdir(parents=True, exist_ok=True)
        self.path = run_dir / "events.jsonl"

    def reset(self) -> None:
        self.path.write_text("", encoding="utf-8")

    def emit(self, type: str, **data) -> None:
        line = json.dumps({"t": round(time.time(), 3), "type": type, **data},
                          ensure_ascii=False, default=str)
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")
        print(f"[{type}] " + ", ".join(f"{k}={str(v)[:90]}" for k, v in data.items()), flush=True)
