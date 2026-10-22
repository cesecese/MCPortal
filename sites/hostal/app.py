"""Hostal Zeta · recepción.

Web de gestión básica para un alojamiento con restaurante. La usa el personal de
recepción para consultar disponibilidad, crear reservas de habitación y de mesa,
hacer check-in/check-out y enviar pedidos de comida a cocina.

Todo pasa por una API JSON que la propia interfaz consume con `fetch`: así el
explorador de MCPortal puede descubrir las acciones y generar herramientas.

    .venv/bin/uvicorn sites.hostal.app:app --host 127.0.0.1 --port 8020
"""

from __future__ import annotations

import datetime as dt
import secrets
import sqlite3
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import Iterator, Literal

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

DB_PATH = Path(__file__).with_name("hostal.db")
TIME_SLOTS = ["13:00", "13:30", "14:00", "14:30", "20:00", "20:30", "21:00", "21:30", "22:00"]
NIGHTS_OPTIONS = [1, 2, 3, 4, 5, 6, 7]

ROOM_TYPES = [
    ("rt-individual", "Individual", 1, 55.0, "Cama individual, escritorio y baño privado."),
    ("rt-doble", "Doble", 2, 79.0, "Cama de matrimonio o dos camas, con vistas al patio."),
    ("rt-suite", "Suite", 4, 129.0, "Dormitorio, salón y terraza. Ideal para familias."),
]

ROOMS = (
    [("room-101", "rt-individual", "101", 1), ("room-102", "rt-individual", "102", 1),
     ("room-103", "rt-individual", "103", 1), ("room-104", "rt-individual", "104", 2),
     ("room-105", "rt-individual", "105", 2)]
    + [("room-201", "rt-doble", "201", 2), ("room-202", "rt-doble", "202", 2),
       ("room-203", "rt-doble", "203", 2), ("room-204", "rt-doble", "204", 2),
       ("room-205", "rt-doble", "205", 3), ("room-206", "rt-doble", "206", 3),
       ("room-207", "rt-doble", "207", 3), ("room-208", "rt-doble", "208", 3)]
    + [("room-301", "rt-suite", "301", 3), ("room-302", "rt-suite", "302", 3),
       ("room-303", "rt-suite", "303", 4)]
)

TABLES = [
    ("tbl-01", "Mesa 1", 2), ("tbl-02", "Mesa 2", 2), ("tbl-03", "Mesa 3", 4),
    ("tbl-04", "Mesa 4", 4), ("tbl-05", "Mesa 5", 4), ("tbl-06", "Mesa 6", 6),
    ("tbl-07", "Mesa 7", 6), ("tbl-08", "Mesa 8", 8), ("tbl-09", "Mesa 9", 2),
    ("tbl-10", "Mesa 10", 4),
]

MENU = [
    ("dish-1001", "Croquetas caseras", "Entrantes", 6.5, "Jamón ibérico, 6 unidades."),
    ("dish-1002", "Gazpacho andaluz", "Entrantes", 5.5, "Con guarnición de verduras."),
    ("dish-1003", "Pulpo a la gallega", "Entrantes", 12.5, "Patata, pimentón y aceite de oliva."),
    ("dish-2001", "Paella de marisco", "Principales", 18.0, "Mínimo dos personas."),
    ("dish-2002", "Merluza en salsa verde", "Principales", 16.5, "Con almejas y guisantes."),
    ("dish-2003", "Entrecot a la brasa", "Principales", 19.0, "Con patatas y pimiento."),
    ("dish-2004", "Risotto de setas", "Principales", 14.0, "Arroz carnaroli y parmesano."),
    ("dish-3001", "Tarta de queso", "Postres", 5.0, "Horneada, con mermelada de frutos rojos."),
    ("dish-3002", "Arroz con leche", "Postres", 4.5, "Canela y limón."),
    ("dish-4001", "Agua mineral", "Bebidas", 2.0, "Botella de 50 cl."),
    ("dish-4002", "Vino tinto de la casa", "Bebidas", 3.5, "Copa de Rioja."),
    ("dish-4003", "Cerveza artesanal", "Bebidas", 3.0, "Rubia, 33 cl."),
]

ORDER_STATUSES = ("pending", "preparing", "served", "cancelled")


# --------------------------------------------------------------------- base de datos

