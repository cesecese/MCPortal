"""Runtime MCP genérico (sección 7.3).

Un único servidor que lee manifiestos y expone sus herramientas. No genera código: interpreta
el manifiesto con el ejecutor compartido. Usa la API de bajo nivel del SDK de MCP porque los
esquemas vienen de JSON, no de funciones escritas a mano.
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import mcp.server.stdio
import mcp_types as types
from mcp.server.lowlevel import NotificationOptions, Server

from . import executor

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PATHS = [REPO_ROOT / "manifests"]
EXAMPLE = REPO_ROOT / "manifest.example.json"

sessions: set[Any] = set()
PATHS: list[str] | None = None

try:  # la consola de Windows usa cp1252; los avisos llevan acentos
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):  # pragma: no cover
    pass


def _manifest_paths(paths: list[str] | None) -> list[Path]:
    resolved = [Path(p) for p in (paths or [])]
    if not resolved:
        resolved = DEFAULT_PATHS
    return resolved


def _json_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(p for p in path.glob("*.json")))
        elif path.is_file():
            files.append(path)
    return files


def load_tools(paths: list[str] | None = None) -> dict[str, dict[str, Any]]:
    """Lee todos los manifiestos indicados; si no hay ninguno, usa `manifest.example.json`."""
    files = _json_files(_manifest_paths(paths))
    if not files and not paths:
        files = _json_files([EXAMPLE])
    tools: dict[str, dict[str, Any]] = {}
    for file in files:
        try:
            manifest = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            print(f"aviso: no se pudo leer {file}: {exc}", file=sys.stderr)
            continue
        for tool in manifest.get("tools") or []:
            name = tool.get("name")
            if not name:
                continue
            if name in tools:
                print(f"aviso: herramienta duplicada {name} en {file}; se queda la primera", file=sys.stderr)
                continue
            tools[name] = tool
    return tools


def _signature() -> tuple[tuple[str, float], ...]:
    return tuple(sorted((str(p), p.stat().st_mtime) for p in _json_files(_manifest_paths(PATHS)) if p.exists()))


async def list_tools(ctx: Any, params: Any) -> types.ListToolsResult:
    sessions.add(ctx.session)
    return types.ListToolsResult(
        tools=[
            types.Tool(
                name=tool["name"],
                description=tool.get("description", ""),
                input_schema=tool.get("input_schema") or {"type": "object", "properties": {}},
            )
            for tool in load_tools(PATHS).values()
        ]
    )


async def call_tool(ctx: Any, params: types.CallToolRequestParams) -> types.CallToolResult:
    sessions.add(ctx.session)
    tool = load_tools(PATHS).get(params.name)
    if tool is None:
        return types.CallToolResult(
            content=[types.TextContent(text=f"Herramienta desconocida: {params.name}")],
            is_error=True,
        )
    try:
        result = await executor.run(tool, params.arguments or {})
    except Exception as exc:  # el consumidor tiene que poder corregirse
        return types.CallToolResult(
            content=[types.TextContent(text=f"Error ejecutando {params.name}: {exc}")],
            is_error=True,
        )
    return types.CallToolResult(content=[types.TextContent(text=result.text)], is_error=not result.ok)


server = Server(
    "mcportal",
    version="0.1.0",
    instructions=(
        "Herramientas generadas automáticamente explorando webs sin API. Si una herramienta pide un id "
        "(cart_id, product_id…), obtenlo antes con la herramienta que indica su descripción."
    ),
    on_list_tools=list_tools,
    on_call_tool=call_tool,
)


async def watch_manifests(interval: float = 2.0) -> None:
    """Anuncia `tools/list_changed` cuando cambian los ficheros de manifiesto."""
    previous = _signature()
    while True:
        await asyncio.sleep(interval)
        current = _signature()
        if current != previous:
            previous = current
            for session in list(sessions):
                try:
                    await session.send_tool_list_changed()
                except Exception:  # sesión cerrada
                    sessions.discard(session)


async def main(paths: list[str] | None = None) -> None:
    global PATHS
    PATHS = paths or None
    watcher = asyncio.create_task(watch_manifests())
    try:
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(
                read_stream,
                write_stream,
                server.create_initialization_options(NotificationOptions(tools_changed=True)),
            )
    finally:
        watcher.cancel()
        await executor.close()


def cli() -> None:
    try:
        asyncio.run(main(sys.argv[1:]))
    except KeyboardInterrupt:  # pragma: no cover
        pass


if __name__ == "__main__":  # pragma: no cover
    cli()
