"""Políticas de exploración: el agente LLM y una heurística determinista (plan B y pruebas sin clave)."""

from __future__ import annotations

import asyncio
import datetime as dt
import os
import re
from pathlib import Path
from urllib.parse import urlsplit

from mcportal_core.explorer.browser import Session, render_observation, same_site

try:  # capa definitiva (persona 2)
    from mcportal_core.common import llm
except Exception:
    try:  # adaptador temporal mientras no exista common/llm.py
        from mcportal_core.explorer import llm_provisional as llm
    except Exception:
        llm = None

SAMPLE_PDF = "sites/gestoria/samples/balance-ejemplo.pdf"


def sample_pdf() -> str:
    return os.environ.get("MCPORTAL_SAMPLE_PDF", SAMPLE_PDF)


DESTRUCTIVE = re.compile(
    r"borrar|eliminar|delete|remove|logout|log out|cerrar sesi|salir|sign out|iniciar sesi|log ?in"
    r"|sign ?in|registr|sign ?up|idioma|language|cookies|privacidad|privacy|saltar al|skip to|donar|donate"
    r"|\beditar\b|\bedit\b|publicar|publish|subir archivo|upload|comentar|\bcomment", re.I)


def page_pattern(url: str) -> str:
    parsed = urlsplit(url)
    return parsed.netloc + re.sub(r"/[^/]*\d[^/]*(?=/|$)", "/{id}", parsed.path.rstrip("/") or "/")


def endpoint_pattern(req: dict) -> str:
    parsed = urlsplit(req["url"])
    path = re.sub(r"/[^/]*\d[^/]*(?=/|$)", "/{id}", parsed.path)
    keys = ",".join(sorted({key for key in re.findall(r"([^&=]+)=", parsed.query)}))
    return f"{req['method']} {path}" + (f"?{keys}" if keys else "")


def interesting(req: dict) -> bool:
    return req["kind"] in ("xhr", "fetch") or req["method"] != "GET" or "?" in req["url"]


# ---------- heurística ----------

def _value_for(el: dict, today: dt.date) -> str | None:
    kind, value = el.get("type") or "", el.get("value") or ""
    if el["tag"] == "select":
        return value or next((option["value"] for option in el.get("options") or [] if option["value"]), None)
    if kind == "file":
        return sample_pdf()
    if kind in ("checkbox", "radio", "password", "submit", "button", "reset", "image"):
        return None
    if value:
        return value  # valor precargado (p. ej. hora elegida en el paso anterior)
    if kind == "email":
        return "zxq.user@example.com"
    if kind == "tel":
        return "600123456"
    if kind in ("number", "range"):
        return el.get("min") if el.get("min") not in (None, "", "0") else "2"
    if kind == "date":
        return (today + dt.timedelta(days=2)).isoformat()
    if kind == "time":
        return "21:00"
    return "zxq_" + re.sub(r"\W+", "_", (el.get("name") or el.get("label") or "texto").lower())[:20]