@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def rows(sql: str, params: tuple = ()) -> list[dict]:
    with db() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def one(sql: str, params: tuple = ()) -> dict | None:
    with db() as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def execute(sql: str, params: tuple = ()) -> None:
    with db() as conn:
        conn.execute(sql, params)


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS room_types (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, capacity INTEGER NOT NULL,
                price REAL NOT NULL, description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS rooms (
                id TEXT PRIMARY KEY, room_type_id TEXT NOT NULL REFERENCES room_types(id),
                number TEXT NOT NULL, floor INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS bookings (
                id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id),
                room_type_id TEXT NOT NULL REFERENCES room_types(id),
                guest_name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
                guests INTEGER NOT NULL, checkin TEXT NOT NULL, checkout TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'confirmed', total REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tables (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, seats INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS table_reservations (
                id TEXT PRIMARY KEY, table_id TEXT NOT NULL REFERENCES tables(id),
                date TEXT NOT NULL, time TEXT NOT NULL, party_size INTEGER NOT NULL,
                name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'confirmed', created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
                price REAL NOT NULL, description TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY, booking_id TEXT REFERENCES bookings(id),
                table_reservation_id TEXT REFERENCES table_reservations(id),
                status TEXT NOT NULL DEFAULT 'pending', total REAL NOT NULL,
                notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL REFERENCES orders(id),
                item_id TEXT NOT NULL REFERENCES menu_items(id), qty INTEGER NOT NULL, price REAL NOT NULL
            );
            """
        )


def seed() -> None:
    if one("SELECT COUNT(*) AS n FROM room_types")["n"]:
        return
    today = dt.date.today()

    with db() as conn:
        conn.executemany("INSERT INTO room_types VALUES (?,?,?,?,?)", ROOM_TYPES)
        conn.executemany("INSERT INTO rooms VALUES (?,?,?,?)", ROOMS)
        conn.executemany("INSERT INTO tables VALUES (?,?,?)", TABLES)
        conn.executemany("INSERT INTO menu_items VALUES (?,?,?,?,?)", MENU)

        def booking(room_id: str, type_id: str, name: str, email: str, phone: str,
                    guests: int, checkin: dt.date, checkout: dt.date, status: str, total: float) -> str:
            booking_id = f"bk-{secrets.token_hex(3)}"
            conn.execute(
                "INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (booking_id, room_id, type_id, name, email, phone, guests,
                 checkin.isoformat(), checkout.isoformat(), status, total, dt.datetime.now().isoformat()),
            )
            return booking_id

        marta = booking("room-201", "rt-doble", "Marta Ruiz", "marta@example.com", "600111222",
                        2, today - dt.timedelta(days=1), today + dt.timedelta(days=2), "checked_in", 237.0)
        booking("room-301", "rt-suite", "John Smith", "john@example.com", "+44 7700 900123",
                2, today, today + dt.timedelta(days=3), "confirmed", 387.0)
        booking("room-102", "rt-individual", "Lucía Gómez", "lucia@example.com", "600333444",
                1, today + dt.timedelta(days=5), today + dt.timedelta(days=7), "confirmed", 110.0)

        conn.execute(
            "INSERT INTO table_reservations VALUES (?,?,?,?,?,?,?,?,?)",
            (f"tr-{secrets.token_hex(3)}", "tbl-04", today.isoformat(), "13:30", 4,
             "Familia Pérez", "600555666", "confirmed", dt.datetime.now().isoformat()),
        )
        conn.execute(
            "INSERT INTO table_reservations VALUES (?,?,?,?,?,?,?,?,?)",
            (f"tr-{secrets.token_hex(3)}", "tbl-08", today.isoformat(), "21:00", 7,
             "Grupo Alameda", "600777888", "confirmed", dt.datetime.now().isoformat()),
        )

        order_id = f"ord-{secrets.token_hex(3)}"
        conn.execute(
            "INSERT INTO orders VALUES (?,?,?,?,?,?,?)",
            (order_id, marta, None, "pending", 24.5, "Sin cebolla en las croquetas.",
             dt.datetime.now().isoformat()),
        )
        conn.execute(
            "INSERT INTO order_items (order_id, item_id, qty, price) VALUES (?,?,?,?)",
            (order_id, "dish-1001", 2, 6.5),
        )
        conn.execute(
            "INSERT INTO order_items (order_id, item_id, qty, price) VALUES (?,?,?,?)",
            (order_id, "dish-2001", 1, 18.0),
        )


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed()
    yield


app = FastAPI(title="Hostal Zeta · Recepción", version="0.1.0", lifespan=lifespan)


# --------------------------------------------------------------------- modelos

class BookingIn(BaseModel):
    room_type_id: str
    checkin: str
    nights: int = Field(default=1, ge=1, le=14)
    guest_name: str = Field(min_length=2, max_length=80)
    email: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)
    guests: int = Field(default=1, ge=1, le=6)


class TableReservationIn(BaseModel):
    table_id: str
    fecha: str
    hora: str
    personas: int = Field(ge=1, le=10)
    name: str = Field(min_length=2, max_length=80)
    phone: str = Field(default="", max_length=40)


class OrderIn(BaseModel):
    item_id: str
    qty: int = Field(default=1, ge=1, le=20)
    booking_id: str | None = None
    table_reservation_id: str | None = None
    notes: str = Field(default="", max_length=300)


class OrderStatusIn(BaseModel):
    status: Literal["pending", "preparing", "served", "cancelled"]


# --------------------------------------------------------------------- utilidades

def parse_date(value: str, field: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        raise HTTPException(400, f"{field} debe ser una fecha YYYY-MM-DD")


def minutes(hhmm: str) -> int:
    try:
        h, m = hhmm.split(":")
        return int(h) * 60 + int(m)
    except (ValueError, AttributeError):
        raise HTTPException(400, "La hora debe tener formato HH:MM")


def booking_view(row: dict) -> dict:
    return {
        "booking_id": row["id"],
        "guest_name": row["guest_name"],
        "email": row["email"],
        "phone": row["phone"],
        "guests": row["guests"],
        "room_id": row["room_id"],
        "room": row["number"],
        "room_type_id": row["room_type_id"],
        "room_type": row["type_name"],
        "checkin": row["checkin"],
        "checkout": row["checkout"],
        "nights": (dt.date.fromisoformat(row["checkout"]) - dt.date.fromisoformat(row["checkin"])).days,
        "status": row["status"],
        "total": round(row["total"], 2),
    }


BOOKING_SELECT = """
    SELECT b.*, r.number, t.name AS type_name
    FROM bookings b JOIN rooms r ON r.id = b.room_id JOIN room_types t ON t.id = b.room_type_id
"""


def order_view(row: dict) -> dict:
    items = rows(
        """SELECT oi.item_id, m.name, oi.qty, oi.price, ROUND(oi.qty * oi.price, 2) AS subtotal
           FROM order_items oi JOIN menu_items m ON m.id = oi.item_id WHERE oi.order_id = ?""",
        (row["id"],),
    )
    destination = None
    if row["booking_id"]:
        found = one(f"{BOOKING_SELECT} WHERE b.id = ?", (row["booking_id"],))
        if found:
            destination = {"kind": "room", "booking_id": found["id"], "guest_name": found["guest_name"],
                           "room": found["number"]}
    elif row["table_reservation_id"]:
        found = one(
            """SELECT tr.*, t.name AS table_name FROM table_reservations tr
               JOIN tables t ON t.id = tr.table_id WHERE tr.id = ?""",
            (row["table_reservation_id"],),
        )
        if found:
            destination = {"kind": "table", "reservation_id": found["id"], "name": found["name"],
                           "table": found["table_name"], "time": found["time"]}
    return {
        "order_id": row["id"],
        "status": row["status"],
        "total": round(row["total"], 2),
        "notes": row["notes"],
        "created_at": row["created_at"],
        "destination": destination,
        "items": items,
    }


# --------------------------------------------------------------------- habitaciones

@app.get("/api/hotel/tipos")
def room_types() -> dict:
    types = rows("SELECT * FROM room_types ORDER BY price")
    return {"room_types": [
        {
            "room_type_id": t["id"], "name": t["name"], "capacity": t["capacity"],
            "price_per_night": t["price"], "description": t["description"],
            "rooms": [r["id"] for r in rows("SELECT id FROM rooms WHERE room_type_id = ?", (t["id"],))],
        }
        for t in types
    ]}


@app.get("/api/hotel/disponibilidad")
def room_availability(desde: str, noches: int = 1, personas: int = 1) -> dict:
    checkin = parse_date(desde, "desde")
    if noches < 1 or noches > 14:
        raise HTTPException(422, "noches debe estar entre 1 y 14")
    checkout = checkin + dt.timedelta(days=noches)
    free = rows(
        """SELECT r.id, r.room_type_id FROM rooms r
           WHERE r.id NOT IN (
             SELECT b.room_id FROM bookings b
             WHERE b.status IN ('confirmed','checked_in')
               AND b.checkin < ? AND b.checkout > ?
           )""",
        (checkout.isoformat(), checkin.isoformat()),
    )
    result = []
    for room_type in rows("SELECT * FROM room_types ORDER BY price"):
        if room_type["capacity"] < personas:
            continue
        available = [r["id"] for r in free if r["room_type_id"] == room_type["id"]]
        if not available:
            continue
        result.append({
            "room_type_id": room_type["id"],
            "name": room_type["name"],
            "capacity": room_type["capacity"],
            "price_per_night": room_type["price"],
            "free_rooms": len(available),
            "room_ids": available,
            "nights": noches,
            "total": round(room_type["price"] * noches, 2),
        })
    return {"desde": checkin.isoformat(), "hasta": checkout.isoformat(), "noches": noches,
            "personas": personas, "results": result}


@app.post("/api/hotel/reservas", status_code=201)
def create_booking(payload: BookingIn) -> dict:
    checkin = parse_date(payload.checkin, "checkin")
    checkout = checkin + dt.timedelta(days=payload.nights)
    room_type = one("SELECT * FROM room_types WHERE id = ?", (payload.room_type_id,))
    if not room_type:
        raise HTTPException(404, "No existe ese tipo de habitación")
    if payload.guests > room_type["capacity"]:
        raise HTTPException(409, "El tipo de habitación no tiene capacidad para esos huéspedes")

    free = rows(
        """SELECT r.id FROM rooms r
           WHERE r.room_type_id = ? AND r.id NOT IN (
             SELECT b.room_id FROM bookings b
             WHERE b.status IN ('confirmed','checked_in')
               AND b.checkin < ? AND b.checkout > ?
           ) LIMIT 1""",
        (payload.room_type_id, checkout.isoformat(), checkin.isoformat()),
    )
    if not free:
        raise HTTPException(409, "No hay habitaciones libres de ese tipo para esas fechas")

    booking_id = f"bk-{secrets.token_hex(3)}"
    total = round(room_type["price"] * payload.nights, 2)
    execute(
        """INSERT INTO bookings VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        (booking_id, free[0]["id"], payload.room_type_id, payload.guest_name, payload.email,
         payload.phone, payload.guests, checkin.isoformat(), checkout.isoformat(), "confirmed",
         total, dt.datetime.now().isoformat()),
    )
    found = one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,))
    return booking_view(found)


