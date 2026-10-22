"""Validador: manifiesto propuesto → manifiesto validado (sección 7.7).

Ejecuta cada herramienta con las entradas de ejemplo y con los ids que devuelven las herramientas
de las que depende. Solo las que responden bien sobreviven; si una herramienta `http` falla y
tiene `impl.alt`, se prueba la receta de navegador y se queda la que funciona.
"""
from __future__ import annotations

import json
import re
import time
from typing import Any

from ..common.events import Events, NullEvents
from ..runtime import executor

ERROR_RE = re.compile(r"\b(error|exception|traceback|not found|no encontrad|forbidden|denegad)", re.IGNORECASE)
PATH_TOKEN = re.compile(r"([A-Za-z0-9_\-]+)|\[(\d+)\]")


def resolve_path(data: Any, path: str | None) -> Any:
    """Resuelve `cart_id` o `results[0].id` sobre una respuesta JSON."""
    if not data or not path:
        return None
    current = data
    for name, index in PATH_TOKEN.findall(str(path)):
        try:
            if index:
                current = current[int(index)]
            else:
                current = current[name]
        except (KeyError, IndexError, TypeError):
            return None
    return current


def find_key(data: Any, key: str, depth: int = 0) -> Any:
    """Busca la clave final en cualquier nivel (último recurso)."""
    if depth > 6:
        return None
    if isinstance(data, dict):
        if key in data and data[key] not in (None, "", [], {}):
            return data[key]
        for value in data.values():
            found = find_key(value, key, depth + 1)
            if found is not None:
                return found
    elif isinstance(data, list):
        for item in data:
            found = find_key(item, key, depth + 1)
            if found is not None:
                return found
    return None


def judge(result: executor.Result) -> tuple[bool, str]:
    """¿La respuesta es un éxito de verdad?"""
    if result.status is not None and not (200 <= result.status < 300):
        return False, f"estado {result.status}"
    body = result.text or ""
    payload = body.split("\n", 1)[1] if body.startswith("HTTP ") and "\n" in body else body
    if not payload.strip():
        return False, "cuerpo vacío"
    if isinstance(result.data, dict) and ("error" in result.data or "errors" in result.data):
        return False, "la respuesta JSON trae error"
    if not isinstance(result.data, dict) and payload.strip():
        head = payload.strip()[:300]
        match = ERROR_RE.search(head)
        if match:
            return False, f"el texto empieza por un error ({match.group(0)})"
    return True, "ok"


