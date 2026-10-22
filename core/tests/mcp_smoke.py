"""Prueba de humo del runtime MCP con `manifest.example.json` (sección 7.11).

Arranca el servidor por stdio con un cliente MCP real y recorre los flujos encadenados:
búsqueda → carrito → checkout y disponibilidad → reserva por navegador.

Requiere las webs de demo (tienda 8001, restaurante 8002) y, para la reserva, Chromium:
    py -m playwright install chromium

Uso:
    py core/tests/mcp_smoke.py            # sin tocar webs de terceros
    py core/tests/mcp_smoke.py --real     # incluye la consulta de solo lectura a crates.io
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = ROOT / "manifest.example.json"


class Checker:
    def __init__(self) -> None:
        self.failures = 0

    def check(self, condition: bool, message: str) -> None:
        print(f"  {'OK  ' if condition else 'FALLA'} {message}")
        if not condition:
            self.failures += 1


def payload(text: str) -> str:
    return text.split("\n", 1)[1] if text.startswith("HTTP ") and "\n" in text else text


def as_json(text: str) -> dict:
    try:
        return json.loads(payload(text))
    except json.JSONDecodeError:
        return {}


async def call(session: ClientSession, name: str, args: dict) -> tuple[bool, str]:
    result = await session.call_tool(name, arguments=args)
    text = "\n".join(getattr(block, "text", "") for block in result.content)
    return not result.is_error, text


async def main(include_real: bool) -> int:
    try:  # la consola de Windows usa cp1252 y rompe con flechas o acentos
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    check = Checker()
    env = dict(os.environ)
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcportal_core.runtime.server", str(MANIFEST)],
        env=env,
    )
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = {tool.name for tool in tools.tools}
            print(f"\nHerramientas expuestas: {len(names)}")
            check.check(len(names) == 11, "el servidor expone las 11 herramientas del manifiesto de ejemplo")

            print("\nTienda: búsqueda → carrito → checkout")
            ok, text = await call(session, "libreria_zeta_search_products", {"query": "asimov"})
            check.check(ok, "search_products responde")
            data = as_json(text)
            results = data.get("results") or []
            check.check(bool(results), "la búsqueda devuelve resultados")
            product_id = results[0]["id"] if results else "bk-1001"

            ok, text = await call(session, "libreria_zeta_create_cart", {})
            cart = as_json(text)
            cart_id = cart.get("cart_id", "")
            check.check(ok and cart_id.startswith("cart_"), f"create_cart devuelve cart_id ({cart_id or 'sin id'})")

            ok, text = await call(session, "libreria_zeta_add_to_cart",
                                  {"cart_id": cart_id, "product_id": product_id, "qty": 2})
            check.check(ok, "add_to_cart añade el artículo")

            ok, text = await call(session, "libreria_zeta_get_cart", {"cart_id": cart_id})
            check.check(ok and as_json(text).get("items"), "get_cart devuelve el carrito con artículos")

            ok, text = await call(session, "libreria_zeta_checkout",
                                  {"cart_id": cart_id, "name": "Ada Lovelace", "email": "ada@example.com"})
            check.check(ok and bool(as_json(text).get("order_id")), "checkout devuelve order_id")

            print("\nRestaurante: disponibilidad → reserva (navegador)")
            target = (date.today() + timedelta(days=2)).isoformat()
            ok, text = await call(session, "casa_zeta_check_availability", {"date": target, "people": 4})
            hours = re.findall(r"\b(1[3-4]|2[0-2]):[0-3]0\b", payload(text))
            check.check(ok, "check_availability responde")
            hour = f"{hours[0]}:00" if hours else "21:00"
            ok, text = await call(session, "casa_zeta_book_table", {
                "name": "Ada Lovelace", "phone": "600123456",
                "date": target, "time": hour, "people": 4,
            })
            match = re.search(r"R-[A-Z0-9]{6}", text)
            check.check(ok, f"book_table reserva a las {hour}" + (f" ({match.group(0)})" if match else ""))
            if match:
                ok, _ = await call(session, "casa_zeta_get_reservation", {"code": match.group(0)})
                check.check(ok, "get_reservation encuentra la reserva")

            if include_real:
                print("\nWeb real en solo lectura: crates.io")
                ok, text = await call(session, "crates_search_crates", {"query": "http client", "per_page": 3})
                check.check(ok and bool(as_json(text).get("crates")), "crates_search_crates devuelve crates")

    print()
    if check.failures:
        print(f"FALLAN {check.failures} comprobaciones")
        return 1
    print("OK: prueba de humo del runtime completada")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main("--real" in sys.argv)))
    except SystemExit:
        raise
    except BaseExceptionGroup as group:  # noqa: BLE001 - muestra la causa real del TaskGroup
        print("ERROR (grupo de excepciones):")
        for index, exc in enumerate(group.exceptions, 1):
            print(f"  [{index}] {type(exc).__name__}: {exc}")
            nested = getattr(exc, "exceptions", None)
            for inner in nested or []:
                print(f"      → {type(inner).__name__}: {inner}")
        raise SystemExit(1)
    except Exception as exc:  # noqa: BLE001 - resumen legible en la terminal
        print(f"ERROR: {type(exc).__name__}: {exc}")
        raise SystemExit(1)
