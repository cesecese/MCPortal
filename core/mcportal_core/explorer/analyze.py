"""Análisis determinista de la traza (sin LLM).

- Valores rellenados por el agente (centinelas zxq_… o campos con el mismo name) → parámetros de entrada.
- Valores que aparecen en una respuesta JSON anterior (cart_id, product_id…) → parámetros con dependencia.
- Campos tipo csrf_token con valor largo y constante → la herramienta necesita navegador.

El resultado son endpoints candidatos con plantillas ya parametrizadas.
"""

from __future__ import annotations

import json
import re
from urllib.parse import parse_qsl, quote, urlsplit

from mcportal_core.explorer.browser import describe_action
from mcportal_core.explorer.text import html_to_text

SENTINEL = "zxq"
ID_KEYS = {"id", "key", "uuid", "pk", "slug"}
TOKEN_KEY = re.compile(r"csrf|xsrf|authenticity|(^|_)token$", re.I)


# ---------- utilidades ----------

def flatten(obj, prefix=""):
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield from flatten(value, f"{prefix}.{key}" if prefix else str(key))
    elif isinstance(obj, list):
        for index, value in enumerate(obj[:50]):
            yield from flatten(value, f"{prefix}[{index}]")
    else:
        yield prefix, obj


def leaf_key(path: str) -> str:
    return re.sub(r"\[\d+\]", "", path).split(".")[-1]


def snake(value: str) -> str:
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value or "")
    value = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").lower()
    return value if value and not value[0].isdigit() else f"p_{value}"


def singular(value: str) -> str:
    return value[:-1] if len(value) > 3 and value.endswith("s") and not value.endswith("ss") else value


def json_type(value) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    return "string"


def shrink(obj, depth: int = 0):
    """Versión reducida de un JSON para enseñarlo al LLM."""
    if isinstance(obj, list):
        items = [shrink(item, depth + 1) for item in obj[:2]]
        return items + ([f"… ({len(obj)} elementos)"] if len(obj) > 2 else [])
    if isinstance(obj, dict):
        return ({key: shrink(value, depth + 1) for key, value in list(obj.items())[:12]}
                if depth < 4 else "{…}")
    if isinstance(obj, str) and len(obj) > 80:
        return obj[:80] + "…"
    return obj


def preview(req: dict, limit: int = 600) -> str:
    if req.get("json") is not None:
        return json.dumps(shrink(req["json"]), ensure_ascii=False)[:limit]
    if "html" in req.get("content_type", ""):
        return html_to_text(req.get("body", ""))[:limit]
    return (req.get("body") or "")[:limit]


def set_path(obj, path: str, value):
    """Sustituye en un JSON (copia) la hoja indicada por una ruta tipo a.b[0].c."""
    tokens = re.findall(r"[^.\[\]]+|\[\d+\]", path)

    def rec(current, remaining):
        if not remaining:
            return value
        token, rest = remaining[0], remaining[1:]
        if token.startswith("["):
            index = int(token[1:-1])
            return [rec(item, rest) if position == index else item
                    for position, item in enumerate(current)]
        return {key: (rec(item, rest) if key == token else item) for key, item in current.items()}

    return rec(obj, tokens)


# ---------- emparejamientos ----------

def fills_of(steps: list[dict]) -> list[dict]:
    out = []
    for step in steps:
        action = step["action"]
        if action["type"] in ("fill", "select", "upload") and not step.get("error"):
            el = step["element"] or {}
            out.append({
                "step": step["i"],
                "value": str(action.get("value", action.get("option", ""))),
                "name": el.get("name"),
                "label": el.get("label"),
                "type": el.get("type"),
                "selector": el.get("selector"),
                "form": el.get("form"),
                "page": step["url_before"],
                "options": el.get("options"),
            })
    return out


def match_fill(value, key, fills: list[dict]):
    sval = str(value)
    if not sval:
        return None
    for fill in reversed(fills):
        fval = fill["value"]
        if not fval:
            continue
        if sval == fval and (key == fill["name"] or SENTINEL in fval or len(fval) >= 4):
            return fill
        if SENTINEL in fval and fval in sval:
            return fill
    return None


def endpoint_key(url: str) -> str:
    return urlsplit(url).path


def match_response(value, earlier: list[dict], target_url: str = ""):
    sval = str(value)
    if len(sval) < 4 or sval.lower() in ("true", "false", "null", "none") or re.fullmatch(r"\d{1,3}", sval):
        return None
    for request in reversed(earlier):  # la más reciente primero; nunca el mismo endpoint
        if request.get("json") is None or endpoint_key(request["url"]) == endpoint_key(target_url):
            continue
        for path, leaf in flatten(request["json"]):
            if leaf is not None and not isinstance(leaf, bool) and str(leaf) == sval:
                return request, path
    return None