async def heuristic(session: Session, max_steps: int, hint: str = "") -> None:
    """Prueba cada botón y formulario distinto una vez y sigue los enlaces internos nuevos."""
    today = dt.date.today()
    tried, visited = set(), {page_pattern(session.start_url)}
    queue: dict[str, str] = {}
    while session.step < max_steps:
        obs = await session.observe()
        page = page_pattern(obs["url"])
        elements = [el for el in obs["elements"] if not DESTRUCTIVE.search(el["label"] or "")]
        for el in elements:  # encolar enlaces internos; preferir los que llevan query (vienen precargados)
            if el["kind"] == "link" and el["href"] not in ("#", None) and el["raw_href"].startswith("http"):
                pattern = page_pattern(el["raw_href"])
                if (pattern not in visited and same_site(el["raw_href"], session.base)):
                    if pattern not in queue or ("?" in el["raw_href"] and "?" not in queue[pattern]):
                        queue[pattern] = el["raw_href"]

        plan = []
        for el in elements:
            key = (page, el["kind"], el["label"])
            if el["form"] or key in tried:
                continue
            js_links = sum(1 for tried_key in tried if tried_key[0] == page and tried_key[1] == "link")
            if el["kind"] in ("button", "role") or (el["kind"] == "link" and el["href"] == "#" and js_links < 2):
                tried.add(key)
                plan = [{"type": "click", "id": el["id"]}]
                break

        if not plan:
            for form in obs["forms"]:
                fields = [el for el in elements if el["form"] == form["index"]]
                key = (page, "form", form["method"], form["action"],
                       tuple(el.get("name") or el["label"] for el in fields))
                if key in tried or not fields:
                    continue
                tried.add(key)
                for el in fields:
                    if el["tag"] in ("input", "textarea", "select") and (value := _value_for(el, today)) is not None:
                        if el.get("type") == "file":
                            plan.append({"type": "upload", "id": el["id"], "value": value})
                        elif el["tag"] == "select":
                            plan.append({"type": "select", "id": el["id"], "option": value})
                        else:
                            plan.append({"type": "fill", "id": el["id"], "value": value})
                submit = next((el for el in fields if el["tag"] == "button" or el.get("type") == "submit"), None)
                if submit:
                    plan.append({"type": "click", "id": submit["id"]})
                elif plan:
                    plan[-1]["submit"] = True
                break

        if not plan:
            if not queue:
                break
            # profundidad: el último enlace visto se sigue desde la página donde está
            pattern, url = queue.popitem()
            visited.add(pattern)
            plan = [{"type": "goto", "url": url}]

        for action in plan:
            if session.step >= max_steps:
                break
            await session.act(action)


# ---------- agente LLM ----------

SYSTEM = """Eres un agente que explora una web para descubrir qué ACCIONES permite (buscar, filtrar, ver detalle, \
crear, añadir, reservar, comprar…), no para leer su contenido. Con lo que descubras se generarán herramientas \
tipadas para que otro agente use la web como si tuviera API.

Cómo explorar:
- Antes de crear un registro, prueba también el listado o buscador y abre una ficha; el alta no suele ser la única capacidad.
- Prueba cada tipo de formulario y de botón UNA vez. No repitas patrones (si hay 20 botones «Añadir al carrito», \
pulsa uno) y no explores contenido (no abras diez fichas de producto).
- Completa los flujos de varios pasos hasta el final (añadir al carrito → ver carrito → finalizar compra; consultar \
disponibilidad → reservar): así se descubren los encadenamientos de identificadores.
- En campos de texto libre usa valores centinela con prefijo zxq_ que describan el campo (zxq_asimov, zxq_nombre, \
zxq@example.com). En números, fechas, horas y desplegables usa valores válidos y realistas.
- Rellena todos los campos de un formulario y después pulsa su botón de envío. Puedes pedir varias acciones en el \
mismo turno (por ejemplo, rellenar tres campos y pulsar enviar); se ejecutan en orden.
- Si una búsqueda con centinela no da resultados, vuelve al listado y sigue con el resto de acciones.
- Quédate en el dominio. No inicies sesión, no crees cuentas, no publiques ni edites contenido, no hagas pagos reales \
y no pulses enlaces de redes sociales, idioma, cookies o textos legales.
- No escribas URLs con parámetros en goto aunque conozcas la web: el sistema solo aprende una acción si la haces \
con la interfaz, porque así sabe qué campo produce cada parámetro. Si un buscador o formulario no está visible, pulsa \
el botón o icono que lo abre.
- Si una página te lleva a una verificación humana o a un captcha, no insistas: es un límite de la web.
- Si un formulario pide un archivo (input de tipo file), usa la herramienta upload con una ruta local. En la demo hay un PDF en sites/gestoria/samples/balance-ejemplo.pdf. No uses fill en un input de archivo.
- Llama a finish cuando hayas probado todas las acciones distintas o cuando tus últimas acciones ya no descubran \
peticiones nuevas.

Tras cada acción verás las peticiones de red que provocó y, al final del turno, la página resultante. Los elementos \
se identifican por su número entre corchetes."""

