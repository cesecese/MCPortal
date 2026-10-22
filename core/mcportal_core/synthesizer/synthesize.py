"""Sintetizador: candidatos de una traza → manifiesto propuesto (sección 7.6).

Dos modos, con la misma salida:
- `deterministic`: una herramienta por candidato, sin LLM. Es el plan B y la base de las pruebas.
- `llm`: el LLM decide qué merece ser herramienta, las nombra, describe y escribe sus esquemas.
  El código monta el manifiesto y aplica las reglas duras (plantillas, tipos, alt, dependencias).
"""
from __future__ import annotations

import json
import re
import unicodedata
from typing import Any, Iterable

from ..common import llm
from ..common.events import Events, NullEvents

GENERIC_SEGMENTS = {"inicio", "home", "welcome", "bienvenido", "index", "portada", "principal"}
TITLE_SPLIT = re.compile(r"\s*[·|—:]\s*|\s+-\s+")
NON_ALNUM = re.compile(r"[^a-z0-9]+")
TEMPLATE = re.compile(r"\{([a-z_][a-z0-9_]*)\}", re.IGNORECASE)

SYSTEM = """Conviertes la traza de exploración de una web en herramientas MCP para que otro agente use esa web como si tuviera API. Los parámetros y las dependencias ya vienen resueltos por código determinista: tu trabajo es decidir qué candidatos merecen ser herramientas, nombrarlas, describirlas, deduplicarlas y escribir sus esquemas. Solo produces datos; nunca código.

Reglas:
- Una herramienta por capacidad distinta (buscar, ver detalle, crear carrito, añadir, pagar, consultar, reservar…). Descarta lo que no aporta: cargas de página, peticiones de analítica o seguimiento, recursos internos, duplicados. Explica cada descarte en discarded.
- kind "http" si hay un endpoint claro. kind "browser" si el candidato tiene csrf_fields (token ligado a la sesión) o solo funciona a través de la interfaz. En browser, usa exactamente los nombres de parámetro de browser.params del candidato; url, method y body se ignoran.
- En http, url y body son plantillas: {nombre} se sustituye por el parámetro. Puedes renombrar un parámetro (q → query) cambiándolo también en la plantilla, convertir en parámetro un literal útil (p. ej. qty) o dejar literales fijos. Cada {nombre} de la plantilla debe estar en params. Un parámetro de query opcional ausente se omite de la URL.
- En herramientas de búsqueda o listado, los filtros (q, categoría, estado, tipo, página…) deben ser parámetros opcionales; no los fijes como literales salvo que la web no permita cambiarlos.
- Nombres en snake_case e inglés, con el prefijo de sitio indicado (p. ej. PREFIJO_search_products).
- Descripciones en español, concretas: qué hace, qué devuelve y de qué depende («requiere un cart_id obtenido con PREFIJO_create_cart»). Incluye formatos (fecha YYYY-MM-DD) y valores válidos conocidos.
- Si un parámetro sale de la respuesta de otra herramienta (source "response" en el candidato), pon en depends_on_tool el nombre de la herramienta que generas para el candidato from_candidate y en depends_on_field la ruta del campo (path del candidato, p. ej. results[0].id o cart_id). Si no, déjalos vacíos.
- example: valor realista para probar la herramienta. Nunca el centinela zxq_…: si el campo era una búsqueda, pon un término con resultados probables. Vacío en los parámetros que salen de dependencias."""

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "tools": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "candidate_id": {"type": "string"},
                    "name": {"type": "string"},
                    "description": {"type": "string"},
                    "kind": {"type": "string", "enum": ["http", "browser"]},
                    "method": {"type": "string"},
                    "url": {"type": "string"},
                    "body_type": {"type": "string", "enum": ["none", "json", "form"]},
                    "body": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
                            "required": ["key", "value"],
                            "additionalProperties": False,
                        },
                    },
                    "params": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "type": {"type": "string", "enum": ["string", "integer", "number", "boolean"]},
                                "description": {"type": "string"},
                                "required": {"type": "boolean"},
                                "example": {"type": "string"},
                                "enum": {"type": "array", "items": {"type": "string"}},
                                "depends_on_tool": {"type": "string"},
                                "depends_on_field": {"type": "string"},
                            },
                            "required": [
                                "name", "type", "description", "required", "example", "enum",
                                "depends_on_tool", "depends_on_field",
                            ],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": [
                    "candidate_id", "name", "description", "kind", "method", "url", "body_type",
                    "body", "params",
                ],
                "additionalProperties": False,
            },
        },
        "discarded": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"candidate_id": {"type": "string"}, "reason": {"type": "string"}},
                "required": ["candidate_id", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["tools", "discarded"],
    "additionalProperties": False,
}


