"""Ejecutor compartido por el runtime y el validador (sección 7.2).

Interpreta `impl` de una herramienta (http o browser) y devuelve un `Result`. Al ser el único
sitio que ejecuta herramientas, lo que valida el validador es exactamente lo que sirve el runtime.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
from pathlib import Path
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlsplit

import httpx
from bs4 import BeautifulSoup, NavigableString, Tag

MAX_TEXT = 8000
MAX_STRING = 160
TIMEOUT = 20.0
USER_AGENT = "mcportal/0.1 (+https://github.com/cesecese/MCPortal)"

REMOVE_TAGS = ("script", "style", "noscript", "svg", "nav", "header", "footer", "template")
NOISE_WORDS = ("header", "nav", "navbar", "menu", "footer", "breadcrumb", "sidebar", "cookie", "banner")
BLOCK_TAGS = {
    "p", "div", "section", "article", "br", "li", "ul", "ol", "tr", "table", "h1", "h2", "h3",
    "h4", "h5", "h6", "form", "fieldset", "dl", "dt", "dd", "blockquote", "pre",
}
TEMPLATE = re.compile(r"\{([a-z_][a-z0-9_]*)\}", re.IGNORECASE)


@dataclass
class Result:
    ok: bool
    status: int | None
    text: str
    data: Any = None
    url: str | None = None
    blocked: bool = False

    def __str__(self) -> str:  # pragma: no cover - comodidad
        return self.text


# --------------------------------------------------------------------------- argumentos
def prepare_arguments(tool: dict[str, Any], arguments: dict[str, Any] | None) -> dict[str, Any]:
    """Aplica los `default` del esquema y descarta los argumentos nulos."""
    args = {k: v for k, v in (arguments or {}).items() if v is not None}
    schema = tool.get("input_schema") or {}
    for name, spec in (schema.get("properties") or {}).items():
        if name not in args and "default" in spec:
            args[name] = spec["default"]
    return args


def _substitute(text: str, args: dict[str, Any], *, url_encode: bool) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in args:
            return match.group(0)
        value = args[name]
        if isinstance(value, bool):
            rendered = "true" if value else "false"
        else:
            rendered = str(value)
        return quote(rendered, safe="") if url_encode else rendered

    return TEMPLATE.sub(replace, text)


def build_url(template: str, args: dict[str, Any]) -> str:
    """Rellena la plantilla. Un par de query que vale solo `{p}` se omite si `p` no viene."""
    if "?" not in template:
        return _substitute(template, args, url_encode=True)
    base, _, query = template.partition("?")
    pairs: list[str] = []
    for pair in query.split("&"):
        if not pair:
            continue
        key, _, value = pair.partition("=")
        pure = TEMPLATE.fullmatch(value)
        if pure and pure.group(1) not in args:
            continue
        if pure:
            pairs.append(f"{key}={_substitute(value, args, url_encode=True)}")
        elif "=" in pair:
            pairs.append(f"{key}={_substitute(value, args, url_encode=True)}")
        else:
            pairs.append(key)
    url = _substitute(base, args, url_encode=True)
    return f"{url}?{'&'.join(pairs)}" if pairs else url


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


def _fill_value(value: Any, args: dict[str, Any]) -> tuple[bool, Any]:
    """Devuelve (incluir, valor) aplicando las reglas de plantilla del body."""
    if isinstance(value, str):
        pure = TEMPLATE.fullmatch(value)
        if pure:
            name = pure.group(1)
            if name not in args:
                return False, None
            return True, args[name]
        return True, _substitute(value, args, url_encode=False)
    if isinstance(value, dict):
        built: dict[str, Any] = {}
        for key, item in value.items():
            include, filled = _fill_value(item, args)
            if include:
                _set_nested(built, key, filled)
        return True, built
    if isinstance(value, list):
        items = []
        for item in value:
            include, filled = _fill_value(item, args)
            if include:
                items.append(filled)
        return True, items
    return True, value


def build_body(template: Any, args: dict[str, Any]) -> Any:
    include, body = _fill_value(template, args)
    return body if include else None


def _flatten(value: Any, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    if isinstance(value, dict):
        for key, item in value.items():
            flat.update(_flatten(item, f"{prefix}.{key}" if prefix else key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            flat.update(_flatten(item, f"{prefix}[{index}]"))
    elif isinstance(value, bool):
        flat[prefix] = "true" if value else "false"
    else:
        flat[prefix] = "" if value is None else str(value)
    return flat


# ------------------------------------------------------------------------------- texto
def trim_strings(value: Any, limit: int = MAX_STRING) -> Any:
    if isinstance(value, str):
        return value if len(value) <= limit else value[:limit] + "…"
    if isinstance(value, list):
        return [trim_strings(item, limit) for item in value]
    if isinstance(value, dict):
        return {key: trim_strings(item, limit) for key, item in value.items()}
    return value


def _is_noise(tag: Tag) -> bool:
    token = f"{tag.get('class') or ''} {tag.get('id') or ''}".lower()
    return any(word in token for word in NOISE_WORDS)


def html_to_text(html: str) -> str:
    """Convierte HTML en texto legible: quita menús y conserva enlaces y celdas."""
    soup = BeautifulSoup(html, "html.parser")
    root = (
        soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.select_one("#content, #main, #main-content, #page-content")
        or soup.body
        or soup
    )
    for tag in root.find_all(REMOVE_TAGS):
        tag.decompose()
    for tag in root.find_all(True):
        if tag.parent is None:
            continue
        if _is_noise(tag):
            tag.decompose()

    for anchor in root.find_all("a"):
        href = anchor.get("href") or ""
        label = anchor.get_text(" ", strip=True)
        anchor.replace_with(NavigableString(f" [{href}] {label} "))
    for cell in root.find_all(["td", "th"]):
        cell.append(NavigableString(" | "))
    for tag in root.find_all(BLOCK_TAGS):
        tag.insert_before(NavigableString("\n"))
        tag.insert_after(NavigableString("\n"))

    text = root.get_text(" ", strip=False)
    text = re.sub(r"[ \t\r\f\v]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def render_body(response: httpx.Response) -> tuple[str, Any]:
    content_type = (response.headers.get("content-type") or "").lower()
    raw = response.text
    if "json" in content_type:
        try:
            data = response.json()
        except ValueError:
            return raw, None
        return json.dumps(trim_strings(data), ensure_ascii=False, separators=(",", ":")), data
    if "html" in content_type:
        return html_to_text(raw), None
    return raw, None


def finish_text(text: str) -> str:
    if len(text) <= MAX_TEXT:
        return text
    return text[:MAX_TEXT] + f"… (recortado, {len(text)} caracteres en total)"


def _user_agent() -> str:
    contact = os.environ.get("MCPORTAL_CONTACT")
    return USER_AGENT.replace(")", f"; {contact})") if contact else USER_AGENT


# --------------------------------------------------------------------------------- http
async def run_http(tool: dict[str, Any], args: dict[str, Any]) -> Result:
    impl = tool["impl"]
    method = (impl.get("method") or "GET").upper()
    url = build_url(impl.get("url") or "", args)
    headers = {"User-Agent": _user_agent()}
    for key, value in (impl.get("headers") or {}).items():
        headers[key] = _substitute(str(value), args, url_encode=False)
    body = build_body(impl.get("body"), args) if impl.get("body") is not None else None
    body_type = impl.get("body_type") or "json"

    kwargs: dict[str, Any] = {"headers": headers}
    if body is not None and method not in ("GET", "HEAD"):
        if body_type == "form":
            kwargs["data"] = _flatten(body)
        else:
            kwargs["json"] = body

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        response = await client.request(method, url, **kwargs)

    text, data = render_body(response)
    return Result(
        ok=200 <= response.status_code < 300,
        status=response.status_code,
        text=finish_text(f"HTTP {response.status_code}\n{text}"),
        data=data,
        url=str(response.url),
    )


# ------------------------------------------------------------------------------ browser
class BrowserSession:
    """Un único Chromium perezoso por proceso y una pestaña nueva por llamada."""

    _instance: "BrowserSession | None" = None

    def __init__(self) -> None:
        self._playwright: Any = None
        self._browser: Any = None
        self._context: Any = None
        self._lock = asyncio.Lock()

    @classmethod
    def instance(cls) -> "BrowserSession":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def _ensure(self) -> Any:
        async with self._lock:
            if self._browser is None:
                from playwright.async_api import async_playwright

                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(
                    headless=os.environ.get("MCPORTAL_HEADED") != "1"
                )
            if self._context is None:
                self._context = await self._browser.new_context(
                    locale="es-ES", viewport={"width": 1280, "height": 860}
                )
        return self._context

    async def close(self) -> None:
        if self._context is not None:
            await self._context.close()
            self._context = None
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None


def _same_host(url: str, base: str) -> bool:
    try:
        a, b = urlsplit(url), urlsplit(base)
    except ValueError:
        return False
    return bool(a.hostname) and a.hostname == b.hostname


async def run_browser(tool: dict[str, Any], args: dict[str, Any]) -> Result:
    impl = tool["impl"]
    start_url = _substitute(impl.get("start_url") or "", args, url_encode=True)
    context = await BrowserSession.instance()._ensure()
    page = await context.new_page()
    statuses: list[int] = []

    def on_response(response: Any) -> None:
        try:
            if response.request.resource_type in ("document", "xhr", "fetch") and _same_host(
                response.url, start_url
            ):
                statuses.append(response.status)
        except Exception:  # respuesta ya liberada
            pass

    page.on("response", on_response)
    try:
        await page.goto(start_url, timeout=20_000, wait_until="domcontentloaded")
        for step in impl.get("steps") or []:
            action = step.get("action")
            selector = step.get("selector")
            value = _substitute(str(step.get("value") or ""), args, url_encode=False)
            locator = page.locator(selector).first if selector else None
            if action == "fill":
                await locator.fill(value)
            elif action == "select":
                try:
                    await locator.select_option(value=value)
                except Exception:
                    await locator.select_option(label=value)
            elif action == "click":
                await locator.click()
                await page.wait_for_timeout(300)
            elif action == "press":
                await locator.press(value or "Enter")
            elif action == "check":
                await locator.check()
            elif action == "wait":
                await page.wait_for_timeout(int(step.get("value") or 500))
            elif action == "upload":
                path = Path(value)
                if not path.is_absolute():
                    path = (Path(__file__).resolve().parents[3] / path).resolve()
                await locator.set_input_files(str(path))
            else:
                raise ValueError(f"acción de navegador desconocida: {action!r}")
        try:
            await page.wait_for_load_state("networkidle", timeout=8_000)
        except Exception:
            pass
        extract = impl.get("extract") or "body"
        try:
            text = await page.locator(extract).first.inner_text(timeout=5_000)
        except Exception:
            text = await page.locator("body").inner_text(timeout=5_000)
        current = page.url
    finally:
        await page.close()

    last_status = statuses[-1] if statuses else None
    ok = last_status is None or last_status < 400
    return Result(
        ok=ok,
        status=last_status,
        text=finish_text(f"Página: {current}\n{text}"),
        data=None,
        url=current,
    )


# ---------------------------------------------------------------------------- despacho
async def run(tool: dict[str, Any], arguments: dict[str, Any] | None = None) -> Result:
    args = prepare_arguments(tool, arguments)
    kind = (tool.get("impl") or {}).get("kind")
    if kind == "http":
        return await run_http(tool, args)
    if kind == "browser":
        return await run_browser(tool, args)
    raise ValueError(f"tipo de implementación desconocido: {kind!r}")


async def close() -> None:
    await BrowserSession.instance().close()
