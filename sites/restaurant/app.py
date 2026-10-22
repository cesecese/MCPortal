"""Casa Zeta: restaurante de demostración con HTML renderizado en servidor y CSRF.

Forma parte del atrezo de MCPortal: pone a prueba las herramientas de navegador y
la elección entre implementación http y browser (el POST del formulario exige un
token CSRF ligado a una cookie de sesión, así que no se puede reproducir con una
petición HTTP simple).

Arranque:  uvicorn sites.restaurant.app:app --port 8002
"""

from __future__ import annotations

import hashlib
import html
import secrets
from datetime import date as date_type
from typing import Any

from fastapi import Cookie, FastAPI, Form, Query
from fastapi.responses import HTMLResponse, JSONResponse

app = FastAPI(title="Casa Zeta")

SLOTS = ["13:00", "13:30", "14:00", "14:30", "20:00", "20:30", "21:00", "21:30", "22:00"]
TABLES_PER_SLOT = 4

RESERVATIONS: dict[str, dict[str, Any]] = {}
VALID_TOKENS: set[str] = set()


# --------------------------------------------------------------------------- #
# Lógica
# --------------------------------------------------------------------------- #


def _is_free(day: str, slot: str, people: int) -> bool:
    """Disponibilidad determinista: hash de fecha+hora y mesas restantes."""
    if sum(1 for r in RESERVATIONS.values() if r["date"] == day and r["time"] == slot) >= TABLES_PER_SLOT:
        return False
    digest = int(hashlib.md5(f"{day}{slot}".encode()).hexdigest(), 16)
    return digest % 10 < 10 - min(people, 8)


def _free_slots(day: str, people: int) -> list[str]:
    return [slot for slot in SLOTS if _is_free(day, slot, people)]


def _valid_day(value: str) -> bool:
    try:
        date_type.fromisoformat(value)
        return True
    except ValueError:
        return False


def _reservation(code: str) -> dict[str, Any] | None:
    return RESERVATIONS.get(code.strip().upper())


# --------------------------------------------------------------------------- #
# Plantilla
# --------------------------------------------------------------------------- #

CSS = """
:root { --paper:#faf7f0; --ink:#211d17; --muted:#6f675c; --line:#e0d8c8; --wine:#7d2430; --green:#2f6b4f; }
* { box-sizing:border-box; }
body { margin:0; background:var(--paper); color:var(--ink);
       font:16px/1.6 Georgia,"Times New Roman",serif; }
header.site { border-bottom:1px solid var(--line); padding:16px 28px; display:flex;
              align-items:baseline; justify-content:space-between; gap:18px; flex-wrap:wrap; }
header.site .brand { font-size:22px; letter-spacing:.02em; }
header.site .brand span { color:var(--wine); }
header.site nav { display:flex; gap:16px; flex-wrap:wrap; font:14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
header.site nav a { color:var(--muted); text-decoration:none; }
header.site nav a:hover { color:var(--wine); }
main { max-width:860px; margin:0 auto; padding:32px 28px 70px; }
h1 { font-size:30px; margin:0 0 8px; letter-spacing:-.01em; }
h2 { font-size:21px; margin:28px 0 10px; }
p.lead { color:var(--muted); margin-top:0; }
a { color:var(--wine); }
form.card { border:1px solid var(--line); background:#fffdf8; border-radius:6px; padding:18px; margin:18px 0; }
form.card .row { display:flex; gap:12px; flex-wrap:wrap; align-items:flex-end; }
form.card label { display:block; font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
                  color:var(--muted); margin-bottom:4px; }
form.card input, form.card select { font:inherit; padding:8px 10px; border:1px solid var(--line);
                  border-radius:4px; background:#fff; min-width:150px; }
form.card button { font:15px/1 Georgia,serif; padding:10px 18px; border:1px solid var(--wine);
                  background:var(--wine); color:#fff8ee; border-radius:4px; cursor:pointer; }
form.card button:hover { background:#651d26; }
table.slots { width:100%; border-collapse:collapse; margin:14px 0; }
table.slots th, table.slots td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--line); }
table.slots a { display:inline-block; padding:5px 12px; border:1px solid var(--line);
                border-radius:4px; text-decoration:none; font:14px/1.4 -apple-system,sans-serif; }
table.slots a:hover { border-color:var(--wine); }
.notice { padding:14px 16px; border-left:3px solid var(--wine); background:#fffdf8; margin:18px 0; }
.notice.ok { border-color:var(--green); }
.notice.error { border-color:var(--wine); }
.big-code { font:26px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.08em; }
ul.menu { list-style:none; padding:0; }
ul.menu li { padding:10px 0; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; gap:20px; }
ul.menu li span { color:var(--muted); }
footer { border-top:1px solid var(--line); padding:16px 28px; color:var(--muted);
         font:13px/1.4 -apple-system,sans-serif; }
"""


def layout(title: str, body: str, *, status_code: int = 200) -> HTMLResponse:
    page = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)} · Casa Zeta</title>