# ------------------------------------------------------------------------------- prefijo
def slugify(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text)
    plain = "".join(ch for ch in plain if not unicodedata.combining(ch))
    return NON_ALNUM.sub("_", plain.lower()).strip("_")


def site_prefix(site: str, title: str = "") -> str:
    """Dominio en webs reales; en localhost, el nombre sacado del título del sitio."""
    host = site.split("@")[-1].split(":")[0].lower()
    local = host in ("localhost", "127.0.0.1", "0.0.0.0") or bool(re.fullmatch(r"[\d.]+", host))
    if not local and "." in host:
        return slugify(host.split(".")[-2])
    segments = [s for s in TITLE_SPLIT.split(title or "") if s.strip()]
    useful = [s for s in segments if slugify(s) not in GENERIC_SEGMENTS]
    candidate = useful[-1] if useful else (segments[-1] if segments else site)
    words = slugify(candidate).split("_")[:2]
    return "_".join(w for w in words if w) or slugify(site)


# --------------------------------------------------------------------------- payload LLM
def steps_summary(trace: dict[str, Any]) -> list[str]:
    lines = []
    for step in trace.get("steps") or []:
        action = step.get("action") or {}
        kind = action.get("type")
        element = step.get("element") or {}
        label = element.get("label") or ""
        ids = step.get("request_ids") or []
        reqs = [r for r in trace.get("requests") or [] if r.get("id") in ids]
        shown = ", ".join(f"{r.get('method')} {_short_path(r)}" for r in reqs)
        if kind == "goto":
            text = f"{step.get('i')}: goto {action.get('url')}"
        else:
            text = f"{step.get('i')}: {kind} [{action.get('id')}] {element.get('kind', '')} \"{label}\""
        lines.append(f"{text} → {shown}" if shown else text)
    return lines


def _short_path(request: dict[str, Any]) -> str:
    from urllib.parse import urlsplit

    parts = urlsplit(request.get("url") or "")
    path = re.sub(r"/[^/]*\d[^/]*", "/{…}", parts.path)
    return path + ("?…" if parts.query else "")


def llm_payload(trace: dict[str, Any]) -> str:
    prefix = site_prefix(trace.get("site") or "", trace.get("title") or "")
    candidates = []
    for cand in trace.get("candidates") or []:
        params = []
        for param in cand.get("params") or []:
            compact = {k: param.get(k) for k in ("name", "type", "example", "source", "path",
                                                 "from_candidate", "label", "format", "enum")
                       if param.get(k) is not None}
            params.append(compact)
        candidates.append({
            "id": cand.get("id"),
            "method": cand.get("method"),
            "url": cand.get("url"),
            "body_type": cand.get("body_type"),
            "body": cand.get("body"),
            "status": cand.get("status"),
            "content_type": cand.get("content_type"),
            "response_preview": cand.get("response_preview"),
            "trigger": cand.get("trigger"),
            "csrf_fields": cand.get("csrf_fields") or [],
            "variants": cand.get("variants"),
            "params": params,
            "literals": [lit for lit in cand.get("literals") or [] if lit.get("value") not in ("", None)],
            "browser": (
                {
                    "start_url": (cand.get("browser") or {}).get("start_url"),
                    "params": [p.get("name") for p in (cand.get("browser") or {}).get("params") or []],
                }
                if cand.get("browser") else None
            ),
        })
    payload = {
        "site": trace.get("site"),
        "site_title": trace.get("title"),
        "prefix": prefix,
        "start_url": trace.get("start_url"),
        "steps": steps_summary(trace),
        "candidates": candidates,
    }
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