def topo_order(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ordena por dependencias; si hay ciclo, conserva el orden original."""
    by_name = {tool["name"]: tool for tool in tools}
    ordered: list[dict[str, Any]] = []
    visiting: set[str] = set()
    done: set[str] = set()

    def visit(name: str) -> bool:
        if name in done:
            return True
        if name in visiting:
            return False
        tool = by_name.get(name)
        if tool is None:
            return True
        visiting.add(name)
        ok = True
        for dep in tool.get("depends_on") or []:
            ok = visit(dep["tool"]) and ok
        visiting.discard(name)
        done.add(name)
        ordered.append(tool)
        return ok

    for tool in tools:
        visit(tool["name"])
    return ordered


def build_arguments(tool: dict[str, Any], produced: dict[str, Any]) -> tuple[dict[str, Any], str | None]:
    args = dict(tool.get("examples") or {})
    for dep in tool.get("depends_on") or []:
        source = produced.get(dep["tool"])
        value = resolve_path(source, dep.get("path"))
        if value is None and dep.get("path"):
            value = find_key(source, str(dep["path"]).split(".")[-1].split("[")[0])
        if value is not None:
            args[dep["param"]] = value
    required = (tool.get("input_schema") or {}).get("required") or []
    impl = tool.get("impl") or {}
    recipe = {p["name"]: p for p in impl.get("params") or []}
    upload_params = set()
    for step in impl.get("steps") or []:
        if step.get("action") == "upload":
            match = re.search(r"\{(\w+)\}", str(step.get("value") or ""))
            if match:
                upload_params.add(match.group(1))
    # Los archivos no pueden inventarse: se usa el ejemplo de la receta.
    for name in upload_params:
        if name in recipe and recipe[name].get("example") not in (None, ""):
            args[name] = recipe[name]["example"]
    for name in required:
        if args.get(name) is None and name in recipe and recipe[name].get("example") not in (None, ""):
            args[name] = recipe[name]["example"]
        if args.get(name) is None:
            return args, f"falta {name} sin valor de ejemplo"
    return args, None


async def _attempt(tool: dict[str, Any], args: dict[str, Any]) -> tuple[bool, str, executor.Result, float]:
    started = time.monotonic()
    try:
        result = await executor.run(tool, args)
    except Exception as exc:  # error de ejecución: cuenta como fallo
        result = executor.Result(ok=False, status=None, text=f"Error: {exc}")
    elapsed = round(time.monotonic() - started, 2)
    ok, reason = judge(result)
    return ok, reason, result, elapsed


async def _retry_enum(
    tool: dict[str, Any],
    args: dict[str, Any],
    result: executor.Result,
    reason: str,
    elapsed: float,
) -> tuple[bool, str, executor.Result, float, dict[str, Any]]:
    """Si falla por datos (409/422) y hay un parámetro con `enum`, prueba otros valores válidos.

    Las horas de reserva, por ejemplo, dependen de la disponibilidad: el ejemplo puede estar
    ocupado aunque la herramienta funcione.
    """
    schema = tool.get("input_schema") or {}
    for name, spec in (schema.get("properties") or {}).items():
        values = spec.get("enum") or []
        if not values or len(values) > 12:
            continue
        for value in values:
            if value == args.get(name):
                continue
            trial = dict(args)
            trial[name] = value
            ok, why, attempt, seconds = await _attempt(tool, trial)
            elapsed = round(elapsed + seconds, 2)
            if ok:
                return True, f"{reason} → funciona con {name}={value!r}", attempt, elapsed, trial
    return False, reason, result, elapsed, args


async def validate(
    manifest: dict[str, Any],
    events: Events | None = None,
    run_dir: str | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    events = events or NullEvents()
    tools = topo_order(list(manifest.get("tools") or []))
    produced: dict[str, Any] = {}
    results: list[dict[str, Any]] = []
    kept: list[dict[str, Any]] = []

    for tool in tools:
        name = tool["name"]
        original_kind = tool["impl"]["kind"]
        args, problem = build_arguments(tool, produced)
        if problem:
            results.append({"name": name, "kind": tool["impl"]["kind"], "ok": False,
                            "reason": problem, "swapped": False, "args": args,
                            "status": None, "seconds": 0.0, "preview": ""})
            events.emit("validated", name=name, ok=False, kind=tool["impl"]["kind"],
                        reason=problem, swapped=False, status=None)
            continue

        started = time.monotonic()
        try:
            result = await executor.run(tool, args)
        except Exception as exc:  # error de ejecución: se prueba el alt y si no, fuera
            result = executor.Result(ok=False, status=None, text=f"Error: {exc}")
        elapsed = round(time.monotonic() - started, 2)
        ok, reason = judge(result)
        swapped = False
        alt = tool["impl"].get("alt")
        if not ok and alt:
            candidate = dict(tool)
            candidate["impl"] = alt
            events.emit("validate_retry", name=name,
                        reason=f"{reason}; se prueba la implementación de navegador",
                        kind=alt.get("kind", "browser"))
            started = time.monotonic()
            try:
                retry = await executor.run(candidate, args)
            except Exception as exc:
                retry = executor.Result(ok=False, status=None, text=f"Error: {exc}")
            elapsed = round(time.monotonic() - started, 2)
            ok, retry_reason = judge(retry)
            if ok:
                tool = candidate
                result = retry
                reason = f"{reason} → funciona con navegador"
            else:
                reason = f"{reason}; con navegador tampoco: {retry_reason}"
                result = retry
                # los reintentos de datos usan la implementación que casi funcionó
                tool = candidate

        if not ok and result.status in (409, 422):
            ok, reason, result, elapsed, args = await _retry_enum(tool, args, result, reason, elapsed)

        swapped = tool["impl"]["kind"] != original_kind
        entry = {
            "name": name,
            "kind": tool["impl"]["kind"],
            "ok": ok,
            "reason": reason,
            "swapped": swapped,
            "args": args,
            "status": result.status,
            "seconds": elapsed,
            "preview": (result.text or "")[:400],
        }
        results.append(entry)
        events.emit("validated", name=name, ok=ok, kind=entry["kind"], reason=reason,
                    swapped=swapped, status=result.status)
        if ok:
            clean = {key: value for key, value in tool.items() if key != "candidate"}
            clean["impl"] = {k: v for k, v in clean["impl"].items() if k != "alt"}
            kept.append(clean)
            produced[name] = result.data

    validated = dict(manifest)
    validated["tools"] = kept
    validated["validated_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    events.emit("validate_done", proposed=len(tools), validated=len(kept))

    report = {"proposed": len(tools), "validated": len(kept), "results": results}
    if run_dir:
        from pathlib import Path

        path = Path(run_dir) / "validation.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    return validated, report
