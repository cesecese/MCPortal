"""Prueba de humo con los manifiestos GENERADOS (sección 7.11).

Arranca el runtime apuntando a `manifests/` y recorre el flujo completo con las herramientas
que ha generado el pipeline: buscar → carrito → 2 artículos → checkout, y disponibilidad →
reserva. Los nombres llevan el prefijo del sitio, así que se localizan por sufijo.

Uso:
    py core/tests/generated_smoke.py [--real]
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
MANIFESTS = ROOT / "manifests"


def payload(text: str) -> str:
    return text.split("\n", 1)[1] if text.startswith("HTTP ") and "\n" in text else text


def as_json(text: str) -> dict:
    try:
        return json.loads(payload(text))
    except json.JSONDecodeError:
        return {}


def find_tool(names: list[str], *suffixes: str) -> str | None:
    for name in names:
        if all(suffix in name for suffix in suffixes):
            return name
    return None


async def main(include_real: bool) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    if not any(MANIFESTS.glob("*.json")):
        print("No hay manifiestos generados: ejecuta antes el pipeline.")
        return 1

    failures = 0

    def check(condition: bool, message: str) -> None:
        nonlocal failures
        print(f"  {'OK  ' if condition else 'FALLA'} {message}")
        if not condition:
            failures += 1

    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "mcportal_core.runtime.server", str(MANIFESTS)],
        env=dict(os.environ),
    )
    async with stdio_client(params) as (read_stream, write_stream):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            names = [tool.name for tool in (await session.list_tools()).tools]
            print(f"\nHerramientas generadas: {len(names)}")
            check(len(names) > 0, "el runtime sirve los manifiestos generados")

            async def call(name: str | None, args: dict) -> tuple[bool, str]:
                if not name:
                    return False, ""
                result = await session.call_tool(name, arguments=args)
                return not result.is_error, "\n".join(getattr(b, "text", "") for b in result.content)

            search = find_tool(names, "search")
            cart = find_tool(names, "create_cart") or find_tool(names, "post_cart")
            add = find_tool(names, "add") or find_tool(names, "items")
            checkout = find_tool(names, "checkout")
            availability = find_tool(names, "availability") or find_tool(names, "disponibilidad")
            booking = (find_tool(names, "create_reservation") or find_tool(names, "book_table")
                       or find_tool(names, "reservar"))
            reservation = (find_tool(names, "get_reservation") or find_tool(names, "get_reserva")
                           or find_tool(names, "consulta"))

            print("\nCarrito: buscar → crear → 2 artículos → checkout")
            ok, text = await call(search, {"query": "asimov"})
            results = as_json(text).get("results") or []
            check(ok and bool(results), "la búsqueda devuelve resultados")
            product_id = results[0]["id"] if results else "bk-1001"

            ok, text = await call(cart, {})
            cart_id = as_json(text).get("cart_id", "")
            check(ok and bool(cart_id), f"se crea el carrito ({cart_id or 'sin id'})")

            ok, text = await call(add, {"cart_id": cart_id, "product_id": product_id, "qty": 2})
            items = as_json(text).get("items") or []
            check(ok and bool(items), "se añaden 2 unidades")

            ok, text = await call(checkout, {"cart_id": cart_id, "name": "Ada Lovelace",
                                             "email": "ada@example.com"})
            check(ok and bool(as_json(text).get("order_id")), "se cierra la compra con order_id")

            print("\nReserva: disponibilidad → reserva")
            target = (date.today() + timedelta(days=2)).isoformat()
            ok, text = await call(availability, {"date": target, "people": 4})
            hours = re.findall(r"\b([12][0-9]):[0-3]0\b", payload(text))
            check(ok, "la disponibilidad responde")
            hour = f"{hours[0]}:00" if hours else "21:00"
            ok, text = await call(booking, {"name": "Ada Lovelace", "phone": "600123456",
                                            "date": target, "time": hour, "people": 4})
            code = re.search(r"R-[A-Z0-9]{6}", text)
            check(ok, f"la reserva funciona a las {hour}" + (f" ({code.group(0)})" if code else ""))
            if code and reservation:
                ok, _ = await call(reservation, {"code": code.group(0)})
                check(ok, "la consulta de la reserva la encuentra")

            if include_real:
                real = find_tool(names, "crates")
                if real:
                    ok, text = await call(real, {"query": "http client", "per_page": 3})
                    check(ok and bool(as_json(text).get("crates")), "la web real devuelve resultados")

    print()
    print("OK: prueba de humo con manifiestos generados" if not failures else f"FALLAN {failures} comprobaciones")
    return 0 if not failures else 1


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main("--real" in sys.argv)))
    except SystemExit:
        raise
    except BaseExceptionGroup as group:
        print("ERROR (grupo de excepciones):")
        for exc in group.exceptions:
            print(f"  {type(exc).__name__}: {exc}")
            for inner in getattr(exc, "exceptions", []) or []:
                print(f"    → {type(inner).__name__}: {inner}")
        raise SystemExit(1)
    except Exception as exc:
        print(f"ERROR: {type(exc).__name__}: {exc}")
        raise SystemExit(1)