# ------------------------------------------------------------------------- utilidades
def _typed(value: Any, type_name: str) -> Any:
    try:
        if type_name == "integer":
            return int(float(value))
        if type_name == "number":
            return float(value)
        if type_name == "boolean":
            if isinstance(value, bool):
                return value
            return str(value).strip().lower() in ("1", "true", "si", "sí", "yes", "on")
    except (TypeError, ValueError):
        return value
    return value


def _coerce_enum(values: Iterable[Any], type_name: str) -> list[Any]:
    out = []
    for value in values:
        coerced = _typed(value, type_name)
        if type_name == "integer" and not isinstance(coerced, int):
            continue
        if type_name == "number" and not isinstance(coerced, (int, float)):
            continue
        out.append(coerced)
    return out


def _template_params(value: Any) -> set[str]:
    found: set[str] = set()
    if isinstance(value, str):
        found.update(TEMPLATE.findall(value))
    elif isinstance(value, dict):
        for item in value.values():
            found |= _template_params(item)
    elif isinstance(value, list):
        for item in value:
            found |= _template_params(item)
    return found


def _set_nested(target: dict[str, Any], dotted: str, value: Any) -> None:
    parts = dotted.split(".")
    node = target
    for part in parts[:-1]:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[parts[-1]] = value


def _recover_literal_type(key: str, value: Any, observed: Any) -> Any:
    """Un literal del body recupera el tipo que tenía en el body observado."""
    if isinstance(observed, dict):
        for obs_key, obs_value in observed.items():
            if obs_key == key:
                if isinstance(value, str) and not isinstance(obs_value, str):
                    return _typed(value, "integer" if isinstance(obs_value, int) else "number"
                                  if isinstance(obs_value, float) else "boolean")
                return value
    return value


def _input_schema(params: list[dict[str, Any]]) -> dict[str, Any]:
    properties: dict[str, Any] = {}
    required: list[str] = []
    for param in params:
        spec: dict[str, Any] = {"type": param["type"]}
        if param.get("description"):
            spec["description"] = param["description"]
        if param.get("format"):
            spec["format"] = param["format"]
        if param.get("enum"):
            spec["enum"] = param["enum"]
        if "default" in param:
            spec["default"] = param["default"]
        properties[param["name"]] = spec
        if param.get("required"):
            required.append(param["name"])
    return {"type": "object", "properties": properties, "required": required}


def _unique(name: str, taken: set[str]) -> str:
    base, index = name, 2
    while name in taken:
        name = f"{base}_{index}"
        index += 1
    return name


def _realistic(param: dict[str, Any]) -> Any:
    """Valor de ejemplo realista para un parámetro de entrada (nunca el centinela zxq_)."""
    name = (param.get("name") or "").lower()
    label = (param.get("label") or "").lower()
    type_name = param.get("type") or "string"
    example = param.get("example")
    if isinstance(example, str) and example and not example.startswith("zxq"):
        return _typed(example, type_name)
    if param.get("format") == "date":
        from datetime import date, timedelta

        return (date.today() + timedelta(days=2)).isoformat()
    if param.get("enum"):
        values = _coerce_enum(param["enum"], type_name)
        if values:
            if any(word in name or word in label for word in ("time", "hora")) and "21:00" in values:
                return "21:00"
            return values[0]
    if type_name in ("integer", "number"):
        return _typed(param.get("min") or 2, type_name)
    if any(word in name or word in label for word in ("email", "correo")):
        return "ada@example.com"
    if any(word in name or word in label for word in ("phone", "tel", "movil", "móvil")):
        return "600123456"
    if any(word in name or word in label for word in ("name", "nombre")):
        return "Ada Lovelace"
    if any(word in name or word in label for word in ("code", "codigo", "código")):
        return "R-4F2A19"
    if any(word in name or word in label for word in ("q", "query", "search", "buscar", "busqueda", "búsqueda")):
        return "asimov"
    return "prueba"


