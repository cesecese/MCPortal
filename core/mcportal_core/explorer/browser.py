"""Sesión de exploración: Chromium con Playwright, captura de red, observación compacta
y atribución acción → peticiones.

La sesión no decide nada: ejecuta acciones, espera a que la red se calme y deja en
`steps` / `requests` la traza que analiza `analyze.py`.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from playwright.async_api import async_playwright

OBSERVE_JS = (Path(__file__).parent / "observe.js").read_text(encoding="utf-8")
STATIC_EXT = (".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
              ".woff", ".woff2", ".ttf", ".map")
MAX_BODY = 200_000

# Webs donde el explorador puede enviar cambios (POST…): las propias y demos hechas
# para practicar. En cualquier otra web real va en solo lectura salvo MCPORTAL_ALLOW_WRITES=1.
WRITABLE = ("localhost", "127.0.0.1", "demoblaze.com", "automationintesting.online",
            "practicesoftwaretesting.com", "toscrape.com")
SAFE_METHODS = ("GET", "HEAD", "OPTIONS")


def base_domain(host: str) -> str:
    """openlibrary.org para www.openlibrary.org; localhost:8001 o una IP, tal cual."""
    if ":" in host or host.replace(".", "").isdigit():
        return host
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) > 2 else host


def same_site(url: str, base: str) -> bool:
    host = urlsplit(url).netloc
    return host == base or host.endswith("." + base)


class Session:
    def __init__(self, start_url: str, events, headless: bool = False, read_only: bool | None = None):
        self.start_url = start_url
        self.base = base_domain(urlsplit(start_url).netloc)
        if read_only is None:
            host = self.base.split(":")[0]
            read_only = host not in WRITABLE and os.environ.get("MCPORTAL_ALLOW_WRITES") != "1"
        if os.environ.get("MCPORTAL_FORCE_READ_ONLY") == "1":
            read_only = True
        self.read_only = read_only
        self.blocked: list[dict] = []
        self.events = events
        self.headless = headless
        self.requests: list[dict] = []
        self.steps: list[dict] = []
        self.step = 0
        self.inflight = 0
        self.pending: set[asyncio.Task] = set()
        self.last_obs: dict | None = None
        self.title = ""

    # ---------- ciclo de vida ----------

    async def start(self) -> None:
        self.pw = await async_playwright().start()
        self.browser = await self.pw.chromium.launch(
            headless=self.headless, slow_mo=0 if self.headless else 150)
        context_args = {"locale": "es-ES", "viewport": {"width": 1280, "height": 860}}
        contact = os.environ.get("MCPORTAL_CONTACT", "").strip()
        if contact:  # crates.io y Wikimedia piden un User-Agent identificable
            context_args["user_agent"] = f"mcportal/0.1 (explorer; {contact})"
        self.context = await self.browser.new_context(**context_args)
        self.context.on("request", self._on_request)
        self.context.on("requestfinished", self._on_request_done)
        self.context.on("requestfailed", self._on_request_done)
        self.context.on("response", self._on_response)
        self.events.emit("mode", read_only=self.read_only, site=self.base)
        if self.read_only:
            await self.context.route("**/*", self._guard)
        self.page = await self.context.new_page()
        self.page.on("dialog", lambda dialog: asyncio.ensure_future(dialog.dismiss()))
        self.context.on("page", lambda page: asyncio.ensure_future(page.close()) if page != self.page else None)
        await self.act({"type": "goto", "url": self.start_url, "initial": True})
        self.title = (await self.observe())["title"]

    async def close(self) -> None:
        await self.browser.close()
        await self.pw.stop()

    # ---------- red ----------

    async def _guard(self, route):
        """Solo lectura: ningún envío que modifique datos sale hacia la web, diga lo que diga el agente."""
        req = route.request
        if req.method not in SAFE_METHODS and same_site(req.url, self.base):
            self.blocked.append({"step": self.step, "method": req.method, "url": req.url})
            self.events.emit("blocked", step=self.step, method=req.method, url=req.url)
            await route.abort()
        else:
            await route.continue_()

    def _relevant(self, req) -> bool:
        return (req.resource_type in ("xhr", "fetch", "document")
                and same_site(req.url, self.base)
                and not urlsplit(req.url).path.lower().endswith(STATIC_EXT))

    def _on_request(self, req) -> None:
        self.inflight += 1

    def _on_request_done(self, req) -> None:
        self.inflight = max(0, self.inflight - 1)

    def _on_response(self, resp) -> None:
        if self._relevant(resp.request):
            task = asyncio.ensure_future(self._record(resp, self.step))
            self.pending.add(task)
            task.add_done_callback(self.pending.discard)

    async def _record(self, resp, step: int) -> None:
        req = resp.request
        body, data = "", None
        try:
            if not 300 <= resp.status < 400:
                body = (await resp.text())[:MAX_BODY]
        except Exception:
            pass
        ctype = resp.headers.get("content-type", "")
        if "json" in ctype and body:
            try:
                data = json.loads(body)
            except ValueError:
                pass
        req_ctype = (await req.all_headers()).get("content-type", "")
        # Sin ningún await a partir de aquí: el id debe coincidir con la posición en la lista.
        rec = {
            "id": len(self.requests) + 1, "step": step, "kind": req.resource_type,
            "method": req.method, "url": req.url, "status": resp.status,
            "request_content_type": req_ctype, "post_data": req.post_data,
            "content_type": ctype, "body": body, "json": data,
        }
        self.requests.append(rec)
        self.events.emit("request", id=rec["id"], step=step, method=rec["method"],
                         url=rec["url"], status=rec["status"], kind=rec["kind"])

    async def wait_idle(self, quiet: float = 0.5, timeout: float = 6.0) -> None:
        """networkidle no espera a los fetch que lanza un clic: contamos peticiones en vuelo."""
        await asyncio.sleep(0.25)
        deadline = time.monotonic() + timeout
        calm_since = None
        while time.monotonic() < deadline:
            if self.inflight == 0:
                calm_since = calm_since or time.monotonic()
                if time.monotonic() - calm_since >= quiet:
                    break
            else:
                calm_since = None
            await asyncio.sleep(0.05)
        if self.pending:  # tareas que leen cuerpos de respuestas
            await asyncio.gather(*self.pending, return_exceptions=True)

    # ---------- observación ----------

    async def observe(self) -> dict:
        try:
            obs = await self.page.evaluate(OBSERVE_JS)
        except Exception:  # navegación en curso
            await self.page.wait_for_load_state("domcontentloaded")
            obs = await self.page.evaluate(OBSERVE_JS)
        self.last_obs = obs
        return obs

    def element(self, agent_id) -> dict:
        for el in (self.last_obs or {}).get("elements", []):
            if el["id"] == int(agent_id):
                return el
        return {}

    # ---------- acciones ----------

    async def act(self, action: dict) -> dict:
        """Ejecuta una acción y le asocia las peticiones nuevas capturadas mientras duraba."""
        self.step += 0 if action.get("initial") else 1
        before, blocked_before = len(self.requests), len(self.blocked)
        url_before = self.page.url
        el = self.element(action["id"]) if "id" in action else {}
        error = None
        try:
            await self._do(action)
        except Exception as exc:
            error = str(exc).split("\n")[0][:200]
        await self.wait_idle()
        note = None
        if not same_site(self.page.url, self.base):
            note = f"fuera del dominio ({self.page.url}); vuelvo atrás"
            await self.page.go_back()
            await self.wait_idle()
        if blocked := self.blocked[blocked_before:]:
            note = ((note + "; ") if note else "") + "solo lectura, web real: bloqueado " + ", ".join(
                f"{b['method']} {urlsplit(b['url']).path}" for b in blocked)
        rec = {
            "i": self.step, "action": action, "element": el,
            "url_before": url_before, "url_after": self.page.url,
            "request_ids": [r["id"] for r in self.requests[before:]],
            "error": error, "note": note,
            "has_main": await self.page.locator("main").count() > 0,
            "forms": (self.last_obs or {}).get("forms", []),
        }
        self.steps.append(rec)
        self.events.emit("step", i=rec["i"], action=describe_action(action, el),
                         url=rec["url_after"], requests=rec["request_ids"], error=error)
        return rec

    async def _do(self, action: dict) -> None:
        kind = action["type"]
        if kind == "goto":
            url = urljoin(self.page.url if self.page.url.startswith("http") else self.start_url,
                          action["url"])
            if not same_site(url, self.base):
                raise ValueError(f"{url} está fuera del dominio permitido ({self.base})")
            linked = {e.get("raw_href") for e in (self.last_obs or {}).get("elements", [])}
            if urlsplit(url).query and not action.get("initial") and url not in linked:
                # Una URL con parámetros escrita por el agente no enseña qué input produce cada parámetro.
                raise ValueError("no construyas URLs con parámetros: haz la acción con la interfaz (rellena el "
                                 "campo y envíalo; si el buscador o el formulario está oculto, pulsa el botón que "
                                 "lo abre). goto solo sirve para ir a secciones o seguir enlaces de la página")
            await self.page.goto(url, wait_until="domcontentloaded", timeout=15000)
            return
        if kind == "back":
            await self.page.go_back(wait_until="domcontentloaded")
            return
        loc = self.page.locator(f'[data-agent-id="{action["id"]}"]').first
        if kind == "click":
            await loc.click(timeout=3000)
        elif kind == "fill":
            await loc.fill(str(action["value"]), timeout=5000)
            if action.get("submit"):
                await loc.press("Enter")
        elif kind == "select":
            try:
                await loc.select_option(value=str(action["option"]), timeout=5000)
            except Exception:
                await loc.select_option(label=str(action["option"]), timeout=5000)
        else:
            raise ValueError(f"acción desconocida: {kind}")


def describe_action(action: dict, el: dict | None = None) -> str:
    el = el or {}
    target = f'[{action["id"]}] {el.get("kind", "")} "{el.get("label", "")}"' if "id" in action else ""
    kind = action["type"]
    if kind == "goto":
        return f"goto {action['url']}"
    if kind == "fill":
        return f"fill {target} = {action['value']!r}" + (" + Enter" if action.get("submit") else "")
    if kind == "select":
        return f"select {target} = {action['option']!r}"
    if kind == "click":
        return f"click {target}"
    return kind


def render_observation(obs: dict) -> str:
    """Texto compacto para el LLM (nunca HTML)."""
    u = urlsplit(obs["url"])
    lines = [f"URL: {u.path}{'?' + u.query if u.query else ''}  ·  Título: {obs['title']}",
             f"Texto visible: {obs['text'][:300]}"]
    forms = {f["index"]: f for f in obs.get("forms", [])}
    for el in obs["elements"]:
        desc = f'[{el["id"]}] {el["kind"]}'
        if el["type"] and el["kind"] in ("input", "textarea"):
            desc += f'[{el["type"]}]'
        desc += f' "{el["label"]}"'
        if el.get("name"):
            desc += f' name={el["name"]}'
        if el.get("value"):
            desc += f' valor={el["value"]!r}'
        if el.get("options"):
            desc += " opciones: " + ", ".join(o["label"] or o["value"] for o in el["options"][:8])
        if el.get("href") and el["href"] not in ("#", "/#"):
            desc += f' → {el["href"]}'
        if el.get("form") and el["form"] in forms:
            form = forms[el["form"]]
            desc += f' (form {form["method"]} {form["action"]})'
        if el.get("similar"):
            desc += f' (×{el["similar"] + 1} similares)'
        lines.append(desc)
    return "\n".join(lines)