TOOLS = [
    {"name": "click", "description": "Pulsa el elemento con ese número.",
     "input_schema": {"type": "object", "properties": {"id": {"type": "integer"}}, "required": ["id"]}},
    {"name": "fill", "description": "Escribe un valor en un campo. submit=true pulsa Enter después.",
     "input_schema": {"type": "object", "properties": {"id": {"type": "integer"}, "value": {"type": "string"},
                                                       "submit": {"type": "boolean"}},
                      "required": ["id", "value", "submit"]}},
    {"name": "select", "description": "Elige una opción (valor o texto visible) en un desplegable.",
     "input_schema": {"type": "object", "properties": {"id": {"type": "integer"}, "option": {"type": "string"}},
                      "required": ["id", "option"]}},
    {"name": "upload", "description": "Adjunta un archivo local a un campo de tipo file. La ruta puede ser absoluta o relativa al repo.",
     "input_schema": {"type": "object", "properties": {"id": {"type": "integer"}, "value": {"type": "string"}},
                      "required": ["id", "value"]}},
    {"name": "goto", "description": "Navega a una sección o enlace del mismo dominio (sin construir parámetros).",
     "input_schema": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}},
    {"name": "back", "description": "Vuelve a la página anterior.",
     "input_schema": {"type": "object", "properties": {}, "required": []}},
    {"name": "finish", "description": "Termina la exploración.",
     "input_schema": {"type": "object", "properties": {"summary": {"type": "string",
                                                                   "description": "Acciones descubiertas"}},
                      "required": ["summary"]}},
]
for _tool in TOOLS:
    _tool["strict"] = True
    _tool["input_schema"]["additionalProperties"] = False


def llm_available() -> bool:
    if llm is None:
        return False
    try:
        return bool(getattr(llm, "available", lambda: False)())
    except Exception:
        return False


def describe_requests(session: Session, step: dict, seen: set) -> str:
    lines = []
    for request_id in step["request_ids"]:
        request = session.requests[request_id - 1]
        if not interesting(request):
            continue
        pattern = endpoint_pattern(request)
        is_new = pattern not in seen
        seen.add(pattern)
        parsed = urlsplit(request["url"])
        body = f" body={request['post_data'][:120]}" if request.get("post_data") else ""
        shape = ""
        if isinstance(request.get("json"), dict):
            shape = " json{" + ", ".join(list(request["json"])[:8]) + "}"
        lines.append(f"  {'NUEVO ' if is_new else ''}{request['method']} "
                     f"{parsed.path}{'?' + parsed.query if parsed.query else ''}{body} → "
                     f"{request['status']}{shape}")
    return "\n".join(lines) if lines else "  (ninguna petición relevante)"


async def _prefill_form(session: Session, click_id: int, touched: set[int], max_steps: int) -> None:
    """Antes de enviar un formulario, deja por escrito todos sus campos.

    El LLM a veces acepta valores precargados (fecha, hora, comensales) sin
    tocarlos. Sin un fill/select en la traza, el analizador no puede convertir
    esos valores en parámetros ni reproducirlos en la receta de navegador.
    Se rellenan con su valor actual (o con el defecto de la heurística si están
    vacíos y son obligatorios), sin pisar lo que el agente ya haya escrito.
    """
    el = session.element(click_id)
    form = el.get("form")
    if not form:
        return
    fields = [field for field in (session.last_obs or {}).get("elements", [])
              if field.get("form") == form and field.get("tag") in ("input", "textarea", "select")]
    for field in fields:
        if session.step >= max_steps - 1:  # deja el último paso para el clic
            break
        if field["id"] in touched:
            continue
        kind = field.get("type") or ""
        if kind == "file":
            if field["id"] not in touched and (path := sample_pdf()):
                await session.act({"type": "upload", "id": field["id"], "value": path})
            continue
        if kind in ("hidden", "submit", "button", "reset", "checkbox", "radio", "password"):
            continue
        value = field.get("value")
        if field["tag"] == "select":
            value = value or _value_for(field, dt.date.today())
            if value in (None, ""):
                continue
            await session.act({"type": "select", "id": field["id"], "option": str(value)})
        else:
            if not value:
                if not field.get("required"):
                    continue
                value = _value_for(field, dt.date.today())
            if value in (None, ""):
                continue
            await session.act({"type": "fill", "id": field["id"], "value": str(value)})


