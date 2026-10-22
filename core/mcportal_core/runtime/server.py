"""Servidor MCP genérico sobre manifiestos §6.1.

    .venv/bin/python -m mcportal_core.runtime.server manifests/

Relee los manifiestos en cada `list_tools`/`call_tool` y avisa de los cambios a
las sesiones conectadas. Los logs van a stderr para no romper stdio.
"""

from __future__ import annotations

import asyncio
import json
import sys
import time
from pathlib import Path

import mcp.server.stdio
import mcp_types as types
from mcp.server.lowlevel import NotificationOptions, Server

from mcportal_core.runtime.executor import executor

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_PATHS = [ROOT / "manifests"]
sessions: set = set()


def log(message: str) -> None:
    print(f"[mcportal] {message}", file=sys.stderr, flush=True)


def manifest_files(paths: list[Path]) -> list[Path]:
    files: list[Path] = []
    for path in paths:
        if path.is_dir():
            files.extend(sorted(path.glob("*.json")))
        elif path.is_file():
            files.append(path)
    if not files:
        example = ROOT / "manifest.example.json"
        if example.exists():
            files.append(example)
    return files


def load_tools(paths: list[Path]) -> dict[str, dict]:
    tools: dict[str, dict] = {}
    for file in manifest_files(paths):
        try:
            manifest = json.loads(file.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            log(f"no se pudo leer {file}: {error}")
            continue
        for tool in manifest.get("tools") or []:
            name = tool.get("name")
            if not name:
                continue
            if name in tools:
                log(f"herramienta duplicada {name} en {file.name}; se queda la primera")
                continue
            tools[name] = tool
    return tools


def signature(paths: list[Path]) -> tuple:
    return tuple(
        (str(file), file.stat().st_mtime_ns, file.stat().st_size)
        for file in manifest_files(paths)
        if file.exists()
    )


async def watch_manifests(paths: list[Path], interval: float = 2.0) -> None:
    previous = signature(paths)
    while True:
        await asyncio.sleep(interval)
        current = signature(paths)
        if current == previous:
            continue
        previous = current
        log("manifiestos cambiados; aviso a las sesiones")
        for session in list(sessions):
            try:
                await session.send_tool_list_changed()
            except Exception:
                sessions.discard(session)


async def list_tools(ctx, params) -> types.ListToolsResult:
    del params
    sessions.add(ctx.session)
    return types.ListToolsResult(tools=[
        types.Tool(
            name=tool["name"],
            description=tool.get("description", ""),
            input_schema=tool.get("input_schema") or {"type": "object", "properties": {}},
        )
        for tool in load_tools(PATHS).values()
    ])


async def call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    sessions.add(ctx.session)
    tool = load_tools(PATHS).get(params.name)
    if tool is None:
        return types.CallToolResult(
            content=[types.TextContent(text=f"Herramienta desconocida: {params.name}")],
            is_error=True,
        )
    try:
        result = await executor.run(tool, params.arguments or {})
    except Exception as error:  # el consumidor recibe el error y puede corregirse
        return types.CallToolResult(
            content=[types.TextContent(text=f"Error ejecutando {params.name}: {error}")],
            is_error=True,
        )
    return types.CallToolResult(content=[types.TextContent(text=result.text)], is_error=not result.ok)


server = Server(
    "mcportal",
    version="0.1.0",
    instructions=(
        "Herramientas generadas automáticamente explorando webs sin API. "
        "Si una herramienta pide un id (booking_id, order_id…), obtenlo antes con "
        "la herramienta que indica su descripción."
    ),
    on_list_tools=list_tools,
    on_call_tool=call_tool,
)

PATHS = DEFAULT_PATHS


async def main(paths: list[Path]) -> None:
    global PATHS
    PATHS = paths
    log(f"manifiestos: {', '.join(str(p) for p in paths)}")
    log(f"herramientas: {len(load_tools(paths))}")
    watcher = asyncio.create_task(watch_manifests(paths))
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


if __name__ == "__main__":
    args = [Path(arg) for arg in sys.argv[1:]] or DEFAULT_PATHS
    try:
        asyncio.run(main(args))
    except KeyboardInterrupt:
        pass