# ------------------------------------------------------------------ modo determinista
def deterministic(cand: dict[str, Any], prefix: str, names: dict[str, str]) -> dict[str, Any] | None:
    browser = cand.get("browser")
    path_words = [
        w for w in re.split(r"[/_\-]+", re.sub(r"\{[^}]*\}", "", cand.get("path") or ""))
        if w and w.lower() not in ("api", "v1", "v2")
    ]
    name = "_".join([prefix, (cand.get("method") or "get").lower(), *path_words])
    name = slugify(name)

    params = []
    for param in cand.get("params") or []:
        source = param.get("source")
        entry: dict[str, Any] = {
            "name": param["name"],
            "type": param.get("type") or "string",
            "description": f"Valor de {param.get('label') or param['name']}",
            "required": not (param.get("location") == "query" and (cand.get("variants") or 1) > 1),
        }
        if param.get("format"):
            entry["format"] = param["format"]
        if param.get("enum"):
            entry["enum"] = _coerce_enum(param["enum"], entry["type"])
        if source == "response":
            target = names.get(param.get("from_candidate") or "")
            if target:
                entry["depends_on"] = {
                    "tool": target,
                    "path": param.get("path") or param["name"],
                }
        else:
            entry["example"] = _realistic(param)
        params.append(entry)

    # Siempre http primero; el validador cambia a navegador si hace falta (7.6).
    if cand.get("url"):
        impl: dict[str, Any] = {
            "kind": "http",
            "method": (cand.get("method") or "GET").upper(),
            "url": cand.get("url"),
        }
        if cand.get("body") is not None:
            impl["body_type"] = cand.get("body_type") or "json"
            impl["body"] = cand.get("body")
        recipe_params = {p["name"] for p in (browser or {}).get("params") or []}
        if browser and browser.get("steps") and recipe_params == {p["name"] for p in params}:
            impl["alt"] = {
                "kind": "browser",
                "start_url": browser.get("start_url"),
                "steps": browser.get("steps"),
                "extract": browser.get("extract") or "body",
            }
    else:
        impl = {
            "kind": "browser",
            "start_url": (browser or {}).get("start_url"),
            "steps": (browser or {}).get("steps"),
            "extract": (browser or {}).get("extract") or "body",
        }
        extra = {p["name"] for p in (browser or {}).get("params") or []} - {p["name"] for p in params}
        for param in (browser or {}).get("params") or []:
            if param["name"] in extra:
                params.append({
                    "name": param["name"],
                    "type": param.get("type") or "string",
                    "description": f"Valor de {param['name']}",
                    "required": True,
                })

    tool: dict[str, Any] = {
        "name": name,
        "description": (
            f"{cand.get('method')} {cand.get('path')} en {cand.get('origin')}. "
            f"Descubierta al hacer: {cand.get('trigger')}. "
            f"Respuesta de ejemplo: {str(cand.get('response_preview') or '')[:180]}"
        ),
        "input_schema": _input_schema(params),
        "impl": impl,
        "_params": params,
    }
    examples = {p["name"]: p["example"] for p in params if "example" in p}
    if examples:
        tool["examples"] = examples
    dependencies = [
        {"param": p["name"], "tool": p["depends_on"]["tool"], "path": p["depends_on"]["path"]}
        for p in params if p.get("depends_on")
    ]
    if dependencies:
        tool["depends_on"] = dependencies
    return tool