async def _intro(session: Session, max_steps: int, hint: str) -> str:
    obs = await session.observe()
    return (f"Web a explorar: {session.start_url}\nFecha de hoy: {dt.date.today().isoformat()}\n"
            + (f"Pista del dominio: {hint}\n" if hint else "")
            + ("MODO SOLO LECTURA: es una web real. Céntrate en buscar, filtrar y consultar; cualquier envío que "
               "modifique datos (editar, publicar, comentar, comprar) se bloqueará.\n" if session.read_only else "")
            + f"Tienes como máximo {max_steps} acciones.\n\nPeticiones de la carga inicial:\n"
            + describe_requests(session, session.steps[0], set()) + "\n\n" + render_observation(obs))


async def llm_agent(session: Session, max_steps: int, hint: str = "", effort: str = "low",
                    stale_limit: int = 6) -> None:
    """Bucle observar → decidir → actuar con `common.llm.agent_turn`.

    Interfaz esperada de la capa de LLM:
      agent_turn(system=..., tools=..., messages=..., effort=...) -> dict
        {"text": str, "thinking": str,
         "tool_calls": [{"id": str, "name": str, "input": dict}],
         "content": <bloques del asistente para devolver al historial>}
    Los mensajes siguen el formato [{"role": "user"|"assistant", "content": ...}] con
    bloques text / tool_use / tool_result.
    """
    if not llm_available() or not hasattr(llm, "agent_turn"):
        raise RuntimeError("la capa de LLM no está disponible")

    seen: set[str] = {endpoint_pattern(request) for request in session.requests if interesting(request)}
    intro = await _intro(session, max_steps, hint)
    messages: list[dict] = [{"role": "user", "content": [{"type": "text", "text": intro}]}]
    stale, nudges = 0, 0
    while session.step < max_steps:
        turn = await llm.agent_turn(system=SYSTEM, tools=TOOLS, messages=messages, effort=effort)
        text, thinking = turn.get("text") or "", turn.get("thinking") or ""
        if thinking:
            session.events.emit("thought", text=thinking.strip()[:400])
        content = turn.get("content")
        if content is None:
            content = ([{"type": "text", "text": text}] if text else [])
        messages.append({"role": "assistant", "content": content})

        calls = turn.get("tool_calls") or []
        if not calls:
            nudges += 1
            if nudges > 2:
                break
            messages.append({"role": "user", "content": [{
                "type": "text", "text": "Responde con una herramienta (o finish si has terminado)."}]})
            continue

        results, finished = [], False
        touched: set[int] = set()
        for call in calls:
            name, arguments = call.get("name", ""), call.get("input") or {}
            if name == "finish" or session.step >= max_steps:
                finished = finished or name == "finish"
                if name == "finish":
                    session.events.emit("finish", summary=arguments.get("summary", ""))
                results.append({"type": "tool_result", "tool_use_id": call.get("id", ""), "content": "Hecho."})
                continue
            if name in ("fill", "select", "upload") and arguments.get("id") is not None:
                touched.add(int(arguments["id"]))
            if name == "click":
                el = session.element(arguments.get("id", 0))
                is_submit = (el.get("form") and (el.get("tag") == "button" or el.get("type") == "submit")
                             and el.get("type") != "button")
                if is_submit:
                    await _prefill_form(session, int(arguments["id"]), touched, max_steps)
            step = await session.act({"type": name, **arguments})
            known = len(seen)
            requests_text = describe_requests(session, step, seen)
            stale = 0 if len(seen) > known else stale + 1
            status = f"Error: {step['error']}" if step["error"] else "OK"
            if step.get("note"):
                status += f" ({step['note']})"
            result = {"type": "tool_result", "tool_use_id": call.get("id", ""),
                      "content": f"{status}. Peticiones:\n{requests_text}"}
            if step["error"]:
                result["is_error"] = True
            results.append(result)

        if finished:
            messages.append({"role": "user", "content": results})
            break
        obs = await session.observe()
        tail = (f"\n\nEndpoints descubiertos ({len(seen)}): " + "; ".join(sorted(seen))
                + f"\nAcciones usadas: {session.step}/{max_steps}\n\n" + render_observation(obs))
        if stale >= stale_limit:
            session.events.emit("finish", summary=f"{stale_limit} acciones seguidas sin endpoints nuevos")
            break
        results[-1]["content"] += tail
        messages.append({"role": "user", "content": results})