def param_type(fill: dict | None, raw) -> dict:
    if fill and fill.get("type") in ("number", "range"):
        return {"type": "integer" if re.fullmatch(r"-?\d+", fill["value"]) else "number"}
    if fill and fill.get("type") == "checkbox":
        return {"type": "boolean"}
    schema = {"type": json_type(raw)}
    if fill and fill.get("type") == "date":
        schema["format"] = "date"
    if fill and fill.get("options"):
        schema["enum"] = [option["value"] for option in fill["options"] if option["value"]]
    return schema


# ---------- candidatos ----------

def is_candidate(req: dict, step: dict | None, has_input: bool, has_params: bool) -> bool:
    if req["kind"] in ("xhr", "fetch"):
        # un fetch de HTML sin parámetros (precarga, service worker) no es una acción
        return has_params or req["method"] != "GET" or "html" not in req.get("content_type", "")
    if req["method"] != "GET":
        return True  # envío de formulario POST
    # GET de documento: solo si es el envío de un formulario con valores introducidos por el agente
    if not step or not has_input:
        return False
    action, el = step["action"], step.get("element") or {}
    return (action["type"] == "fill" and action.get("submit")) or (action["type"] == "click" and el.get("form"))


def analyze_request(req: dict, earlier: list[dict], fills: list[dict], step: dict | None) -> dict | None:
    url = urlsplit(req["url"])
    fills = [fill for fill in fills if fill["step"] <= req["step"]]
    params, literals, deps = [], [], []
    used = set()

    def classify(location, key, value, seg_index=None, segments=None):
        fill = match_fill(value, key if location != "path" else None, fills)
        if fill:
            name = snake(leaf_key(key)) if location != "path" else snake(
                fill["name"] or fill["label"] or "value")
            source = {"source": "input", "label": fill["label"], "fill": fill}
        elif match := match_response(value, earlier, req["url"]):
            source_request, path = match
            origin_key = leaf_key(path)
            if location != "path":
                name = snake(leaf_key(key))
            elif origin_key.lower() in ID_KEYS and seg_index:
                name = singular(snake(segments[seg_index - 1])) + "_id"
            else:
                name = snake(origin_key)
            source = {"source": "response", "from_request": source_request["id"], "path": path}
            deps.append({"from_request": source_request["id"], "path": path, "to_request": req["id"],
                         "location": location, "key": key, "value": value})
        else:
            literals.append({"location": location, "key": key, "value": value})
            return None
        base, number = name, 2
        while name in used:
            name, number = f"{base}_{number}", number + 1
        used.add(name)
        fill = source.pop("fill", None)
        params.append({"name": name, **param_type(fill, value), "example": value, "location": location,
                       "key": key, **source, "_fill": fill})
        return "{" + name + "}"

    segments = url.path.split("/")
    path_t = "/".join(
        (classify("path", None, segment, index, segments) or segment) if segment else segment
        for index, segment in enumerate(segments))
    query_t = []
    for key, value in parse_qsl(url.query, keep_blank_values=True):
        query_t.append((key, classify("query", key, value) or value))

    body_t, body_type = None, None
    post_data = req.get("post_data")
    if post_data:
        if "json" in req.get("request_content_type", "") or post_data.lstrip().startswith(("{", "[")):
            try:
                body = json.loads(post_data)
                body_type, body_t = "json", body
                for path, leaf in list(flatten(body)):
                    placeholder = classify("body", path, leaf)
                    if placeholder:
                        body_t = set_path(body_t, path, placeholder)
            except ValueError:
                pass
        if body_type is None and "=" in post_data:
            body_type, body_t = "form", {}
            for key, value in parse_qsl(post_data, keep_blank_values=True):
                body_t[key] = classify("body", key, value) or value

    has_input = any(param["source"] == "input" for param in params)
    if not is_candidate(req, step, has_input, bool(params)):
        return None
    forms = (step or {}).get("forms", [])
    hidden = {hidden_input["value"] for form in forms for hidden_input in form.get("hidden", [])}
    hidden_names = {hidden_input["name"] for form in forms for hidden_input in form.get("hidden", [])}
    csrf = [literal["key"] for literal in literals
            if literal["location"] in ("body", "query") and len(str(literal["value"])) >= 16
            and (TOKEN_KEY.search(str(literal["key"])) or str(literal["value"]) in hidden)]
    # Un POST multipart no se parsea como formulario; el token viaja como campo oculto.
    csrf += [name for name in hidden_names if TOKEN_KEY.search(str(name))]
    return {
        "request_ids": [req["id"]], "method": req["method"],
        "origin": f"{url.scheme}://{url.netloc}", "path": path_t, "query": query_t,
        "body_type": body_type, "body": body_t, "params": params, "literals": literals,
        "deps": deps, "status": req["status"],
        "content_type": req.get("content_type", "").split(";")[0],
        "response_preview": preview(req), "step": req["step"],
        "csrf_fields": sorted(set(csrf)),
    }


