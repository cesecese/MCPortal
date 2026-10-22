"""Eventos JSONL del pipeline (contrato §6.4).

Cada línea lleva `t` (epoch) y `type`; el panel y el portal los consumen.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from urllib.parse import urlsplit

RUNS = Path(os.environ.get("MCPORTAL_RUNS", "runs"))


def slug_for(url: str) -> str:
    """`localhost:8001` → `localhost-8001` (§6.4)."""
    parts = urlsplit(url)
    host = parts.netloc or parts.path or url
    return re.sub(r"[^a-z0-9]", "-", host.lower())


class Events:
    def __init__(self, run_dir: Path, reset: bool = True) -> None:
        self.run_dir = Path(run_dir)
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.path = self.run_dir / "events.jsonl"
        self._file = self.path.open("w" if reset else "a", encoding="utf-8")

    def emit(self, type: str, **data) -> None:
        payload = {"t": round(time.time(), 3), "type": type, **data}
        self._file.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")
        self._file.flush()

    def close(self) -> None:
        self._file.close()

    def __enter__(self) -> "Events":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()