async def llm_conversation_agent(session: Session, max_steps: int, hint: str = "", effort: str = "low",
                                 stale_limit: int = 6) -> None:
    """Bucle del agente sobre `common.llm.Conversation` (la capa síncrona de P2).

    La conversación y el historial nativo los mantiene P2; aquí solo se ejecutan
    las herramientas de Playwright y se le devuelven los resultados. Las llamadas
    al proveedor van en un hilo para no bloquear el bucle de Playwright.
    """
    conversation = llm.Conversation(system=SYSTEM, tools=TOOLS, effort=effort)
    seen: set[str] = {endpoint_pattern(request) for request in session.requests if interesting(request)}
    intro = await _intro(session, max_steps, hint)
    turn = await asyncio.to_thread(conversation.send, intro)
    stale, nudges = 0, 0
    while session.step < max_steps:
        if turn.reasoning:
            session.events.emit("thought", text=turn.reasoning.strip()[:400])
        calls = [{"id": call.id, "name": call.name, "input": call.arguments} for call in turn.calls]
        if not calls:
            nudges += 1
            if nudges > 2:
                break
            turn = await asyncio.to_thread(
                conversation.send, "Responde con una herramienta (o finish si has terminado).")
            continue

        results: list[tuple[str, str]] = []
        finished = False
        touched: set[int] = set()
        for call in calls:
            name, arguments = call["name"], call["input"]
            if name == "finish" or session.step >= max_steps:
                finished = finished or name == "finish"
                if name == "finish":
                    session.events.emit("finish", summary=arguments.get("summary", ""))
                results.append((call["id"], "Hecho."))
                continue
            if name in ("fill", "select", "upload") and arguments.get("id") is not None:
                touched.add(int(arguments["id"]))
            if name == "click":
                el = session.element(arguments.get("id", 0))
                is_submit = (el.get("form") and (el.get("tag") == "button" or el.get("type") == "submit")
                             and el.get("type") != "button")
                if is_submit:
                    await _prefill_form(session, int(arguments["id"]), touched, max_steps)
            step = await session.act({"type": name, **arguments})
            known = len(seen)
            requests_text = describe_requests(session, step, seen)
            stale = 0 if len(seen) > known else stale + 1
            status = f"Error: {step['error']}" if step["error"] else "OK"
            if step.get("note"):
                status += f" ({step['note']})"
            results.append((call["id"], f"{status}. Peticiones:\n{requests_text}"))

        if finished:
            conversation.add_tool_results(results)
            break
        if session.step >= max_steps:
            conversation.add_tool_results(results)
            break
        obs = await session.observe()
        tail = (f"\n\nEndpoints descubiertos ({len(seen)}): " + "; ".join(sorted(seen))
                + f"\nAcciones usadas: {session.step}/{max_steps}\n\n" + render_observation(obs))
        if results:
            call_id, content = results[-1]
            results[-1] = (call_id, content + tail)
        conversation.add_tool_results(results)
        if stale >= stale_limit:
            session.events.emit("finish", summary=f"{stale_limit} acciones seguidas sin endpoints nuevos")
            break
        turn = await asyncio.to_thread(conversation.send, "Continúa con la siguiente acción.")


POLICIES = {"heuristic": heuristic}
if llm_available():
    POLICIES["llm"] = llm_conversation_agent if hasattr(llm, "Conversation") else llm_agent