def browser_recipe(candidate: dict, steps: list[dict]) -> dict | None:
    """Pasos de Playwright que reproducen la acción que disparó la petición."""
    trigger = next((step for step in steps if step["i"] == candidate["step"]), None)
    if not trigger:
        return None
    action, el = trigger["action"], trigger.get("element") or {}
    if not el.get("selector") or not (
            action["type"] == "click" or (action["type"] == "fill" and action.get("submit"))):
        return None
    block = []  # pasos seguidos en la misma página que terminan en el disparo
    for step in reversed([step for step in steps if step["i"] <= trigger["i"]]):
        if step["url_before"] != trigger["url_before"] or step["action"]["type"] in ("goto", "back"):
            break
        block.insert(0, step)
    by_fill_step = {param["_fill"]["step"]: param for param in candidate["params"] if param.get("_fill")}
    fields = {}  # selector -> (acción, parámetro); el último relleno de cada campo gana
    for step in block:
        step_action, selector_el = step["action"], step.get("element") or {}
        if (step_action["type"] not in ("fill", "select", "upload") or step.get("error")
                or not selector_el.get("selector") or selector_el.get("form") != el.get("form")):
            continue
        value = str(step_action.get("value", step_action.get("option", "")))
        param = by_fill_step.get(step["i"])
        if param is None:
            fill = {"value": value, "type": selector_el.get("type"), "options": selector_el.get("options")}
            param = {"name": snake(selector_el.get("name") or selector_el.get("label") or f"field{step['i']}"),
                     **param_type(fill, value), "example": value, "source": "input",
                     "label": selector_el.get("label")}
        fields[selector_el["selector"]] = (
            step_action["type"], {key: value for key, value in param.items() if key != "_fill"})
    out = [{"action": kind, "selector": selector, "value": "{" + param["name"] + "}"}
           for selector, (kind, param) in fields.items()]
    if action["type"] == "fill":
        out.append({"action": "press", "selector": el["selector"], "value": "Enter"})
    else:
        out.append({"action": "click", "selector": el["selector"]})
    return {"start_url": trigger["url_before"], "steps": out,
            "extract": "main" if trigger.get("has_main") else "body",
            "params": list({param["name"]: param for _, param in fields.values()}.values())}


def build_url(candidate: dict) -> str:
    def encode(value):
        return value if re.fullmatch(r"\{\w+\}", str(value)) else quote(str(value), safe="")

    query = "&".join(f"{quote(key, safe='')}={encode(value)}" for key, value in candidate["query"])
    return candidate["origin"] + candidate["path"] + ("?" + query if query else "")


def merge(group: list[dict]) -> dict:
    """Une variantes del mismo endpoint (p. ej. /api/search?q=… y /api/search?category=…)."""
    base = {**group[0], "query": list(group[0]["query"]), "params": list(group[0]["params"])}
    for other in group[1:]:
        names = {param["name"] for param in base["params"]}
        keys = dict(base["query"])
        for key, value in other["query"]:
            if key not in keys or (not re.fullmatch(r"\{\w+\}", keys[key]) and re.fullmatch(r"\{\w+\}", value)):
                base["query"] = [(existing_key, existing_value) for existing_key, existing_value in base["query"]
                                 if existing_key != key] + [(key, value)]
        base["params"] += [param for param in other["params"] if param["name"] not in names]
        base["request_ids"] = base["request_ids"] + other["request_ids"]
        base["deps"] = base["deps"] + other["deps"]
        recipes = [recipe for recipe in (base.get("browser"), other.get("browser")) if recipe]
        base["browser"] = max(recipes, key=lambda recipe: len(recipe["params"]), default=None)
        base["csrf_fields"] = sorted(set(base["csrf_fields"]) | set(other["csrf_fields"]))
    base["variants"] = len(group)
    return base


def analyze(trace: dict) -> dict:
    steps, requests = trace["steps"], trace["requests"]
    by_step = {step["i"]: step for step in steps}
    fills = fills_of(steps)
    raw = []
    for index, request in enumerate(requests):
        candidate = analyze_request(request, requests[:index], fills, by_step.get(request["step"]))
        if candidate:
            candidate["browser"] = browser_recipe(candidate, steps)
            raw.append(candidate)

    groups: dict[tuple, list] = {}
    for candidate in raw:
        key = (candidate["method"], candidate["origin"] + re.sub(r"\{\w+\}", "{}", candidate["path"]))
        groups.setdefault(key, []).append(candidate)
    candidates = [merge(group) for group in groups.values()]
    owner = {}
    for number, candidate in enumerate(candidates, 1):
        candidate["id"] = f"c{number}"
        for request_id in candidate["request_ids"]:
            owner[request_id] = candidate["id"]

    dependencies = []
    for candidate in candidates:
        trigger = by_step.get(candidate["step"]) or {}
        candidate["trigger"] = (describe_action(trigger["action"], trigger.get("element"))
                                if trigger else "carga inicial")
        candidate["url"] = build_url(candidate)
        for param in candidate["params"]:
            param.pop("_fill", None)
            if param["source"] == "response":
                param["from_candidate"] = owner.get(param["from_request"])
        for dependency in candidate.pop("deps"):
            dependencies.append({**dependency, "from_candidate": owner.get(dependency["from_request"]),
                                 "to_candidate": candidate["id"]})
    return {"candidates": candidates, "dependencies": dependencies}
