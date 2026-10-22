"""Comprobación del contrato (sección 6) para manifest.example.json y fixtures/.

Uso: py fixtures/check_contract.py   (desde la raíz del repo)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors: list[str] = []
warnings: list[str] = []


def err(msg: str) -> None:
    errors.append(msg)


def warn(msg: str) -> None:
    warnings.append(msg)


def params_in(value) -> set[str]:
    """Nombres de parámetro usados en plantillas {p}."""
    found: set[str] = set()
    if isinstance(value, str):
        found.update(re.findall(r"\{([a-z_][a-z0-9_]*)\}", value))
    elif isinstance(value, dict):
        for v in value.values():
            found |= params_in(v)
    elif isinstance(value, list):
        for v in value:
            found |= params_in(v)
    return found


def check_manifest() -> None:
    path = ROOT / "manifest.example.json"
    m = json.loads(path.read_text(encoding="utf-8"))
    for key in ("site", "start_url", "tools"):
        if key not in m:
            err(f"manifest: falta '{key}'")
    names = set()
    for t in m["tools"]:
        name = t.get("name", "<sin nombre>")
        if name in names:
            err(f"manifest: nombre duplicado {name}")
        names.add(name)
        if not re.fullmatch(r"[a-z][a-z0-9_]*", name):
            err(f"manifest: {name} no es snake_case en inglés")
        if not t.get("description"):
            err(f"manifest: {name} sin description")
        schema = t.get("input_schema") or {}
        props = schema.get("properties") or {}
        required = set(schema.get("required") or [])
        missing = required - set(props)
        if missing:
            err(f"manifest: {name} required sin propiedad: {missing}")
        impl = t.get("impl") or {}
        kind = impl.get("kind")
        if kind not in ("http", "browser"):
            err(f"manifest: {name} impl.kind inválido: {kind!r}")
            continue
        if kind == "http":
            used = params_in(impl.get("url", ""))
            used |= params_in(impl.get("body"))
            used |= params_in(impl.get("headers"))
            if not impl.get("method"):
                err(f"manifest: {name} http sin method")
            if not impl.get("url"):
                err(f"manifest: {name} http sin url")
            if impl.get("body_type") not in (None, "json", "form"):
                err(f"manifest: {name} body_type inválido")
        else:
            if not impl.get("start_url"):
                err(f"manifest: {name} browser sin start_url")
            if not impl.get("steps"):
                err(f"manifest: {name} browser sin steps")
            for s in impl.get("steps") or []:
                if s.get("action") not in ("fill", "select", "click", "press", "check", "wait"):
                    err(f"manifest: {name} paso con acción inválida {s.get('action')!r}")
                if not s.get("selector"):
                    err(f"manifest: {name} paso sin selector")
            used = params_in(impl.get("steps"))
        undeclared = used - set(props)
        if undeclared:
            err(f"manifest: {name} usa {sorted(undeclared)} sin declarar en input_schema")
        for p, spec in props.items():
            if spec.get("type") not in ("string", "integer", "number", "boolean"):
                err(f"manifest: {name}.{p} tipo inválido {spec.get('type')!r}")
            if spec.get("type") == "string" and "enum" in spec and not isinstance(spec["enum"], list):
                err(f"manifest: {name}.{p} enum no es lista")
        for dep in t.get("depends_on") or []:
            if dep.get("param") not in props:
                err(f"manifest: {name} depends_on de parámetro inexistente {dep.get('param')}")
            if dep.get("tool") not in names and dep.get("tool") != name:
                warn(f"manifest: {name} depends_on {dep.get('tool')} no está antes en la lista")
            if not dep.get("path"):
                err(f"manifest: {name} depends_on sin path")
        for ex in (t.get("examples") or {}):
            if ex not in props:
                err(f"manifest: {name} examples con clave desconocida {ex}")
    print(f"manifest.example.json: {len(m['tools'])} herramientas")


def check_trace() -> None:
    path = ROOT / "fixtures" / "trace.example.json"
    t = json.loads(path.read_text(encoding="utf-8"))
    req_ids = {r["id"] for r in t.get("requests", [])}
    if len(req_ids) != len(t.get("requests", [])):
        err("trace: ids de petición duplicados")
    for s in t.get("steps", []):
        for key in ("i", "action", "url_before", "url_after", "request_ids", "has_main", "forms"):
            if key not in s:
                err(f"trace: paso {s.get('i')} sin '{key}'")
        for rid in s.get("request_ids", []):
            if rid not in req_ids:
                err(f"trace: paso {s['i']} referencia petición {rid} inexistente")
    for r in t.get("requests", []):
        for key in ("id", "step", "kind", "method", "url", "status"):
            if key not in r:
                err(f"trace: petición {r.get('id')} sin '{key}'")
        if r["step"] not in {s["i"] for s in t.get("steps", [])}:
            err(f"trace: petición {r['id']} con step {r['step']} inexistente")
    cids = {c["id"] for c in t.get("candidates", [])}
    for c in t.get("candidates", []):
        for key in ("id", "request_ids", "variants", "step", "trigger", "method", "path",
                    "query", "url", "params", "literals", "status", "csrf_fields", "browser"):
            if key not in c:
                err(f"trace: candidato {c.get('id')} sin '{key}'")
        for rid in c.get("request_ids", []):
            if rid not in req_ids:
                err(f"trace: candidato {c['id']} referencia petición {rid} inexistente")
        names = [p["name"] for p in c.get("params", [])]
        if len(names) != len(set(names)):
            err(f"trace: candidato {c['id']} con parámetros repetidos")
        for p in c.get("params", []):
            if p.get("source") not in ("input", "response"):
                err(f"trace: candidato {c['id']} parámetro {p['name']} con source inválido")
            if p.get("source") == "response":
                if p.get("from_request") not in req_ids:
                    err(f"trace: candidato {c['id']} parámetro {p['name']} con from_request inexistente")
                if p.get("from_candidate") not in cids:
                    err(f"trace: candidato {c['id']} parámetro {p['name']} con from_candidate inexistente")
        used = params_in(c.get("url", "")) | params_in(c.get("body")) | params_in(c.get("query"))
        undeclared = used - set(names)
        if undeclared:
            err(f"trace: candidato {c['id']} usa {sorted(undeclared)} sin declarar")
        if c.get("browser"):
            b = c["browser"]
            for key in ("start_url", "steps", "extract", "params"):
                if key not in b:
                    err(f"trace: candidato {c['id']} browser sin '{key}'")
            bnames = {p["name"] for p in b.get("params", [])}
            bused = params_in(b.get("steps"))
            if bused - bnames:
                err(f"trace: candidato {c['id']} receta usa {sorted(bused - bnames)} sin declarar")
    for d in t.get("dependencies", []):
        for key in ("from_request", "path", "to_request", "location", "value", "from_candidate", "to_candidate"):
            if key not in d:
                err(f"trace: dependencia sin '{key}'")
        if d.get("from_request") not in req_ids:
            err(f"trace: dependencia con from_request {d.get('from_request')} inexistente")
        if d.get("to_request") not in req_ids:
            err(f"trace: dependencia con to_request {d.get('to_request')} inexistente")
        if d.get("from_candidate") not in cids or d.get("to_candidate") not in cids:
            err("trace: dependencia con candidato inexistente")
    reqs_by_step: dict[int, int] = {}
    for r in t["requests"]:
        reqs_by_step[r["step"]] = reqs_by_step.get(r["step"], 0) + 1
    print(f"trace.example.json: {len(t['steps'])} pasos, {len(t['requests'])} peticiones, "
          f"{len(t['candidates'])} candidatos, {len(t['dependencies'])} dependencias")


EVENT_TYPES = {
    "run_started", "explore_started", "mode", "warning", "thought", "step", "request", "blocked",
    "finish", "candidate", "explore_done", "tool_proposed", "candidate_discarded", "synth_done",
    "validate_retry", "validated", "validate_done", "done",
}


def check_events() -> None:
    path = ROOT / "fixtures" / "events.example.jsonl"
    seen: set[str] = set()
    last_t = -1.0
    n = 0
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        n += 1
        try:
            ev = json.loads(line)
        except json.JSONDecodeError as e:
            err(f"events: línea {i} no es JSON: {e}")
            continue
        if "t" not in ev or "type" not in ev:
            err(f"events: línea {i} sin 't' o 'type'")
            continue
        if ev["t"] < last_t:
            err(f"events: línea {i} con t no creciente")
        last_t = ev["t"]
        if ev["type"] not in EVENT_TYPES:
            err(f"events: línea {i} tipo desconocido {ev['type']!r}")
        seen.add(ev["type"])
    missing = EVENT_TYPES - seen
    if missing:
        err(f"events: faltan tipos {sorted(missing)}")
    print(f"events.example.jsonl: {n} eventos, {len(seen)}/{len(EVENT_TYPES)} tipos")


if __name__ == "__main__":
    check_manifest()
    check_trace()
    check_events()
    for w in warnings:
        print(f"AVISO  {w}")
    for e in errors:
        print(f"ERROR  {e}")
    print()
    print("OK: los tres artefactos cumplen el contrato" if not errors else f"FALLAN {len(errors)} comprobaciones")
    sys.exit(1 if errors else 0)
