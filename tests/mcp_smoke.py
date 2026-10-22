"""Prueba de humo del runtime MCP contra la web de recepción.

    .venv/bin/python tests/mcp_smoke.py

Arranca el servidor MCP por stdio, lista las herramientas y recorre el flujo
completo: disponibilidad → reserva → check-in/out → mesa → pedido de comida.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / "bin" / "python"


def payload(text: str) -> dict:
    _, _, body = text.partition("\n")
    return json.loads(body)


async def main() -> int:
    env = {**os.environ, "PYTHONPATH": str(ROOT / "core")}
    params = StdioServerParameters(
        command=str(PYTHON),
        args=["-m", "mcportal_core.runtime.server", str(ROOT / "manifests")],
        env=env,
        cwd=ROOT,
    )

    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        checks.append((name, ok, detail))

    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            listing = await session.list_tools()
            names = [tool.name for tool in listing.tools]
            check("runtime: lista 15 herramientas", len(names) == 15, str(len(names)))
            check("runtime: prefijo del sitio", all(name.startswith("hostal_zeta_") for name in names))

            async def call(name: str, arguments: dict | None = None) -> dict:
                result = await session.call_tool(name, arguments or {})
                text = "".join(block.text for block in result.content if getattr(block, "type", "") == "text")
                if result.is_error:
                    raise RuntimeError(f"{name}: {text}")
                return payload(text)

            summary = await call("hostal_zeta_daily_summary")
            check("resumen: habitaciones totales", summary["habitaciones_totales"] == 16, str(summary))

            availability = await call(
                "hostal_zeta_check_room_availability",
                {"desde": "2027-03-15", "noches": 2, "personas": 2},
            )
            room_type = availability["results"][0]["room_type_id"]
            check("disponibilidad: devuelve tipos libres", bool(room_type), room_type)

            booking = await call(
                "hostal_zeta_create_booking",
                {
                    "room_type_id": room_type,
                    "checkin": "2027-03-15",
                    "nights": 2,
                    "guest_name": "Ada Lovelace",
                    "email": "ada@example.com",
                    "phone": "600123456",
                    "guests": 2,
                },
            )
            booking_id = booking["booking_id"]
            check("reserva: crea booking_id", booking_id.startswith("bk-"), booking_id)
            check("reserva: calcula total", booking["total"] == availability["results"][0]["total"])

            checked = await call("hostal_zeta_check_in", {"booking_id": booking_id})
            check("check-in: cambia estado", checked["status"] == "checked_in")

            checked_out = await call("hostal_zeta_check_out", {"booking_id": booking_id})
            check("check-out: cambia estado", checked_out["status"] == "checked_out")

            tables = await call(
                "hostal_zeta_check_table_availability",
                {"fecha": "2027-03-15", "hora": "21:00", "personas": 4},
            )
            table_id = tables["tables"][0]["table_id"]
            check("mesas: devuelve table_id", table_id.startswith("tbl-"), table_id)

            reservation = await call(
                "hostal_zeta_book_table",
                {
                    "table_id": table_id,
                    "fecha": "2027-03-15",
                    "hora": "21:00",
                    "personas": 4,
                    "name": "Ada Lovelace",
                    "phone": "600123456",
                },
            )
            check("mesa: crea reservation_id", reservation["reservation_id"].startswith("tr-"))

            menu = await call("hostal_zeta_get_menu")
            item_id = menu["items"][0]["item_id"]
            check("carta: devuelve item_id", item_id.startswith("dish-"), item_id)

            order = await call(
                "hostal_zeta_create_food_order",
                {"booking_id": booking_id, "item_id": item_id, "qty": 2, "notes": "Sin cebolla."},
            )
            order_id = order["order_id"]
            check("pedido: crea order_id", order_id.startswith("ord-"), order_id)
            check("pedido: enlaza la habitación", order["destination"]["kind"] == "room")

            orders = await call("hostal_zeta_list_orders")
            check("pedidos: aparece el nuevo", any(o["order_id"] == order_id for o in orders["orders"]))

            updated = await call(
                "hostal_zeta_update_order_status",
                {"order_id": order_id, "status": "preparing"},
            )
            check("pedido: cambia de estado", updated["status"] == "preparing")

    for name, ok, detail in checks:
        print(f"{'OK ' if ok else 'FALLO'} {name}" + (f" · {detail}" if detail else ""))
    failed = [name for name, ok, _ in checks if not ok]
    print(f"\n{len(checks) - len(failed)}/{len(checks)} comprobaciones")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