@app.get("/api/hotel/reservas")
def list_bookings(estado: str = "activas") -> dict:
    if estado == "todas":
        found = rows(f"{BOOKING_SELECT} ORDER BY b.checkin, b.guest_name")
    elif estado == "hoy":
        today = dt.date.today().isoformat()
        found = rows(f"{BOOKING_SELECT} WHERE b.checkin <= ? AND b.checkout > ? ORDER BY b.checkin",
                     (today, today))
    else:
        found = rows(
            f"{BOOKING_SELECT} WHERE b.status IN ('confirmed','checked_in') ORDER BY b.checkin, b.guest_name"
        )
    return {"bookings": [booking_view(row) for row in found]}


@app.get("/api/hotel/reservas/{booking_id}")
def get_booking(booking_id: str) -> dict:
    found = one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,))
    if not found:
        raise HTTPException(404, "Reserva no encontrada")
    return booking_view(found)


@app.post("/api/hotel/reservas/{booking_id}/checkin")
def check_in(booking_id: str) -> dict:
    found = one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,))
    if not found:
        raise HTTPException(404, "Reserva no encontrada")
    if found["status"] != "confirmed":
        raise HTTPException(409, f"La reserva está en estado {found['status']}")
    execute("UPDATE bookings SET status = 'checked_in' WHERE id = ?", (booking_id,))
    return booking_view(one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,)))