# ---------------------------------------------------------------------- montaje (LLM)
def assemble(
    payload_tools: list[dict[str, Any]],
    trace: dict[str, Any],
    prefix: str,
    events: Events,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    by_id = {c["id"]: c for c in trace.get("candidates") or []}
    discarded: list[dict[str, Any]] = []
    built: list[dict[str, Any]] = []
    taken: set[str] = set()
    names_by_candidate: dict[str, str] = {}

    for item in payload_tools:
        cand = by_id.get(item.get("candidate_id"))
        if cand is None:
            discarded.append({"candidate_id": item.get("candidate_id"), "reason": "candidato desconocido"})
            continue

        name = slugify(item.get("name") or "")
        if not name:
            discarded.append({"candidate_id": cand["id"], "reason": "sin nombre"})
            continue
        if prefix and not name.startswith(prefix):
            name = slugify(f"{prefix}_{name}")
        name = _unique(name, taken)

        params: list[dict[str, Any]] = []
        for param in item.get("params") or []:
            type_name = param.get("type") or "string"
            entry: dict[str, Any] = {
                "name": param["name"],
                "type": type_name,
                "description": param.get("description") or "",
                "required": bool(param.get("required")),
            }
            # format/enum del análisis mandan sobre el LLM
            analysis = next((p for p in cand.get("params") or [] if p["name"] == param["name"]), None)
            if analysis:
                if analysis.get("format"):
                    entry["format"] = analysis["format"]
                if analysis.get("enum"):
                    entry["enum"] = _coerce_enum(analysis["enum"], type_name)
            if param.get("enum") and "enum" not in entry:
                entry["enum"] = _coerce_enum(param["enum"], type_name)
            example = (param.get("example") or "").strip()
            if example and not example.startswith("zxq"):
                entry["example"] = _typed(example, type_name)
            if param.get("depends_on_tool"):
                entry["depends_on"] = {
                    "tool": param["depends_on_tool"],
                    "path": param.get("depends_on_field") or param["name"],
                }
            params.append(entry)

        if item.get("kind") == "browser":
            recipe = cand.get("browser")
            if not recipe or not recipe.get("steps"):
                discarded.append({"candidate_id": cand["id"], "reason": "sin receta de navegador"})
                continue
            impl = {
                "kind": "browser",
                "start_url": recipe.get("start_url"),
                "steps": recipe.get("steps"),
                "extract": recipe.get("extract") or "body",
            }
            recipe_params = {p["name"]: p for p in recipe.get("params") or []}
            upload_params = set()
            for step in recipe.get("steps") or []:
                if step.get("action") == "upload":
                    match = re.search(r"\{(\w+)\}", str(step.get("value") or ""))
                    if match:
                        upload_params.add(match.group(1))
            declared = {p["name"] for p in params}
            for recipe_param in recipe.get("params") or []:
                if recipe_param["name"] not in declared:
                    params.append({
                        "name": recipe_param["name"],
                        "type": recipe_param.get("type") or "string",
                        "description": "",
                        "required": True,
                    })
                    if recipe_param.get("enum"):
                        params[-1]["enum"] = _coerce_enum(recipe_param["enum"], params[-1]["type"])
            # Los ejemplos de la receta son la verdad para selects y archivos:
            # el LLM no ve la ruta del PDF ni el valor real del desplegable.
            for entry in params:
                recipe_param = recipe_params.get(entry["name"])
                if not recipe_param:
                    continue
                if entry["name"] in upload_params and recipe_param.get("example"):
                    entry["example"] = recipe_param["example"]
                elif "example" not in entry and recipe_param.get("example") not in (None, ""):
                    entry["example"] = _typed(recipe_param["example"], entry["type"])
            impl["params"] = recipe.get("params") or []
        else:
            url = item.get("url") or cand.get("url") or ""
            body_type = item.get("body_type") or cand.get("body_type") or "json"
            body: Any = None
            if item.get("body"):
                body = {}
                for pair in item["body"]:
                    key = pair.get("key") or ""
                    value = _recover_literal_type(key.split(".")[-1], pair.get("value"), cand.get("body"))
                    _set_nested(body, key, value)
            elif cand.get("body") is not None:
                body = cand.get("body")
            impl = {"kind": "http", "method": (item.get("method") or cand.get("method") or "GET").upper(), "url": url}
            if body is not None:
                impl["body_type"] = "json" if body_type in (None, "none") else body_type
                impl["body"] = body
            declared = {p["name"] for p in params}
            undeclared = _template_params({"url": url, "body": body}) - declared
            if undeclared:
                discarded.append({
                    "candidate_id": cand["id"],
                    "reason": f"la plantilla usa parámetros no declarados: {sorted(undeclared)}",
                })
                continue
            recipe = cand.get("browser")
            if recipe and recipe.get("steps"):
                recipe_params = {p["name"] for p in recipe.get("params") or []}
                if recipe_params == declared:
                    impl["alt"] = {
                        "kind": "browser",
                        "start_url": recipe.get("start_url"),
                        "steps": recipe.get("steps"),
                        "extract": recipe.get("extract") or "body",
                    }

        taken.add(name)
        names_by_candidate[cand["id"]] = name
        tool = {
            "name": name,
            "description": item.get("description") or "",
            "input_schema": _input_schema(params),
            "impl": impl,
        }
        examples = {p["name"]: p["example"] for p in params if "example" in p}
        if examples:
            tool["examples"] = examples
        dependencies = [
            {"param": p["name"], "tool": p["depends_on"]["tool"], "path": p["depends_on"]["path"]}
            for p in params if p.get("depends_on")
        ]
        if dependencies:
            tool["depends_on"] = dependencies
        built.append(tool)
        events.emit("tool_proposed", name=name, kind=impl["kind"], description=tool["description"])

    for item in discarded:
        events.emit("candidate_discarded", candidate_id=item["candidate_id"], reason=item["reason"])
    # resuelve depends_on a nombres definitivos (por si el LLM acertó el candidato y no el nombre)
    final_names = {tool["name"] for tool in built}
    for tool in built:
        for dep in tool.get("depends_on") or []:
            if dep["tool"] not in final_names:
                for candidate_id, candidate_name in names_by_candidate.items():
                    if dep["tool"] in (candidate_id, candidate_name):
                        dep["tool"] = candidate_name
    return built, discarded


def manifest_from_tools(tools: list[dict[str, Any]], trace: dict[str, Any], prefix: str) -> dict[str, Any]:
    return {
        "site": trace.get("site"),
        "start_url": trace.get("start_url"),
        "synthesis": "llm",
        "validated_at": "",
        "slug": slugify(trace.get("site") or prefix),
        "display_name": trace.get("title") or trace.get("site") or prefix,
        "version": "0.1.0",
        "category": "",
        "tags": [],
        "license": "MIT",
        "author": "",
        "mode": "read_write",
        "generated_with": "mcportal-core 0.1",
        "tools": tools,
    }


def _strip(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for tool in tools:
        tool.pop("_params", None)
    return tools


# ------------------------------------------------------------------------------ entrada
def synthesize(
    trace: dict[str, Any],
    events: Events | None = None,
    use_llm: bool | None = None,
) -> dict[str, Any]:
    """Devuelve el manifiesto propuesto; emite eventos `tool_proposed`, `synth_done`…"""
    events = events or NullEvents()
    prefix = site_prefix(trace.get("site") or "", trace.get("title") or "")
    want_llm = llm.available() if use_llm is None else use_llm
    if use_llm is None and not llm.available():
        events.emit("warning", text="Sin clave de LLM: sintetizo en modo determinista.")

    if want_llm:
        try:
            payload = llm_payload(trace)
            data = llm.structured(SYSTEM, payload, SCHEMA, effort="medium")
            tools, discarded = assemble(data.get("tools") or [], trace, prefix, events)
            if tools:
                manifest = manifest_from_tools(_strip(tools), trace, prefix)
                events.emit(
                    "synth_done", mode="llm", proposed=len(tools), discarded=len(discarded)
                )
                return manifest
            events.emit("warning", text="El LLM no propuso herramientas utilizables: paso a determinista.")
        except llm.LLMError as exc:
            events.emit("warning", text=f"Sintetizador LLM: {exc}. Sigo en modo determinista.")

    names: dict[str, str] = {}
    tools = []
    taken: set[str] = set()
    for cand in trace.get("candidates") or []:
        tool = deterministic(cand, prefix, names)
        if tool is None:
            continue
        tool["name"] = _unique(tool["name"], taken)
        taken.add(tool["name"])
        names[cand["id"]] = tool["name"]
        tools.append(tool)
        events.emit("tool_proposed", name=tool["name"], kind=tool["impl"]["kind"],
                    description=tool["description"])
    manifest = manifest_from_tools(_strip(tools), trace, prefix)
    manifest["synthesis"] = "heuristic"
    events.emit("synth_done", mode="deterministic", proposed=len(tools), discarded=0)
    return manifest
