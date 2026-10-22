"""Ejecutor compartido por el runtime MCP y el validador (contrato §7.2).

Implementación local mínima para herramientas `http`. Las de tipo `browser`
necesitan Playwright y quedan para la persona 2; este vertical solo usa HTTP.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote, urlsplit, urlunsplit

import httpx

PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
MAX_TEXT = 8000
MAX_STRING = 160


@dataclass
class Result:
    ok: bool
    status: int | None
    text: str
    data: Any = None
    url: str = ""


def _contact() -> str:
    return os.environ.get("MCPORTAL_CONTACT", "hackathon; contact@mcportal.dev")


def _with_defaults(args: dict, schema: dict) -> dict:
    values = {k: v for k, v in args.items() if v is not None}
    for name, prop in (schema.get("properties") or {}).items():
        if name not in values and "default" in prop:
            values[name] = prop["default"]
    return values


def _fill_path(value: str, args: dict) -> str:
    def replace(match: re.Match) -> str:
        key = match.group(1)
        if key not in args:
            raise ValueError(f"Falta el parámetro {key} en la plantilla")
        return quote(str(args[key]), safe="")

    return PLACEHOLDER.sub(replace, value)


def build_url(template: str, args: dict) -> str:
    parts = urlsplit(template)
    query: list[str] = []
    if parts.query:
        for pair in parts.query.split("&"):
            if not pair:
                continue
            key, _, value = pair.partition("=")
            match = re.fullmatch(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", value)
            if match and match.group(1) not in args:
                continue  # parámetro opcional ausente: se quita de la URL
            query.append(f"{quote(key, safe='')}={_fill_path(value, args)}")
    path = _fill_path(parts.path, args)
    return urlunsplit((parts.scheme, parts.netloc, path, "&".join(query), parts.fragment))


def _fill_value(value: Any, args: dict) -> Any:
    if isinstance(value, dict):
        result: dict[str, Any] = {}
        for key, item in value.items():
            filled = _fill_value(item, args)
            if filled is not _MISSING:
                result[key] = filled
        return result
    if isinstance(value, list):
        return [
            filled for item in value
            if (filled := _fill_value(item, args)) is not _MISSING
        ]
    if isinstance(value, str):
        match = re.fullmatch(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", value)
        if match:
            key = match.group(1)
            if key not in args:
                return _MISSING
            return args[key]  # conserva el tipo (entero, booleano…)
        return PLACEHOLDER.sub(lambda m: str(args.get(m.group(1), m.group(0))), value)
    return value


class _Missing:
    pass


_MISSING = _Missing()


def _expand_dots(value: Any) -> Any:
    if not isinstance(value, dict):
        return value
    result: dict[str, Any] = {}
    for key, item in value.items():
        item = _expand_dots(item)
        if "." not in key:
            result[key] = item
            continue
        *parents, leaf = key.split(".")
        cursor = result
        for parent in parents:
            cursor = cursor.setdefault(parent, {})
        cursor[leaf] = item
    return result


def build_body(value: Any, args: dict) -> Any:
    return _expand_dots(_fill_value(value, args))


def trim_strings(value: Any, limit: int = MAX_STRING) -> Any:
    if isinstance(value, str):
        return value if len(value) <= limit else value[:limit] + "…"
    if isinstance(value, list):
        return [trim_strings(item, limit) for item in value]
    if isinstance(value, dict):
        return {key: trim_strings(item, limit) for key, item in value.items()}
    return value


def html_to_text(html: str) -> str:
    try:
        from bs4 import BeautifulSoup
    except ImportError:  # sin bs4, al menos se quitan las etiquetas
        return re.sub(r"<[^>]+>", " ", html)
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup.select("script, style, noscript, svg, nav, header, footer, template"):
        tag.decompose()
    root = soup.select_one("main, [role=main], #content, #main, body") or soup
    return re.sub(r"\n{3,}", "\n\n", root.get_text("\n", strip=True))


class Executor:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=20,
                follow_redirects=True,
                headers={"User-Agent": f"mcportal/0.1 ({_contact()})"},
            )
        return self._client

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def run(self, tool: dict, args: dict) -> Result:
        impl = tool.get("impl") or {}
        if impl.get("kind") != "http":
            raise NotImplementedError(
                "Este runtime local solo ejecuta herramientas http. "
                "Las de navegador las sirve el runtime completo del core."
            )

        schema = tool.get("input_schema") or {}
        values = _with_defaults(args, schema)
        url = build_url(impl["url"], values)
        method = (impl.get("method") or "GET").upper()
        headers = {
            key: PLACEHOLDER.sub(lambda m: str(values.get(m.group(1), m.group(0))), value)
            for key, value in (impl.get("headers") or {}).items()
        }

        kwargs: dict[str, Any] = {"headers": headers}
        if impl.get("body") is not None and method not in ("GET", "HEAD"):
            body = build_body(impl["body"], values)
            if impl.get("body_type") == "form":
                kwargs["data"] = {k: str(v) for k, v in body.items() if not isinstance(v, (dict, list))}
            else:
                kwargs["json"] = body

        response = await self.client().request(method, url, **kwargs)
        status = response.status_code
        content_type = response.headers.get("content-type", "")
        data: Any = None
        if "json" in content_type:
            try:
                data = response.json()
            except ValueError:
                data = None

        if data is not None:
            text = json.dumps(trim_strings(data), ensure_ascii=False, separators=(",", ":"))
        elif "html" in content_type:
            text = html_to_text(response.text)
        else:
            text = response.text

        if len(text) > MAX_TEXT:
            text = text[:MAX_TEXT] + f"… (recortado, {len(text)} caracteres en total)"

        return Result(
            ok=200 <= status < 300,
            status=status,
            text=f"HTTP {status}\n{text}",
            data=data,
            url=str(response.url),
        )


executor = Executor()