<style>{CSS}</style>
</head>
<body>
<header class="site">
  <div class="brand">Casa <span>Zeta</span></div>
  <nav>
    <a href="/">Inicio</a>
    <a href="/menu">Menú</a>
    <a href="/disponibilidad">Disponibilidad</a>
    <a href="/reserva">Consultar reserva</a>
  </nav>
</header>
<main>
{body}
</main>
<footer>Casa Zeta · Cocina de mercado · Calle del Puerto 14 · 28001 Madrid</footer>
</body>
</html>"""
    return HTMLResponse(page, status_code=status_code)


def availability_form(day: str = "", people: str = "") -> str:
    return f"""<form class="card" method="get" action="/disponibilidad">
  <div class="row">
    <div><label for="date">Fecha</label>
      <input id="date" name="date" type="date" value="{html.escape(day)}" required></div>
    <div><label for="people">Comensales</label>
      <input id="people" name="people" type="number" min="1" max="12" value="{html.escape(people)}" required></div>
    <button type="submit">Buscar mesa</button>
  </div>
</form>"""


def slots_table(day: str, people: int, slots: list[str]) -> str:
    rows = "".join(
        f'<tr><td>{slot}</td><td>{people} comensales</td>'
        f'<td><a href="/reservar?date={day}&amp;time={slot}&amp;people={people}">Reservar</a></td></tr>'
        for slot in slots
    )
    return f"""<table class="slots">
  <thead><tr><th>Hora</th><th>Mesa</th><th></th></tr></thead>
  <tbody>{rows}</tbody>
</table>"""


# --------------------------------------------------------------------------- #
# Páginas
# --------------------------------------------------------------------------- #


@app.get("/", response_class=HTMLResponse)
def home() -> HTMLResponse:
    body = """
<h1>Cocina de mercado, sin prisa</h1>
<p class="lead">Producto de temporada, brasa y una carta corta que cambia cada semana.</p>
<p><a href="/disponibilidad">Reservar mesa</a> · <a href="/menu">Ver el menú</a></p>
<h2>Consultar una reserva</h2>
<form class="card" method="get" action="/reserva">
  <div class="row">
    <div><label for="code">Código de reserva</label>
      <input id="code" name="code" type="text" placeholder="R-XXXXXX"></div>
    <button type="submit">Consultar reserva</button>
  </div>
</form>
"""
    return layout("Inicio", body)


@app.get("/menu", response_class=HTMLResponse)
def menu() -> HTMLResponse:
    body = """
<h1>Menú de la semana</h1>
<p class="lead">Trienta euros por persona. Pan de masa madre y aperitivo incluidos.</p>
<ul class="menu">
  <li><strong>Alcachofas a la brasa</strong><span>romesco, avellana tostada</span></li>
  <li><strong>Croquetas de jamón</strong><span>6 unidades</span></li>
  <li><strong>Merluza del pincho</strong><span>pil-pil de perejil</span></li>
  <li><strong>Costilla de cerdo ibérico</strong><span>puré de manzana asada</span></li>
  <li><strong>Tarta de queso</strong><span>mermelada de tomate</span></li>
</ul>
<p><a href="/disponibilidad">Reservar mesa</a></p>
"""
    return layout("Menú", body)


@app.get("/disponibilidad", response_class=HTMLResponse)
def availability(date: str = Query(""), people: str = Query("")) -> HTMLResponse:
    if not date and not people:
        body = f"""
<h1>Disponibilidad</h1>
<p class="lead">Elige fecha y número de comensales. Cada servicio tiene cuatro mesas.</p>
{availability_form()}
"""
        return layout("Disponibilidad", body)

    if not date or not people:
        return layout("Disponibilidad", '<div class="notice error">Indica la fecha y el número de comensales.</div>', status_code=400)
    if not _valid_day(date):
        return layout("Disponibilidad", '<div class="notice error">La fecha no es válida.</div>', status_code=400)
    try:
        diners = int(people)
    except ValueError:
        return layout("Disponibilidad", '<div class="notice error">El número de comensales no es válido.</div>', status_code=400)
    if not 1 <= diners <= 12:
        return layout("Disponibilidad", '<div class="notice error">El número de comensales debe estar entre 1 y 12.</div>', status_code=400)

    free = _free_slots(date, diners)
    if free:
        result = f'<h2>Mesas libres para {diners} comensales el {html.escape(date)}</h2>{slots_table(date, diners, free)}'
    else:
        result = ('<div class="notice">No quedan mesas para esa fecha y ese número de comensales. '
                  'Prueba otro día o menos comensales.</div>')

    body = f"""
<h1>Disponibilidad</h1>
{availability_form(date, people)}
{result}
"""
    return layout("Disponibilidad", body)


@app.get("/reservar", response_class=HTMLResponse)
def reservation_form(
    date: str = Query(""),
    time: str = Query(""),
    people: str = Query(""),
) -> HTMLResponse:
    token = secrets.token_hex(16)
    VALID_TOKENS.add(token)
    selected_time = time if time in SLOTS else SLOTS[0]
    options = "".join(
        f'<option value="{slot}"{" selected" if slot == selected_time else ""}>{slot}</option>'
        for slot in SLOTS
    )
    diners = people if people.isdigit() and 1 <= int(people) <= 12 else "2"
    body = f"""
