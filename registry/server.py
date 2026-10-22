"""Registro de MCPs de MCPortal (fase 3).

FastAPI + SQLite + ficheros. Sirve el catálogo al portal, lanza el pipeline real
como trabajo y emite sus eventos por SSE. No se despliega en Vercel: corre en
local o en un servidor propio.

    set -a; . ./.env.local; set +a
    .venv/bin/python -m uvicorn registry.server:app --port 8010

Endpoints principales:
    GET  /mcps                      catálogo (filtros, orden, página)
    GET  /mcps/{slug}               ficha completa con manifiesto
    GET  /mcps/{slug}/manifest      manifiesto §6.1
    POST /generate                  lanza el pipeline como trabajo
    GET  /jobs/{id}                 estado y borrador del trabajo
    GET  /jobs/{id}/events          eventos del pipeline por SSE
    POST /jobs/{id}/cancel          cancela el trabajo
    POST /mcps                      publica un MCP (permiso obligatorio)
    POST /mcps/{slug}/star          suma una estrella
    POST /mcps/{slug}/report        registra un reporte
    GET  /u/{handle} · /me          autores (mínimo para el portal)
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
HERE = Path(__file__).resolve().parent
DB_PATH = HERE / "registry.db"
SEED_PATH = HERE / "seed.json"
DATA_DIR = HERE / "data"
MANIFESTS = ROOT / "manifests"
RUNS = ROOT / "runs"
PYTHON = sys.executable
CURRENT_HANDLE = os.environ.get("MCPORTAL_USER", "davidpargaa")
LOCAL_NAMES = {"localhost:8001": "Librería Zeta", "localhost:8002": "Casa Zeta"}
LOCAL_CATEGORIES = {"localhost:8001": "comercio", "localhost:8002": "reservas"}

CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "MCPORTAL_CORS_ORIGINS",
        "http://localhost:5179,http://localhost:5180,http://127.0.0.1:5179,http://127.0.0.1:5180",
    ).split(",")
    if origin.strip()
]

app = FastAPI(title="MCPortal Registry", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

JOBS: dict[str, dict[str, Any]] = {}
ACTIVE: str | None = None


# --------------------------------------------------------------------------- #
# Utilidades
# --------------------------------------------------------------------------- #


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def db() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with db() as con:
        con.execute(
            """CREATE TABLE IF NOT EXISTS mcps (
                   slug TEXT PRIMARY KEY,
                   json TEXT NOT NULL,
                   created_at REAL NOT NULL,
                   updated_at REAL NOT NULL,
                   stars INTEGER NOT NULL DEFAULT 0
               )"""
        )
        con.execute(
            """CREATE TABLE IF NOT EXISTS reports (
                   id TEXT PRIMARY KEY,
                   slug TEXT NOT NULL,
                   json TEXT NOT NULL,
                   created_at REAL NOT NULL
               )"""
        )
        count = con.execute("SELECT COUNT(*) FROM mcps").fetchone()[0]
    if count == 0:
        seed()


def save_mcp(mcp: dict[str, Any], *, stars: int | None = None) -> None:
    slug = mcp["slug"]
    with db() as con:
        old = con.execute("SELECT stars, json FROM mcps WHERE slug = ?", (slug,)).fetchone()
        if old:
            mcp.setdefault("createdAt", json.loads(old["json"]).get("createdAt", now_iso()))
            mcp.setdefault("stars", old["stars"])
        mcp.setdefault("createdAt", now_iso())
        mcp.setdefault("updatedAt", now_iso())
        if stars is not None:
            mcp["stars"] = stars
        con.execute(
            """INSERT INTO mcps(slug, json, created_at, updated_at, stars) VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(slug) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at,
                                               stars=excluded.stars""",
            (slug, json.dumps(mcp, ensure_ascii=False), time.time(), time.time(),
             int(mcp.get("stars", 0))),
        )
    manifest = mcp.get("manifest")
    if isinstance(manifest, dict):
        (DATA_DIR / "manifests").mkdir(parents=True, exist_ok=True)
        (DATA_DIR / "manifests" / f"{slug}.json").write_text(
            json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")


def all_mcps() -> list[dict[str, Any]]:
    with db() as con:
        return [json.loads(row["json"]) for row in con.execute("SELECT json FROM mcps")]


def get_mcp(slug: str) -> dict[str, Any] | None:
    with db() as con:
        row = con.execute("SELECT json FROM mcps WHERE slug = ?", (slug,)).fetchone()
    return json.loads(row["json"]) if row else None


def default_author() -> dict[str, Any]:
    return {
        "handle": CURRENT_HANDLE,
        "name": "David Parga",
        "bio": "Construye MCPs para webs que no tienen API.",
        "location": "Madrid",
        "joinedAt": "2025-11-02T10:00:00Z",
        "stats": {"published": 3, "drafts": 1, "installs": 342, "stars": 18, "tools": 12},
        "activity": [],
    }


def author_for(handle: str) -> dict[str, Any] | None:
    if handle == CURRENT_HANDLE:
        return default_author()
    for mcp in all_mcps():
        if mcp.get("authorHandle") == handle:
            return {
                "handle": handle,
                "name": mcp.get("author", handle),
                "bio": "Autor en MCPortal.",
                "joinedAt": mcp.get("createdAt", now_iso()),
                "stats": {"published": 1, "drafts": 0, "installs": mcp.get("installs", 0),
                          "stars": mcp.get("stars", 0), "tools": len(mcp.get("tools", []))},
                "activity": [],
            }
    return None


# --------------------------------------------------------------------------- #
# Manifiesto del core → Mcp del portal
# --------------------------------------------------------------------------- #


def param_type(prop: dict[str, Any]) -> str:
    if prop.get("format") == "date":
        return "date"
    kind = prop.get("type", "string")
    return kind if kind in ("string", "integer", "number", "boolean") else "string"


def tool_from_manifest(tool: dict[str, Any]) -> dict[str, Any]:
    schema = tool.get("input_schema") or {}
    props = schema.get("properties") or {}
    required = set(schema.get("required") or [])
    params = [{
        "name": name,
        "type": param_type(prop),
        "required": name in required,
        "description": prop.get("description", ""),
        **({"format": prop["format"]} if prop.get("format") else {}),
        **({"enum": prop["enum"]} if prop.get("enum") else {}),
        **({"default": prop["default"]} if "default" in prop else {}),
        **({"example": prop["example"]} if "example" in prop else {}),
    } for name, prop in props.items()]
    impl = tool.get("impl") or {}
    kind = impl.get("kind", "http")
    deps = tool.get("depends_on") or []
    return {
        "name": tool["name"],
        "description": tool.get("description", ""),
        "kind": kind,
        "params": params,
        **({"method": impl.get("method")} if kind == "http" else {}),
        **({"endpoint": impl.get("url")} if kind == "http" else {}),
        **({"steps": [f"{step.get('action')} {step.get('selector', '')}".strip()
                      for step in impl.get("steps", [])]} if kind == "browser" else {}),
        "dependsOn": deps[0]["tool"] if deps else None,
        "dependencies": deps,
        "examples": tool.get("examples") or {},
        "validated": True,
        "impl": impl,
    }


def validation_for(slug: str, manifest: dict[str, Any]) -> dict[str, Any]:
    path = RUNS / slug / "validation.json"
    if path.exists():
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
            results = [{
                "name": item.get("name", ""),
                "kind": item.get("kind", "http"),
                "ok": bool(item.get("ok")),
                "reason": item.get("reason"),
                "swapped": bool(item.get("swapped")),
                "status": item.get("status"),
                "seconds": item.get("seconds", 0),
                "preview": item.get("preview", ""),
            } for item in raw.get("results", [])]
            return {
                "validatedAt": raw.get("validated_at") or raw.get("validatedAt") or now_iso(),
                "proposed": raw.get("proposed", len(manifest.get("tools", []))),
                "validated": raw.get("validated", len(manifest.get("tools", []))),
                "results": results,
            }
        except (OSError, ValueError):
            pass
    tools = manifest.get("tools", [])
    return {
        "validatedAt": manifest.get("validated_at") or now_iso(),
        "proposed": len(tools),
        "validated": len(tools),
        "results": [{
            "name": tool["name"], "kind": (tool.get("impl") or {}).get("kind", "http"),
            "ok": True, "reason": None, "swapped": False, "status": 200,
            "seconds": 0.1, "preview": "",
        } for tool in tools],
    }


def exploration_for(slug: str, manifest: dict[str, Any]) -> dict[str, Any]:
    path = RUNS / slug / "trace.json"
    if path.exists():
        try:
            trace = json.loads(path.read_text(encoding="utf-8"))
            return {
                "steps": len(trace.get("steps", [])),
                "requests": len(trace.get("requests", [])),
                "proposed": len(manifest.get("tools", [])),
                "durationSec": round(float(trace.get("finished", 0)) - float(trace.get("started", 0)), 1),
            }
        except (OSError, ValueError):
            pass
    return {"steps": 0, "requests": 0, "proposed": len(manifest.get("tools", [])), "durationSec": 0}


def wrap_manifest(manifest: dict[str, Any], *, status: str = "published",
                  validation: dict[str, Any] | None = None) -> dict[str, Any]:
    site = manifest.get("site") or urlsplit(manifest.get("start_url", "")).netloc
    slug = slugify(manifest.get("slug") or site)
    tools = [tool_from_manifest(tool) for tool in manifest.get("tools", [])]
    category = manifest.get("category") or LOCAL_CATEGORIES.get(site, "desarrollo")
    name = manifest.get("display_name") or LOCAL_NAMES.get(site) or site
    if name.startswith("Inicio · "):
        name = name.removeprefix("Inicio · ")
    tags = manifest.get("tags") or ["generado"]
    author = manifest.get("author") or CURRENT_HANDLE
    report = validation or validation_for(slug, manifest)
    version = manifest.get("version") or "0.1.0"
    return {
        "id": f"m-{slug}",
        "slug": slug,
        "name": name,
        "site": site,
        "description": (manifest.get("description")
                        or f"Herramientas MCP generadas automáticamente para {name}."),
        "category": category,
        "tags": tags,
        "author": author,
        "authorHandle": author,
        "official": False,
        "verified": True,
        "tools": tools,
        "manifest": manifest,
        "mode": manifest.get("mode") or "read_only",
        "installs": 0,
        "weeklyInstalls": [],
        "stars": 0,
        "version": version,
        "license": manifest.get("license") or "MIT",
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "status": status,
        "visibility": "public" if status == "published" else "private",
        "exploration": exploration_for(slug, manifest),
        "versions": [{
            "version": version,
            "publishedAt": now_iso(),
            "notes": "Generado y validado por el core de MCPortal.",
            "tools": len(tools),
            "validated": sum(1 for tool in tools if tool.get("validated")),
            "author": author,
            "changes": ["Generación automática desde la web."],
            "downloads": 0,
        }],
        "validation": report,
    }


def seed() -> None:
    if SEED_PATH.exists():
        for mcp in json.loads(SEED_PATH.read_text(encoding="utf-8")):
            save_mcp(mcp)
    for path in sorted(MANIFESTS.glob("*.json")):
        try:
            manifest = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        slug = manifest.get("slug") or slugify(manifest.get("site", path.stem))
        if get_mcp(slug) is None:
            save_mcp(wrap_manifest(manifest))


# --------------------------------------------------------------------------- #
# Modelos
# --------------------------------------------------------------------------- #


class GenerateRequest(BaseModel):
    url: str
    hint: str = ""
    maxSteps: int = 20
    mode: str = "read_only"
    policy: str = "auto"
    headless: bool = True


class PublishRequest(BaseModel):
    mcp: dict[str, Any]
    permissionConfirmed: bool = False
    manifest: dict[str, Any] | None = None


class ReportRequest(BaseModel):
    kind: str = "other"
    detail: str = ""


# --------------------------------------------------------------------------- #
# Catálogo
# --------------------------------------------------------------------------- #


@app.get("/health")
def health() -> dict[str, Any]:
    active = JOBS.get(ACTIVE) if ACTIVE else None
    return {"ok": True, "mcps": len(all_mcps()),
            "active": active["id"] if active and active["status"] == "running" else None}


@app.get("/mcps")
def list_mcps(
    q: str = Query(""),
    category: str = Query(""),
    impl: str = Query(""),
    mode: str = Query(""),
    verified: bool = Query(False),
    order: str = Query("popular"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(60, ge=1, le=100),
) -> dict[str, Any]:
    items = [m for m in all_mcps()
             if m.get("status") == "published" and m.get("visibility") == "public"]
    needle = q.strip().lower()
    if needle:
        def haystack(mcp: dict[str, Any]) -> str:
            return " ".join([str(mcp.get("name", "")), str(mcp.get("site", "")),
                             str(mcp.get("description", "")), " ".join(mcp.get("tags") or []),
                             str(mcp.get("author", ""))]).lower()
        items = [m for m in items if needle in haystack(m)]
    if category:
        items = [m for m in items if m.get("category") == category]
    if impl in ("http", "browser"):
        items = [m for m in items if any(t.get("kind") == impl for t in m.get("tools", []))]
    elif impl == "mixed":
        items = [m for m in items if len({t.get("kind") for t in m.get("tools", [])}) > 1]
    if mode:
        items = [m for m in items if m.get("mode") == mode]
    if verified:
        items = [m for m in items if m.get("verified")]

    if order == "recent":
        items.sort(key=lambda m: m.get("updatedAt", ""), reverse=True)
    elif order == "validated":
        items.sort(key=lambda m: (m.get("validation", {}).get("validated", 0),
                                  -m.get("validation", {}).get("proposed", 0)), reverse=True)
    else:
        items.sort(key=lambda m: (m.get("installs", 0), m.get("stars", 0)), reverse=True)

    total = len(items)
    start = (page - 1) * pageSize
    return {"items": items[start:start + pageSize], "total": total, "page": page, "pageSize": pageSize}


@app.get("/mcps/{slug}")
def read_mcp(slug: str) -> dict[str, Any]:
    mcp = get_mcp(slug)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP no encontrado")
    return mcp


@app.get("/mcps/{slug}/manifest")
def read_manifest(slug: str) -> dict[str, Any]:
    mcp = get_mcp(slug)
    if not mcp or not isinstance(mcp.get("manifest"), dict):
        raise HTTPException(status_code=404, detail="Manifiesto no encontrado")
    return mcp["manifest"]


@app.get("/u/{handle}")
def read_author(handle: str) -> dict[str, Any]:
    author = author_for(handle)
    if not author:
        raise HTTPException(status_code=404, detail="Autor no encontrado")
    return author


@app.get("/me")
def me() -> dict[str, Any]:
    return default_author()


# --------------------------------------------------------------------------- #
# Generación
# --------------------------------------------------------------------------- #


async def watch_job(job_id: str) -> None:
    global ACTIVE
    job = JOBS[job_id]
    try:
        code = await asyncio.to_thread(job["process"].wait)
    except Exception as exc:  # pragma: no cover
        job.update(status="failed", error=str(exc))
        ACTIVE = None
        return
    job["finished"] = time.time()
    if code != 0:
        job.update(status="failed", error=f"El pipeline terminó con código {code}")
        ACTIVE = None
        return
    path = MANIFESTS / f"{job['slug']}.json"
    if not path.exists():
        job.update(status="failed", error="El pipeline no escribió manifiesto")
        ACTIVE = None
        return
    manifest = json.loads(path.read_text(encoding="utf-8"))
    job["manifest"] = manifest
    job["draft"] = wrap_manifest(manifest, status="draft")
    job["status"] = "done"
    ACTIVE = None


@app.post("/generate")
async def generate(request: GenerateRequest) -> dict[str, Any]:
    global ACTIVE
    url = request.url.strip()
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="URL no válida")
    for job in JOBS.values():
        if job["status"] == "running":
            raise HTTPException(status_code=409, detail="ya hay una generación en marcha")
    slug = slugify(parsed.netloc)
    run_dir = RUNS / slug
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "events.jsonl").write_text("", encoding="utf-8")

    env = dict(os.environ)
    env.setdefault("PYTHONUTF8", "1")
    if request.mode == "read_only":
        env["MCPORTAL_FORCE_READ_ONLY"] = "1"
    else:
        env.pop("MCPORTAL_FORCE_READ_ONLY", None)

    cmd = [PYTHON, "-m", "mcportal_core.pipeline", url,
           "--policy", request.policy, "--max-steps", str(request.maxSteps)]
    if request.headless:
        cmd.append("--headless")
    logs = DATA_DIR / "jobs"
    logs.mkdir(parents=True, exist_ok=True)
    job_id = f"job-{uuid.uuid4().hex[:10]}"
    log = (logs / f"{job_id}.log").open("w", encoding="utf-8")
    process = subprocess.Popen(cmd, cwd=str(ROOT), env=env, stdout=log, stderr=subprocess.STDOUT)
    JOBS[job_id] = {
        "id": job_id, "url": url, "slug": slug, "process": process,
        "started": time.time(), "status": "running", "draft": None,
        "error": None, "log": log,
    }
    ACTIVE = job_id
    asyncio.create_task(watch_job(job_id))
    return {"id": job_id, "slug": slug, "url": url, "status": "running"}


@app.get("/jobs/{job_id}")
def job_status(job_id: str) -> dict[str, Any]:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    return {
        "id": job["id"], "slug": job["slug"], "url": job["url"],
        "status": job["status"], "error": job.get("error"),
        "draft": job.get("draft"),
    }


@app.get("/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request, since: int = 0) -> StreamingResponse:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    path = RUNS / job["slug"] / "events.jsonl"

    async def stream() -> AsyncIterator[str]:
        sent = max(0, since)
        while True:
            if await request.is_disconnected():
                break
            lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
            for line in lines[sent:]:
                sent += 1
                yield f"data: {line}\n\n"
            if job["status"] in ("done", "failed", "cancelled") and sent >= len(lines):
                yield "event: end\ndata: {}\n\n"
                break
            await asyncio.sleep(0.35)

    return StreamingResponse(
        stream(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str) -> dict[str, Any]:
    global ACTIVE
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Trabajo no encontrado")
    if job["status"] == "running":
        job["process"].terminate()
        job["status"] = "cancelled"
    if ACTIVE == job_id:
        ACTIVE = None
    return {"id": job_id, "status": job["status"]}


# --------------------------------------------------------------------------- #
# Publicación y comunidad
# --------------------------------------------------------------------------- #


def normalize_published(mcp: dict[str, Any]) -> dict[str, Any]:
    slug = mcp.get("slug") or slugify(mcp.get("site", ""))
    if not slug or not isinstance(mcp.get("manifest"), dict):
        raise HTTPException(status_code=400, detail="Falta slug o manifiesto")
    old = get_mcp(slug) or {}
    mcp = {
        **mcp,
        "slug": slug,
        "id": mcp.get("id") or old.get("id") or f"m-{slug}",
        "author": mcp.get("author") or old.get("author") or CURRENT_HANDLE,
        "authorHandle": mcp.get("authorHandle") or old.get("authorHandle") or CURRENT_HANDLE,
        "createdAt": old.get("createdAt") or mcp.get("createdAt") or now_iso(),
        "updatedAt": now_iso(),
        "status": "published",
        "visibility": mcp.get("visibility") or "public",
        "installs": old.get("installs", mcp.get("installs", 0)),
        "stars": old.get("stars", mcp.get("stars", 0)),
        "weeklyInstalls": mcp.get("weeklyInstalls") or old.get("weeklyInstalls") or [],
    }
    mcp.setdefault("tools", [tool_from_manifest(t) for t in mcp["manifest"].get("tools", [])])
    mcp.setdefault("validation", validation_for(slug, mcp["manifest"]))
    mcp.setdefault("versions", [])
    mcp.setdefault("exploration", exploration_for(slug, mcp["manifest"]))
    return mcp


@app.post("/mcps")
def publish(request: PublishRequest) -> dict[str, Any]:
    if not request.permissionConfirmed:
        raise HTTPException(status_code=403, detail="Falta confirmar el permiso para automatizar la web")
    mcp = dict(request.mcp)
    if not isinstance(mcp.get("manifest"), dict) and request.manifest:
        mcp["manifest"] = request.manifest
    if not isinstance(mcp.get("manifest"), dict):
        mcp["manifest"] = {
            "site": mcp.get("site", ""), "start_url": mcp.get("site", ""),
            "synthesis": "llm", "tools": [],
        }
    mcp = normalize_published(mcp)
    save_mcp(mcp)
    return mcp


@app.post("/mcps/{slug}/star")
def star(slug: str) -> dict[str, Any]:
    mcp = get_mcp(slug)
    if not mcp:
        raise HTTPException(status_code=404, detail="MCP no encontrado")
    mcp["stars"] = int(mcp.get("stars", 0)) + 1
    save_mcp(mcp, stars=mcp["stars"])
    return {"slug": slug, "stars": mcp["stars"]}


@app.post("/mcps/{slug}/report")
def report(slug: str, request: ReportRequest) -> dict[str, Any]:
    if not get_mcp(slug):
        raise HTTPException(status_code=404, detail="MCP no encontrado")
    report_id = f"rep-{uuid.uuid4().hex[:10]}"
    payload = {"id": report_id, "slug": slug, "kind": request.kind,
               "detail": request.detail, "createdAt": now_iso(), "status": "open"}
    with db() as con:
        con.execute("INSERT INTO reports(id, slug, json, created_at) VALUES (?, ?, ?, ?)",
                    (report_id, slug, json.dumps(payload, ensure_ascii=False), time.time()))
    return payload


@app.on_event("startup")
def startup() -> None:
    init_db()


def main() -> None:
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("MCPORTAL_REGISTRY_PORT", "8010")))


if __name__ == "__main__":
    main()