@app.post("/api/hotel/reservas/{booking_id}/checkout")
def check_out(booking_id: str) -> dict:
    found = one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,))
    if not found:
        raise HTTPException(404, "Reserva no encontrada")
    if found["status"] != "checked_in":
        raise HTTPException(409, "Solo se puede hacer check-out de una reserva con check-in")
    execute("UPDATE bookings SET status = 'checked_out' WHERE id = ?", (booking_id,))
    return booking_view(one(f"{BOOKING_SELECT} WHERE b.id = ?", (booking_id,)))


# --------------------------------------------------------------------- restaurante

@app.get("/api/restaurante/mesas")
def tables(fecha: str | None = None, hora: str | None = None, personas: int = 1) -> dict:
    if fecha is None:
        return {"tables": rows("SELECT id AS table_id, name, seats FROM tables ORDER BY id")}
    day = parse_date(fecha, "fecha")
    start = minutes(hora or "21:00")
    busy = {
        r["table_id"] for r in rows(
            "SELECT table_id, time FROM table_reservations WHERE date = ? AND status = 'confirmed'",
            (day.isoformat(),),
        )
        if abs(minutes(r["time"]) - start) < 90
    }
    available = [
        {"table_id": t["id"], "name": t["name"], "seats": t["seats"]}
        for t in rows("SELECT * FROM tables ORDER BY id")
        if t["id"] not in busy and t["seats"] >= personas
    ]
    return {"fecha": day.isoformat(), "hora": hora, "personas": personas, "tables": available}


@app.post("/api/restaurante/reservas", status_code=201)
def create_table_reservation(payload: TableReservationIn) -> dict:
    day = parse_date(payload.fecha, "fecha")
    start = minutes(payload.hora)
    table = one("SELECT * FROM tables WHERE id = ?", (payload.table_id,))
    if not table:
        raise HTTPException(404, "Mesa no encontrada")
    if payload.personas > table["seats"]:
        raise HTTPException(409, "La mesa no tiene sitio para tantas personas")
    conflict = [
        r for r in rows(
            "SELECT time FROM table_reservations WHERE table_id = ? AND date = ? AND status = 'confirmed'",
            (payload.table_id, day.isoformat()),
        )
        if abs(minutes(r["time"]) - start) < 90
    ]
    if conflict:
        raise HTTPException(409, "La mesa ya está reservada en esa franja")
    reservation_id = f"tr-{secrets.token_hex(3)}"
    execute(
        "INSERT INTO table_reservations VALUES (?,?,?,?,?,?,?,?,?)",
        (reservation_id, payload.table_id, day.isoformat(), payload.hora, payload.personas,
         payload.name, payload.phone, "confirmed", dt.datetime.now().isoformat()),
    )
    return {
        "reservation_id": reservation_id, "table_id": payload.table_id, "table": table["name"],
        "fecha": day.isoformat(), "hora": payload.hora, "personas": payload.personas,
        "name": payload.name, "status": "confirmed",
    }


@app.get("/api/restaurante/reservas")
def list_table_reservations(fecha: str | None = None) -> dict:
    if fecha:
        day = parse_date(fecha, "fecha").isoformat()
        found = rows(
            """SELECT tr.*, t.name AS table_name FROM table_reservations tr
               JOIN tables t ON t.id = tr.table_id WHERE tr.date = ? ORDER BY tr.time""",
            (day,),
        )
    else:
        found = rows(
            """SELECT tr.*, t.name AS table_name FROM table_reservations tr
               JOIN tables t ON t.id = tr.table_id ORDER BY tr.date, tr.time"""
        )
    return {"reservations": [
        {
            "reservation_id": r["id"], "table_id": r["table_id"], "table": r["table_name"],
            "fecha": r["date"], "hora": r["time"], "personas": r["party_size"],
            "name": r["name"], "phone": r["phone"], "status": r["status"],
        }
        for r in found
    ]}


@app.get("/api/restaurante/carta")
def menu() -> dict:
    return {"items": [
        {"item_id": m["id"], "name": m["name"], "category": m["category"],
         "price": m["price"], "description": m["description"]}
        for m in rows("SELECT * FROM menu_items ORDER BY category, name")
    ]}


@app.post("/api/restaurante/pedidos", status_code=201)
def create_order(payload: OrderIn) -> dict:
    item = one("SELECT * FROM menu_items WHERE id = ?", (payload.item_id,))
    if not item:
        raise HTTPException(404, "Plato no encontrado")
    if not payload.booking_id and not payload.table_reservation_id:
        raise HTTPException(422, "Indica una reserva de habitación o de mesa")
    if payload.booking_id and not one("SELECT id FROM bookings WHERE id = ?", (payload.booking_id,)):
        raise HTTPException(404, "Reserva de habitación no encontrada")
    if payload.table_reservation_id and not one(
        "SELECT id FROM table_reservations WHERE id = ?", (payload.table_reservation_id,)
    ):
        raise HTTPException(404, "Reserva de mesa no encontrada")

    order_id = f"ord-{secrets.token_hex(3)}"
    total = round(item["price"] * payload.qty, 2)
    execute(
        "INSERT INTO orders VALUES (?,?,?,?,?,?,?)",
        (order_id, payload.booking_id, payload.table_reservation_id, "pending", total,
         payload.notes, dt.datetime.now().isoformat()),
    )
    execute(
        "INSERT INTO order_items (order_id, item_id, qty, price) VALUES (?,?,?,?)",
        (order_id, payload.item_id, payload.qty, item["price"]),
    )
    return order_view(one("SELECT * FROM orders WHERE id = ?", (order_id,)))


