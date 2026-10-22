"""Panel en vivo (sección 7.9).

FastAPI en el puerto 8000: lanza el pipeline como subproceso y sirve sus eventos JSONL. La
página sondea `/api/events` cada 400 ms y pinta agente, red capturada y herramientas.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from mcportal_core.common.events import slug_for

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "runs"
MANIFESTS = ROOT / "manifests"
CACHE = ROOT / "cache"
INDEX = Path(__file__).resolve().parent / "index.html"

app = FastAPI(title="MCPortal · panel en vivo")
active: dict[str, Any] = {"slug": None, "process": None, "url": None}


class RunRequest(BaseModel):
    url: str
    policy: str = "auto"
    no_llm: bool = False
    from_cache: bool = False
    headless: bool = False


def _run_dir(slug: str) -> Path:
    return RUNS / slug


@app.get("/")
def index() -> FileResponse:
    return FileResponse(INDEX)


@app.get("/api/runs")
def runs() -> dict[str, Any]:
    items = []
    for path in sorted(RUNS.glob("*"), key=lambda p: p.stat().st_mtime if p.exists() else 0, reverse=True):
        if not path.is_dir():
            continue
        events = path / "events.jsonl"
        items.append({
            "slug": path.name,
            "events": sum(1 for _ in events.open(encoding="utf-8")) if events.exists() else 0,
            "mtime": path.stat().st_mtime,
        })
    return {"runs": items, "active": active["slug"]}


@app.get("/api/events")
def events(run: str = Query(...), since: int = 0) -> JSONResponse:
    path = _run_dir(run) / "events.jsonl"
    if not path.exists():
        return JSONResponse({"events": [], "next": 0, "reset": since > 0})
    lines = [line for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) < since:  # el fichero se reinició: el cliente empieza de cero
        return JSONResponse({"events": [json.loads(l) for l in lines], "next": len(lines), "reset": True})
    batch = [json.loads(line) for line in lines[since:]]
    return JSONResponse({"events": batch, "next": len(lines), "reset": False})


@app.get("/api/manifest")
def manifest(run: str = Query(...)) -> JSONResponse:
    for path in (MANIFESTS / f"{run}.json", _run_dir(run) / "proposed.json"):
        if path.exists():
            return JSONResponse(json.loads(path.read_text(encoding="utf-8")))
    raise HTTPException(status_code=404, detail="sin manifiesto")


@app.post("/api/run")
def start(request: RunRequest) -> dict[str, Any]:
    process = active.get("process")
    if process is not None and process.poll() is None:
        raise HTTPException(status_code=409, detail="ya hay una ejecución en marcha")

    slug = slug_for(request.url)
    run_dir = _run_dir(slug)
    run_dir.mkdir(parents=True, exist_ok=True)
    # vaciar los eventos ANTES de lanzar el subproceso
    (run_dir / "events.jsonl").write_text("", encoding="utf-8")

    args = [sys.executable, "-m", "mcportal_core.pipeline", request.url, "--policy", request.policy]
    if request.no_llm:
        args.append("--no-llm")
    if request.headless:
        args.append("--headless")
    if request.from_cache:
        trace = CACHE / slug / "trace.json"
        if not trace.exists():
            raise HTTPException(status_code=404, detail=f"no hay traza en caché para {slug}")
        args += ["--from-trace", str(trace)]

    env = dict(os.environ)
    env.setdefault("PYTHONUTF8", "1")
    process = subprocess.Popen(args, cwd=str(ROOT), env=env,
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    active.update({"slug": slug, "process": process, "url": request.url})
    return {"run": slug, "pid": process.pid}


@app.get("/api/status")
def status() -> dict[str, Any]:
    process = active.get("process")
    return {
        "run": active["slug"],
        "running": bool(process and process.poll() is None),
        "code": None if process is None else process.poll(),
    }


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)


if __name__ == "__main__":  # pragma: no cover
    main()