<h1>Reservar mesa</h1>
<p class="lead">Déjanos tus datos y te guardamos la mesa.</p>
<form class="card" method="post" action="/reservar">
  <input type="hidden" name="csrf_token" value="{token}">
  <div class="row">
    <div><label for="name">Nombre</label>
      <input id="name" name="name" type="text" required></div>
    <div><label for="phone">Teléfono</label>
      <input id="phone" name="phone" type="tel" required></div>
  </div>
  <div class="row" style="margin-top:12px">
    <div><label for="date">Fecha</label>
      <input id="date" name="date" type="date" value="{html.escape(date)}" required></div>
    <div><label for="time">Hora</label>
      <select id="time" name="time">{options}</select></div>
    <div><label for="people">Comensales</label>
      <input id="people" name="people" type="number" min="1" max="12" value="{diners}" required></div>
    <button type="submit">Confirmar reserva</button>
  </div>
</form>
<p><a href="/disponibilidad?date={html.escape(date)}&amp;people={diners}">Ver otras horas</a></p>
"""
    response = layout("Reservar", body)
    response.set_cookie("session", token, httponly=True, samesite="lax")
    return response


@app.post("/reservar", response_class=HTMLResponse)
def make_reservation(
    csrf_token: str = Form(""),
    name: str = Form(""),
    phone: str = Form(""),
    date: str = Form(""),
    time: str = Form(""),
    people: int = Form(0),
    session: str | None = Cookie(default=None),
) -> HTMLResponse:
    if not session or session != csrf_token or csrf_token not in VALID_TOKENS:
        return layout("Error", '<h1>Token CSRF inválido</h1>'
                              '<div class="notice error">La sesión ha caducado. Vuelve a cargar el formulario de reserva.</div>'
                              '<p><a href="/reservar">Volver al formulario</a></p>', status_code=403)

    if not name.strip() or not phone.strip() or not _valid_day(date) or time not in SLOTS or not 1 <= people <= 12:
        return layout("Error", '<h1>Datos no válidos</h1>'
                              '<div class="notice error">Revisa el nombre, el teléfono, la fecha, la hora y los comensales.</div>'
                              '<p><a href="/reservar">Volver al formulario</a></p>', status_code=400)

    if not _is_free(date, time, people):
        return layout("Sin disponibilidad", f"""
<h1>No queda mesa</h1>
<div class="notice error">No tenemos mesa para {people} comensales el {html.escape(date)} a las {time}.</div>
<p><a href="/disponibilidad?date={html.escape(date)}&amp;people={people}">Ver otras horas</a></p>
""", status_code=409)

    VALID_TOKENS.discard(csrf_token)
    code = "R-" + secrets.token_hex(3).upper()
    while code in RESERVATIONS:
        code = "R-" + secrets.token_hex(3).upper()
    RESERVATIONS[code] = {
        "code": code, "name": name.strip(), "phone": phone.strip(),
        "date": date, "time": time, "people": people,
    }
    body = f"""
<h1>Reserva confirmada</h1>
<div class="notice ok">
  <p>Gracias, {html.escape(name.strip())}. Te esperamos el <strong>{html.escape(date)}</strong>
  a las <strong>{time}</strong> para <strong>{people}</strong> comensales.</p>
  <p>Tu código de reserva es <span class="big-code">{code}</span></p>
</div>
<p><a href="/reserva?code={code}">Consultar esta reserva</a> · <a href="/menu">Ver el menú</a></p>
"""
    response = layout("Reserva confirmada", body)
    response.delete_cookie("session")
    return response


@app.get("/reserva", response_class=HTMLResponse)
def check_reservation(code: str = Query("")) -> HTMLResponse:
    reservation = _reservation(code)
    if reservation is None:
        body = f"""
<h1>Consultar reserva</h1>
<div class="notice">No existe ninguna reserva con el código «{html.escape(code)}».</div>
<form class="card" method="get" action="/reserva">
  <div class="row">
    <div><label for="code">Código de reserva</label>
      <input id="code" name="code" type="text" value="{html.escape(code)}" placeholder="R-XXXXXX"></div>
    <button type="submit">Consultar reserva</button>
  </div>
</form>
"""
        return layout("Reserva", body)

    body = f"""
<h1>Reserva {reservation["code"]}</h1>
<div class="notice ok">
  <p>A nombre de <strong>{html.escape(reservation["name"])}</strong>.</p>
  <p>Fecha: <strong>{reservation["date"]}</strong> · Hora: <strong>{reservation["time"]}</strong>
     · Comensales: <strong>{reservation["people"]}</strong></p>
  <p>Teléfono de contacto: {html.escape(reservation["phone"])}</p>
</div>
<p><a href="/menu">Ver el menú</a></p>
"""
    return layout("Reserva", body)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "site": "casa-zeta"})