@app.get("/api/restaurante/pedidos")
def list_orders(estado: str = "todos") -> dict:
    if estado == "todos":
        found = rows("SELECT * FROM orders ORDER BY created_at DESC")
    else:
        found = rows("SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC", (estado,))
    return {"orders": [order_view(row) for row in found]}


@app.patch("/api/restaurante/pedidos/{order_id}")
def update_order(order_id: str, payload: OrderStatusIn) -> dict:
    if not one("SELECT id FROM orders WHERE id = ?", (order_id,)):
        raise HTTPException(404, "Pedido no encontrado")
    execute("UPDATE orders SET status = ? WHERE id = ?", (payload.status, order_id))
    return order_view(one("SELECT * FROM orders WHERE id = ?", (order_id,)))


@app.get("/api/resumen")
def summary() -> dict:
    today = dt.date.today().isoformat()
    return {
        "fecha": today,
        "habitaciones_libres": one(
            """SELECT COUNT(*) AS n FROM rooms r WHERE r.id NOT IN (
                 SELECT room_id FROM bookings
                 WHERE status IN ('confirmed','checked_in') AND checkin <= ? AND checkout > ?)""",
            (today, today),
        )["n"],
        "habitaciones_totales": one("SELECT COUNT(*) AS n FROM rooms")["n"],
        "llegadas_hoy": one(
            "SELECT COUNT(*) AS n FROM bookings WHERE checkin = ? AND status = 'confirmed'", (today,),
        )["n"],
        "reservas_mesa_hoy": one(
            "SELECT COUNT(*) AS n FROM table_reservations WHERE date = ? AND status = 'confirmed'", (today,),
        )["n"],
        "pedidos_pendientes": one(
            "SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','preparing')",
        )["n"],
    }


# --------------------------------------------------------------------- interfaz

@app.get("/", response_class=HTMLResponse)
def index() -> str:
    return INDEX_HTML


