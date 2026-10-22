"""Eventos JSONL de una ejecución (contrato 6.4).

Una línea por evento, siempre con `t` (epoch) y `type`. Los consumen el panel en vivo y, en la
fase 3, el registro y el portal por SSE.
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path
from urllib.parse import urlparse

EVENT_TYPES = (
    "run_started", "explore_started", "mode", "warning", "thought", "step", "request", "blocked",
    "finish", "candidate", "explore_done", "tool_proposed", "candidate_discarded", "synth_done",
    "validate_retry", "validated", "validate_done", "done",
)


def slug_for(url: str) -> str:
    """`localhost:8001` → `localhost-8001` (host con todo lo no alfanumérico cambiado por `-`)."""
    host = urlparse(url).netloc or url
    host = host.rsplit("@", 1)[-1].lower()
    return re.sub(r"[^a-z0-9]", "-", host)


class Events:
    """Escribe los eventos de una ejecución en `events.jsonl` dentro de su carpeta."""

    def __init__(self, run_dir: str | Path, filename: str = "events.jsonl") -> None:
        self.path = Path(run_dir) / filename
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def reset(self) -> None:
        self.path.write_text("", encoding="utf-8")

    def emit(self, type: str, **data) -> dict:
        if type not in EVENT_TYPES:
            raise ValueError(f"tipo de evento desconocido: {type!r}")
        event = {"t": round(time.time(), 3), "type": type, **data}
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(event, ensure_ascii=False) + "\n")
        return event

    def read(self, since: int = 0) -> list[dict]:
        if not self.path.exists():
            return []
        lines = self.path.read_text(encoding="utf-8").splitlines()
        return [json.loads(line) for line in lines[since:] if line.strip()]


class NullEvents(Events):
    """Sustituto para pruebas: no escribe nada."""

    def __init__(self) -> None:  # noqa: D107 - no llama a super
        self.path = None  # type: ignore[assignment]
        self.emitted: list[dict] = []

    def reset(self) -> None:
        self.emitted.clear()

    def emit(self, type: str, **data) -> dict:
        event = {"t": round(time.time(), 3), "type": type, **data}
        self.emitted.append(event)
        return event

    def read(self, since: int = 0) -> list[dict]:
        return list(self.emitted[since:])