INDEX_HTML = r"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hostal Zeta · Recepción</title>
<style>
:root{
  --bg:#f6f2ea; --surface:#fffdf8; --ink:#1d1a16; --muted:#6f675c; --line:#ddd5c7;
  --accent:#b4472e; --accent-soft:#f6ded6; --ok:#1f7a4d; --warn:#a5620a; --danger:#b5300a;
  --r:10px; --shadow:0 1px 2px rgb(29 26 22 / .05), 0 8px 24px -18px rgb(29 26 22 / .35);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
h1,h2,h3{font-family:Georgia,"Times New Roman",serif;font-weight:600;letter-spacing:-.02em;margin:0}
a{color:inherit}
header{background:var(--surface);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}
.wrap{max-width:1180px;margin:0 auto;padding:0 22px}
.top{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 0}
.brand{display:flex;align-items:baseline;gap:12px}
.brand h1{font-size:26px}
.brand span{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
nav a{margin-left:18px;font-size:13px;color:var(--muted);text-decoration:none;text-transform:uppercase;letter-spacing:.08em}
nav a:hover{color:var(--accent)}
main.wrap{padding:26px 22px 70px}
.stats{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:26px}
.stat{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:14px 16px;box-shadow:var(--shadow)}
.stat b{display:block;font-size:26px;font-family:Georgia,serif}
.stat span{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.grid{display:grid;grid-template-columns:minmax(0,420px) minmax(0,1fr);gap:18px;align-items:start}
.grid > *{min-width:0}
.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px;box-shadow:var(--shadow);margin-bottom:18px}
.card h2{font-size:20px;margin-bottom:2px}
.card p.lead{margin:4px 0 14px;color:var(--muted);font-size:13px}
label{display:block;font-size:12px;color:var(--muted);margin:10px 0 4px;text-transform:uppercase;letter-spacing:.06em}
input,select,textarea{width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:7px;background:#fff;font:inherit}
input:focus,select:focus,textarea:focus{outline:2px solid var(--accent-soft);border-color:var(--accent)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
button{font:inherit;cursor:pointer;border-radius:7px;border:1px solid var(--line);background:#fff;padding:9px 14px}
button.primary{background:var(--ink);color:#fff;border-color:var(--ink)}
button.primary:hover{background:#000}
button.accent{background:var(--accent);color:#fff;border-color:var(--accent)}
button.small{padding:5px 9px;font-size:12px}
button.ghost{background:transparent;border-color:transparent;color:var(--muted)}
button:disabled{opacity:.5;cursor:not-allowed}
table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:6px 8px;border-bottom:1px solid var(--line)}
td{padding:8px;border-bottom:1px solid #efeae0;vertical-align:middle}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
.badge{display:inline-block;padding:1px 7px;border-radius:99px;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;border:1px solid var(--line);color:var(--muted)}
.badge.ok{background:#e4f2e9;border-color:#bcdec9;color:var(--ok)}
.badge.warn{background:#f9edd7;border-color:#e7cfa5;color:var(--warn)}
.badge.danger{background:#fbe3dc;border-color:#eec4b8;color:var(--danger)}
.list{max-height:360px;max-width:100%;overflow:auto}
.list table{min-width:600px}
.empty{color:var(--muted);font-size:13px;padding:12px 0}
.toast{position:fixed;right:20px;bottom:20px;background:var(--ink);color:#fff;padding:12px 16px;border-radius:9px;font-size:13px;opacity:0;transform:translateY(8px);transition:.2s;pointer-events:none;max-width:360px}
.toast.show{opacity:1;transform:none}
.section{margin-top:28px}
.section > h2{font-size:24px;margin-bottom:12px}
.hint{font-size:12px;color:var(--muted);margin-top:6px}
.pill{display:inline-block;background:var(--accent-soft);color:var(--accent);border-radius:99px;padding:2px 8px;font-size:11px;font-family:ui-monospace,Menlo,monospace}
@media(max-width:900px){.grid{grid-template-columns:minmax(0,1fr)}.stats{grid-template-columns:repeat(2,1fr)}.top{flex-direction:column;align-items:flex-start}.row3{grid-template-columns:1fr}}
</style>
</head>
<body>
<header>
  <div class="wrap top">
    <div class="brand"><h1>Hostal Zeta</h1><span>Recepción</span></div>
    <nav>
      <a href="#habitaciones">Habitaciones</a>
      <a href="#restaurante">Restaurante</a>
      <a href="#pedidos">Pedidos</a>
    </nav>
  </div>
</header>
<main class="wrap">
  <div class="stats" id="stats"></div>

  <section id="habitaciones">
    <div class="grid">
      <div>
        <div class="card">
          <h2>Disponibilidad de habitaciones</h2>
          <p class="lead">Consulta por fecha de entrada, noches y huéspedes.</p>
          <form id="form-disponibilidad">
            <div class="row3">
              <div><label for="disp-desde">Entrada</label><input id="disp-desde" name="desde" type="date" required></div>
              <div><label for="disp-noches">Noches</label><select id="disp-noches" name="noches"></select></div>
              <div><label for="disp-personas">Personas</label><input id="disp-personas" name="personas" type="number" min="1" max="6" value="2"></div>
            </div>
            <div style="margin-top:14px"><button class="primary" type="submit">Consultar disponibilidad</button></div>
          </form>
          <div id="disp-resultado" class="hint"></div>
        </div>

        <div class="card">
          <h2>Nueva reserva de habitación</h2>
          <p class="lead">Para recepción: cuantos menos pasos, mejor.</p>
          <form id="form-reserva">
            <label for="res-tipo">Tipo de habitación</label>
            <select id="res-tipo" name="room_type_id" required></select>
            <div class="row">
              <div><label for="res-entrada">Entrada</label><input id="res-entrada" name="checkin" type="date" required></div>
              <div><label for="res-noches">Noches</label><select id="res-noches" name="nights"></select></div>
            </div>
            <label for="res-nombre">Huésped</label>
            <input id="res-nombre" name="guest_name" required placeholder="Nombre y apellidos">
            <div class="row">
              <div><label for="res-email">Email</label><input id="res-email" name="email" type="email" placeholder="huesped@example.com"></div>
              <div><label for="res-tel">Teléfono</label><input id="res-tel" name="phone" placeholder="600 000 000"></div>
            </div>
            <label for="res-personas">Huéspedes</label>
            <input id="res-personas" name="guests" type="number" min="1" max="6" value="2">
            <div style="margin-top:14px"><button class="accent" type="submit">Crear reserva</button></div>
          </form>
        </div>
      </div>

      <div class="card">
        <h2>Reservas activas</h2>
        <p class="lead">Llegadas, estancias en curso y salidas.</p>
        <div class="list"><table>
          <thead><tr><th>Huésped</th><th>Habitación</th><th>Entrada</th><th>Salida</th><th>Estado</th><th class="num">Total</th><th></th></tr></thead>
          <tbody id="bookings"></tbody>
        </table></div>
      </div>
    </div>
  </section>

  <section id="restaurante" class="section">
    <div class="grid">
      <div>
        <div class="card">
          <h2>Mesas libres</h2>
          <p class="lead">Franjas de 90 minutos.</p>
          <form id="form-mesas">
            <div class="row3">
              <div><label for="mesa-fecha">Fecha</label><input id="mesa-fecha" name="fecha" type="date" required></div>
              <div><label for="mesa-hora">Hora</label><select id="mesa-hora" name="hora"></select></div>
              <div><label for="mesa-personas">Personas</label><input id="mesa-personas" name="personas" type="number" min="1" max="10" value="2"></div>
            </div>
            <div style="margin-top:14px"><button class="primary" type="submit">Ver mesas libres</button></div>
          </form>
          <div id="mesas-resultado" class="hint"></div>
        </div>

        <div class="card">
          <h2>Reservar mesa</h2>
          <form id="form-mesa">
            <label for="mesa-id">Mesa</label>
            <select id="mesa-id" name="table_id" required></select>
            <div class="row3">
              <div><label for="mres-fecha">Fecha</label><input id="mres-fecha" name="fecha" type="date" required></div>
              <div><label for="mres-hora">Hora</label><select id="mres-hora" name="hora"></select></div>
              <div><label for="mres-personas">Personas</label><input id="mres-personas" name="personas" type="number" min="1" max="10" value="2"></div>
            </div>
            <label for="mres-nombre">A nombre de</label>
            <input id="mres-nombre" name="name" required placeholder="Nombre de la reserva">
            <label for="mres-tel">Teléfono</label>
            <input id="mres-tel" name="phone" placeholder="600 000 000">
            <div style="margin-top:14px"><button class="accent" type="submit">Reservar mesa</button></div>
          </form>
        </div>
      </div>

      <div class="card">
        <h2>Reservas de mesa</h2>
        <p class="lead">Servicio de hoy y próximas reservas.</p>
        <div class="list"><table>
          <thead><tr><th>Hora</th><th>Mesa</th><th>Personas</th><th>A nombre de</th><th>Estado</th></tr></thead>
          <tbody id="table-reservations"></tbody>
        </table></div>
      </div>
    </div>
  </section>

  <section id="pedidos" class="section">
    <div class="grid">
      <div class="card">
        <h2>Pedido a cocina</h2>
        <p class="lead">Para habitación o mesa, sin salir de recepción.</p>
        <form id="form-pedido">
          <div class="row">
            <div>
              <label for="pedido-booking">Reserva de habitación</label>
              <select id="pedido-booking" name="booking_id"></select>
            </div>
            <div>
              <label for="pedido-table">Reserva de mesa</label>
              <select id="pedido-table" name="table_reservation_id"></select>
            </div>
          </div>
          <label for="pedido-plato">Plato o bebida</label>
          <select id="pedido-plato" name="item_id" required></select>
          <div class="row">
            <div><label for="pedido-qty">Cantidad</label><input id="pedido-qty" name="qty" type="number" min="1" max="20" value="1"></div>
            <div><label for="pedido-notas">Notas</label><input id="pedido-notas" name="notes" placeholder="Sin cebolla, alergias…"></div>
          </div>
          <div style="margin-top:14px"><button class="accent" type="submit">Enviar pedido</button></div>
        </form>
      </div>

      <div class="card">
        <h2>Pedidos</h2>
        <p class="lead">Lo que está pendiente o en cocina.</p>
        <div class="list"><table>
          <thead><tr><th>Pedido</th><th>Destino</th><th>Contenido</th><th>Estado</th><th class="num">Total</th><th></th></tr></thead>
          <tbody id="orders"></tbody>
        </table></div>
      </div>
    </div>
  </section>
</main>
<div class="toast" id="toast"></div>
<script>
const $ = (s, r = document) => r.querySelector(s);
const money = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}`);
  return data;
}

const badge = (status) => {
  const labels = { confirmed: 'confirmada', checked_in: 'en casa', checked_out: 'salida',
                   pending: 'pendiente', preparing: 'en cocina', served: 'servido', cancelled: 'cancelado' };
  const tone = status === 'checked_in' || status === 'served' ? 'ok'
    : status === 'pending' || status === 'preparing' ? 'warn'
    : status === 'cancelled' ? 'danger' : '';
  return `<span class="badge ${tone}">${labels[status] ?? status}</span>`;
};

async function loadSummary() {
  const s = await api('/api/resumen');
  $('#stats').innerHTML = [
    [s.habitaciones_libres + '/' + s.habitaciones_totales, 'habitaciones libres'],
    [s.llegadas_hoy, 'llegadas hoy'],
    [s.reservas_mesa_hoy, 'reservas de mesa'],
    [s.pedidos_pendientes, 'pedidos abiertos'],
    [new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }), 'hoy'],
  ].map(([n, label]) => `<div class="stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`).join('');
}

async function loadBookings() {
  const { bookings } = await api('/api/hotel/reservas?estado=todas');
  $('#bookings').innerHTML = bookings.map((b) => `
    <tr>
      <td>${esc(b.guest_name)}<br><span class="hint">${esc(b.booking_id)}</span></td>
      <td>${esc(b.room)} · ${esc(b.room_type)}</td>
      <td>${esc(b.checkin)}</td><td>${esc(b.checkout)}</td>
      <td>${badge(b.status)}</td>
      <td class="num">${money.format(b.total)}</td>
      <td>${b.status === 'confirmed' ? `<button class="small" data-checkin="${esc(b.booking_id)}">Check-in</button>` : ''}
          ${b.status === 'checked_in' ? `<button class="small" data-checkout="${esc(b.booking_id)}">Check-out</button>` : ''}</td>
    </tr>`).join('') || '<tr><td colspan="7" class="empty">Sin reservas.</td></tr>';
  bindRows();
}

function bindRows() {
  document.querySelectorAll('[data-checkin]').forEach((btn) => btn.onclick = () => action(`/api/hotel/reservas/${btn.dataset.checkin}/checkin`, 'Check-in hecho'));
  document.querySelectorAll('[data-checkout]').forEach((btn) => btn.onclick = () => action(`/api/hotel/reservas/${btn.dataset.checkout}/checkout`, 'Check-out hecho'));
  document.querySelectorAll('[data-order]').forEach((btn) => btn.onclick = () => action(`/api/restaurante/pedidos/${btn.dataset.order}`, 'Pedido actualizado', 'PATCH', { status: btn.dataset.status }));
}

async function action(path, message, method = 'POST', body = undefined) {
  try {
    await api(path, { method, body });
    toast(message);
    await loadAll();
  } catch (error) { toast(error.message); }
}

async function loadTableReservations() {
  const { reservations } = await api('/api/restaurante/reservas');
  $('#table-reservations').innerHTML = reservations.map((r) => `
    <tr><td>${esc(r.hora)}</td><td>${esc(r.table)}</td><td>${esc(r.personas)}</td>
    <td>${esc(r.name)}<br><span class="hint">${esc(r.reservation_id)}</span></td>
    <td>${badge(r.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Sin reservas de mesa.</td></tr>';
}

async function loadOrders() {
  const { orders } = await api('/api/restaurante/pedidos');
  $('#orders').innerHTML = orders.map((o) => {
    const dest = o.destination
      ? (o.destination.kind === 'room' ? `Hab. ${esc(o.destination.room)} · ${esc(o.destination.guest_name)}` : `${esc(o.destination.table)} · ${esc(o.destination.name)}`)
      : '—';
    const items = o.items.map((i) => `${esc(i.qty)}× ${esc(i.name)}`).join('<br>');
    const next = o.status === 'pending' ? `<button class="small" data-order="${esc(o.order_id)}" data-status="preparing">A cocina</button>`
      : o.status === 'preparing' ? `<button class="small" data-order="${esc(o.order_id)}" data-status="served">Servido</button>` : '';
    return `<tr><td>${esc(o.order_id)}</td><td>${dest}</td><td>${items}</td><td>${badge(o.status)}</td>
      <td class="num">${money.format(o.total)}</td><td>${next}</td></tr>`;
  }).join('') || '<tr><td colspan="6" class="empty">Sin pedidos.</td></tr>';
  bindRows();
}

async function loadAll() {
  try {
    await Promise.all([loadSummary(), loadBookings(), loadTableReservations(), loadOrders()]);
  } catch (error) { toast(error.message); }
}

function fillSelect(select, options, value, placeholder) {
  select.innerHTML = (placeholder ? `<option value="">${esc(placeholder)}</option>` : '')
    + options.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
  if (value) select.value = value;
}

async function init() {
  $('#disp-desde').value = tomorrow;
  $('#res-entrada').value = tomorrow;
  $('#mesa-fecha').value = today;
  $('#mres-fecha').value = today;

  for (const id of ['#disp-noches', '#res-noches']) $(id).innerHTML = [1,2,3,4,5,6,7].map((n) => `<option value="${n}">${n}</option>`).join('');
  for (const id of ['#mesa-hora', '#mres-hora']) $(id).innerHTML = ['13:00','13:30','14:00','14:30','20:00','20:30','21:00','21:30','22:00'].map((h) => `<option>${h}</option>`).join('');
  $('#disp-noches').value = '2';
  $('#res-noches').value = '2';
  $('#mres-hora').value = '21:00';

  try {
    const [types, tables, menu] = await Promise.all([
      api('/api/hotel/tipos'), api('/api/restaurante/mesas'), api('/api/restaurante/carta'),
    ]);
    fillSelect($('#res-tipo'), types.room_types.map((t) => [t.room_type_id, `${t.name} · ${t.capacity} pax · ${money.format(t.price_per_night)}/noche`]));
    if ([...$('#res-tipo').options].some((o) => o.value === 'rt-doble')) $('#res-tipo').value = 'rt-doble';
    fillSelect($('#mesa-id'), tables.tables.map((t) => [t.table_id, `${t.name} (${t.seats} plazas)`]));
    fillSelect($('#pedido-plato'), menu.items.map((m) => [m.item_id, `${m.name} · ${money.format(m.price)}`]));
    fillSelect($('#pedido-booking'), [], '', 'Sin habitación');
    fillSelect($('#pedido-table'), [], '', 'Sin mesa');
    await loadAll();
    await refreshOrderTargets();
  } catch (error) { toast(error.message); }
}

async function refreshOrderTargets() {
  const [{ bookings }, { reservations }] = await Promise.all([
    api('/api/hotel/reservas?estado=hoy'), api('/api/restaurante/reservas'),
  ]);
  let currentBooking = $('#pedido-booking').value;
  const currentTable = $('#pedido-table').value;
  if (!currentBooking && bookings.length) currentBooking = bookings[0].booking_id;
  fillSelect($('#pedido-booking'), bookings.map((b) => [b.booking_id, `${b.room} · ${b.guest_name}`]), currentBooking, 'Sin habitación');
  fillSelect($('#pedido-table'), reservations.map((r) => [r.reservation_id, `${r.table} · ${r.hora} · ${r.name}`]), currentTable, 'Sin mesa');
}

$('#form-disponibilidad').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    const res = await api(`/api/hotel/disponibilidad?desde=${encodeURIComponent(data.desde)}&noches=${data.noches}&personas=${data.personas}`);
    $('#disp-resultado').innerHTML = res.results.length
      ? res.results.map((r) => `<div><span class="pill">${esc(r.room_type_id)}</span> <strong>${esc(r.name)}</strong> · ${r.free_rooms} libres · ${money.format(r.total)} (${r.nights} noches)</div>`).join('')
      : 'No hay habitaciones libres para esas fechas.';
  } catch (error) { $('#disp-resultado').textContent = error.message; }
};

$('#form-reserva').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.nights = Number(data.nights); data.guests = Number(data.guests);
  try {
    const booking = await api('/api/hotel/reservas', { method: 'POST', body: data });
    toast(`Reserva ${booking.booking_id} creada · ${money.format(booking.total)}`);
    event.target.reset();
    $('#res-entrada').value = tomorrow;
    $('#res-noches').value = '2';
    await loadAll();
    await refreshOrderTargets();
  } catch (error) { toast(error.message); }
};

$('#form-mesas').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  try {
    const res = await api(`/api/restaurante/mesas?fecha=${encodeURIComponent(data.fecha)}&hora=${encodeURIComponent(data.hora)}&personas=${data.personas}`);
    $('#mesas-resultado').innerHTML = res.tables.length
      ? res.tables.map((t) => `<div><span class="pill">${esc(t.table_id)}</span> <strong>${esc(t.name)}</strong> · ${t.seats} plazas</div>`).join('')
      : 'No quedan mesas libres para esa franja.';
  } catch (error) { $('#mesas-resultado').textContent = error.message; }
};

$('#form-mesa').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.personas = Number(data.personas);
  try {
    const reservation = await api('/api/restaurante/reservas', { method: 'POST', body: data });
    toast(`Mesa ${reservation.table} reservada a las ${reservation.hora}`);
    await loadAll();
    await refreshOrderTargets();
  } catch (error) { toast(error.message); }
};

$('#form-pedido').onsubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  data.qty = Number(data.qty);
  if (!data.booking_id) delete data.booking_id;
  if (!data.table_reservation_id) delete data.table_reservation_id;
  try {
    const order = await api('/api/restaurante/pedidos', { method: 'POST', body: data });
    toast(`Pedido ${order.order_id} enviado a cocina · ${money.format(order.total)}`);
    await loadAll();
  } catch (error) { toast(error.message); }
};

init();
</script>
</body>
</html>
"""
