"""Gestoría Meridian: software interno de demostración (HTML + API JSON).

Caso de uso «software interno sin API»: buscador de clientes, ficha, alta de
cliente con validación, CSRF y subida real de un balance en PDF.

Arranque:  uvicorn sites.gestoria.app:app --port 8003
"""

from __future__ import annotations

import html
import secrets
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import Cookie, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse

app = FastAPI(title="Gestoría Meridian")

BASE = Path(__file__).resolve().parent
DOCUMENTS = BASE / "documents"
UPLOADS = BASE / "uploads"
SAMPLE = BASE / "samples" / "balance-ejemplo.pdf"
DOCUMENTS.mkdir(parents=True, exist_ok=True)
UPLOADS.mkdir(parents=True, exist_ok=True)

ADVISORS = [
    {"id": "elena", "name": "Elena Ruiz"},
    {"id": "marcos", "name": "Marcos Gil"},
    {"id": "lucia", "name": "Lucía Santos"},
]
TYPES = [("empresa", "Empresa"), ("autonomo", "Autónomo"), ("particular", "Particular")]
STATUSES = [("activo", "Activo"), ("pendiente", "Pendiente"), ("inactivo", "Inactivo")]

CLIENTS: list[dict[str, Any]] = [
    {"id": "CL-2026-0001", "nombre": "Marta", "apellidos": "Rivas Peña",
     "telefono": "600 112 233", "email": "marta@talleresrivas.es", "cif": "B87451209",
     "direccion": "Calle Alcalá 45", "ciudad": "Madrid", "cp": "28014", "provincia": "Madrid",
     "tipo": "empresa", "iban": "ES91 2100 0418 4502 0005 1332", "fecha_alta": "2024-01-15",
     "asesor": "elena", "estado": "activo", "notas": "Cliente histórico. IVA trimestral.",
     "balance": "balance-2025-ejemplo.pdf", "created_at": "2024-01-15"},
]
NEXT_NUMBER = len(CLIENTS) + 1
TOKENS: set[str] = set()

TYPES_MAP = dict(TYPES)
STATUSES_MAP = dict(STATUSES)
ADVISORS_MAP = {advisor["id"]: advisor["name"] for advisor in ADVISORS}

CSS = """
:root{--navy:#14213d;--navy-2:#1d3157;--gold:#c59a3d;--paper:#f4f6f9;--card:#fff;--ink:#1c2533;
--muted:#6b7686;--line:#dfe5ec;--ok:#1f7a4d;--warn:#b7791f;--bad:#a33b3b}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
a{color:#1f4e79}
.app{display:flex;min-height:100vh}
.side{width:232px;background:var(--navy);color:#e9eef7;padding:24px 18px;display:flex;flex-direction:column;gap:26px}
.brand{font-size:20px;letter-spacing:.02em;font-weight:600}
.brand span{color:var(--gold)}
.brand small{display:block;font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#93a4bf;margin-top:4px}
.side nav{display:flex;flex-direction:column;gap:4px}
.side nav a{color:#c9d5e6;text-decoration:none;padding:9px 11px;border-radius:5px;font-size:14px}
.side nav a:hover,.side nav a.active{background:var(--navy-2);color:#fff}
.side .session{margin-top:auto;border-top:1px solid #2c4167;padding-top:16px;font-size:12px;color:#9fb0c9}
.side .session strong{display:block;color:#fff;font-size:13px}
.main{flex:1;min-width:0}
.top{height:58px;border-bottom:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 30px}
.top .crumb{color:var(--muted);font-size:13px}
.top .demo{font-size:12px;color:#8a6a21;background:#fbf4e2;border:1px solid #ead9b5;padding:4px 9px;border-radius:999px}
.page{padding:28px 30px 60px;max-width:1180px}
h1{font-size:26px;letter-spacing:-.02em;margin:0 0 4px}
h2{font-size:18px;margin:0 0 12px}
.lede{color:var(--muted);margin:0 0 22px}
.grid{display:grid;gap:16px}
.kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:18px}
.kpi .n{font-size:27px;font-weight:600;letter-spacing:-.03em}
.kpi .l{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
.kpi .s{color:var(--muted);font-size:12px;margin-top:6px}
.cols{display:grid;grid-template-columns:1.45fr .8fr;gap:18px;margin-top:18px}
table{width:100%;border-collapse:collapse}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);text-align:left;padding:8px 10px;border-bottom:1px solid var(--line)}
td{padding:11px 10px;border-bottom:1px solid #edf1f5;font-size:14px;vertical-align:middle}
tr:last-child td{border-bottom:0}
.badge{display:inline-block;font-size:11px;padding:2px 7px;border-radius:999px;border:1px solid}
.badge.activo{color:var(--ok);border-color:#bfe3d0;background:#eef8f2}
.badge.pendiente{color:var(--warn);border-color:#ecd7aa;background:#fdf7e8}
.badge.inactivo{color:var(--bad);border-color:#eccaca;background:#fbf0f0}
.badge.empresa{color:#1f4e79;border-color:#c7d8e8;background:#eef4fa}
.badge.autonomo{color:#6b4fa0;border-color:#d9cfea;background:#f4f0fb}
.badge.particular{color:#57616f;border-color:#dde2e8;background:#f4f6f8}
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--navy);background:var(--navy);color:#fff;
padding:8px 14px;border-radius:5px;text-decoration:none;font-size:14px;cursor:pointer}
.btn:hover{background:#0d1830}
.btn--outline{background:#fff;color:var(--navy)}
.btn--ghost{background:transparent;color:var(--ink);border-color:var(--line)}
.btn--sm{padding:5px 10px;font-size:12px}
.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:16px 0}
.toolbar form{display:flex;gap:8px;flex-wrap:wrap;flex:1}
input,select,textarea{font:inherit;border:1px solid var(--line);border-radius:5px;padding:8px 10px;background:#fff;color:var(--ink)}
input:focus,select:focus,textarea:focus{outline:2px solid #b9cbe0;outline-offset:1px}
.search-q{flex:1 1 260px}
.table-card{padding:0;overflow:hidden}
.scroll{overflow-x:auto}
.empty{padding:30px;color:var(--muted);text-align:center}
.detail{margin-top:18px}
.detail h2{font-size:20px}
.meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 24px;margin:14px 0}
.meta dt{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.07em}
.meta dd{margin:2px 0 0;font-size:14px}
.form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px}
.field{display:flex;flex-direction:column;gap:5px}
.field.full{grid-column:1/-1}
.field label{font-size:12px;font-weight:600;color:#3d4a5c}
.field .hint{font-size:11px;color:var(--muted);font-weight:400}
.field input,.field select,.field textarea{width:100%}
fieldset{border:0;padding:0;margin:0 0 6px}
legend{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:#3d4a5c;margin-bottom:10px}
.checks{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#3d4a5c;margin:14px 0}
.checks input{margin-top:3px}
.actions{display:flex;gap:10px;align-items:center;margin-top:22px}
.notice{border-left:3px solid var(--gold);background:#fdf8ec;padding:10px 14px;font-size:13px;margin:14px 0}
.notice.error{border-color:var(--bad);background:#fbf0f0}
.doc-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #edf1f5}
.doc-row:last-child{border-bottom:0}
.doc-name{font-size:13px}
.doc-meta{font-size:11px;color:var(--muted)}
.muted{color:var(--muted)}
.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
@media(max-width:900px){.side{width:74px;padding:18px 10px}.brand small,.side nav a span,.side .session{display:none}.brand{font-size:16px}
.kpis{grid-template-columns:repeat(2,1fr)}.cols{grid-template-columns:1fr}.meta{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.app{display:block}.side{width:100%;flex-direction:row;align-items:center;gap:14px;padding:12px 16px}
.side nav{flex-direction:row;flex-wrap:wrap}.side .session{margin:0}.page{padding:20px 16px 50px}.top{padding:0 16px}
.form-grid{grid-template-columns:1fr}.meta{grid-template-columns:1fr}.kpis{grid-template-columns:1fr 1fr}}
"""

JS = """
const form = document.getElementById('client-search');
const rows = document.getElementById('client-rows');
const detail = document.getElementById('client-detail');
const empty = document.getElementById('client-empty');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const badge = (kind, value, label) => `<span class="badge ${kind}">${esc(label ?? value)}</span>`;
async function load() {
  const params = new URLSearchParams();
  const data = new FormData(form);
  for (const [k, v] of data) if (v) params.set(k, v);
  const res = await fetch('/api/clients' + (params.toString() ? '?' + params.toString() : ''));
  const body = await res.json();
  empty.hidden = body.clients.length > 0;
  rows.innerHTML = body.clients.map(c => `
    <tr>
      <td><strong>${esc(c.nombre)} ${esc(c.apellidos)}</strong><div class="doc-meta mono">${esc(c.id)}</div></td>
      <td class="mono">${esc(c.cif)}</td>
      <td>${badge(c.tipo, c.tipo, c.tipo_label)}</td>
      <td>${badge(c.estado, c.estado, c.estado_label)}</td>
      <td>${esc(c.asesor_nombre)}</td>
      <td><button class="btn btn--outline btn--sm" type="button" data-id="${esc(c.id)}">Ver ficha</button></td>
    </tr>`).join('');
  rows.querySelectorAll('button[data-id]').forEach(button => {
    button.addEventListener('click', () => showClient(button.dataset.id));
  });
}
async function showClient(id) {
  const res = await fetch('/api/clients/' + encodeURIComponent(id));
  if (!res.ok) { detail.innerHTML = '<div class="notice error">No se pudo cargar la ficha.</div>'; return; }
  const c = (await res.json()).client;
  detail.innerHTML = `
    <div class="card detail">
      <h2>${esc(c.nombre)} ${esc(c.apellidos)} <span class="mono muted">${esc(c.id)}</span></h2>
      <div style="margin:8px 0">${badge(c.tipo, c.tipo, c.tipo_label)} ${badge(c.estado, c.estado, c.estado_label)}</div>
      <dl class="meta">
        <div><dt>CIF</dt><dd class="mono">${esc(c.cif)}</dd></div>
        <div><dt>Teléfono</dt><dd>${esc(c.telefono)}</dd></div>
        <div><dt>Email</dt><dd>${esc(c.email)}</dd></div>
        <div><dt>Dirección</dt><dd>${esc(c.direccion)}, ${esc(c.ciudad)} ${esc(c.cp)}</dd></div>
        <div><dt>Asesor</dt><dd>${esc(c.asesor_nombre)}</dd></div>
        <div><dt>Balance</dt><dd>${c.balance ? 'Disponible' : 'Pendiente'}</dd></div>
      </dl>
      <p class="muted">${esc(c.notas || 'Sin notas.')}</p>
      <a class="btn btn--outline btn--sm" href="/clientes/${encodeURIComponent(c.id)}">Abrir ficha completa</a>
    </div>`;
}
form.addEventListener('submit', (event) => { event.preventDefault(); load(); });
const nameForm = document.getElementById('name-search');
nameForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = nameForm.elements.namedItem('name').value;
  const res = await fetch('/api/clients/by-name?name=' + encodeURIComponent(value));
  const body = await res.json();
  if (body.client) { await showClient(body.client.id); }
  else { detail.innerHTML = '<div class="notice">' + esc(body.message || 'No se encontró el cliente.') + '</div>'; }
});
load();
"""


def esc(value: Any) -> str:
    return html.escape(str(value or ""))


def norm(value: str) -> str:
    text = unicodedata.normalize("NFKD", value.casefold())
    return "".join(char for char in text if not unicodedata.combining(char)).strip()


def options(items: list[tuple[str, str]], selected: str = "") -> str:
    return "".join(
        f'<option value="{esc(value)}"{" selected" if value == selected else ""}>{esc(label)}</option>'
        for value, label in items
    )


def advisor_name(advisor_id: str) -> str:
    return ADVISORS_MAP.get(advisor_id, advisor_id)


def find_client(client_id: str) -> dict[str, Any] | None:
    return next((client for client in CLIENTS if client["id"] == client_id), None)


def badge(kind: str, value: str, label: str) -> str:
    return f'<span class="badge {esc(kind)}">{esc(label or value)}</span>'


def type_label(value: str) -> str:
    return TYPES_MAP.get(value, value)


def status_label(value: str) -> str:
    return STATUSES_MAP.get(value, value)


def layout(title: str, body: str, active: str = "", status_code: int = 200) -> HTMLResponse:
    nav = [("Resumen", "/", "home"), ("Clientes", "/clientes", "clients"),
           ("Documentos", "/documentos", "docs")]
    links = "".join(
        f'<a href="{href}" class="{"active" if key == active else ""}"><span>{label}</span></a>'
        for label, href, key in nav
    )
    page = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} · Gestoría Meridian</title>
<style>{CSS}</style>
</head>
<body>
<div class="app">
  <aside class="side">
    <div class="brand">Meridian<span>.</span><small>Gestión fiscal y contable</small></div>
    <nav aria-label="Principal">{links}</nav>
    <div class="session"><strong>Elena Ruiz</strong>Asesora · sesión de demo</div>
  </aside>
  <div class="main">
    <header class="top">
      <span class="crumb">Gestoría / {esc(title)}</span>
      <span class="demo">Entorno de demostración · datos ficticios</span>
    </header>
    <main class="page">
{body}
    </main>
  </div>
</div>
</body>
</html>"""
    return HTMLResponse(page, status_code=status_code)


def client_row(client: dict[str, Any]) -> str:
    return f"""<tr>
      <td><strong>{esc(client['nombre'])} {esc(client['apellidos'])}</strong>
        <div class="doc-meta mono">{esc(client['id'])}</div></td>
      <td class="mono">{esc(client['cif'])}</td>
      <td>{badge('empresa' if client['tipo'] == 'empresa' else 'autonomo' if client['tipo'] == 'autonomo' else 'particular', client['tipo'], type_label(client['tipo']))}</td>
      <td>{badge(client['estado'], client['estado'], status_label(client['estado']))}</td>
      <td>{esc(advisor_name(client['asesor']))}</td>
      <td><a class="btn btn--outline btn--sm" href="/clientes/{esc(client['id'])}">Abrir ficha</a></td>
    </tr>"""


def client_payload(client: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": client["id"], "nombre": client["nombre"], "apellidos": client["apellidos"],
        "cif": client["cif"], "telefono": client["telefono"], "email": client["email"],
        "direccion": client["direccion"], "ciudad": client["ciudad"], "cp": client["cp"],
        "provincia": client["provincia"], "tipo": client["tipo"], "tipo_label": type_label(client["tipo"]),
        "estado": client["estado"], "estado_label": status_label(client["estado"]),
        "asesor": client["asesor"], "asesor_nombre": advisor_name(client["asesor"]),
        "fecha_alta": client["fecha_alta"], "iban": client["iban"], "notas": client["notas"],
        "balance": client["balance"], "cif_duplicado": client.get("cif_duplicado", False),
    }


def client_detail(client: dict[str, Any]) -> str:
    balance = "Sin balance adjunto"
    if client["balance"]:
        balance = (f'<a class="btn btn--outline btn--sm" data-agent-skip '
                   f'href="/clientes/{esc(client["id"])}/balance">Descargar PDF</a>')
    return f"""
<a class="btn btn--ghost btn--sm" href="/clientes">← Volver a clientes</a>
<div class="card detail" style="margin-top:14px">
  <h2>{esc(client['nombre'])} {esc(client['apellidos'])} <span class="mono muted">{esc(client['id'])}</span></h2>
  <div style="margin:10px 0">
    {badge('empresa' if client['tipo'] == 'empresa' else 'autonomo' if client['tipo'] == 'autonomo' else 'particular', client['tipo'], type_label(client['tipo']))}
    {badge(client['estado'], client['estado'], status_label(client['estado']))}
  </div>
  {('<div class="notice">Ya existe otro cliente con el CIF ' + esc(client["cif"]) + '. Revisa si es un duplicado.</div>') if client.get("cif_duplicado") else ''}
  <dl class="meta">
    <div><dt>CIF / NIF</dt><dd class="mono">{esc(client['cif'])}</dd></div>
    <div><dt>Teléfono</dt><dd>{esc(client['telefono'])}</dd></div>
    <div><dt>Email</dt><dd>{esc(client['email'])}</dd></div>
    <div><dt>Dirección</dt><dd>{esc(client['direccion'])}</dd></div>
    <div><dt>Ciudad</dt><dd>{esc(client['ciudad'])} · {esc(client['cp'])} · {esc(client['provincia'])}</dd></div>
    <div><dt>Fecha de alta</dt><dd>{esc(client['fecha_alta'])}</dd></div>
    <div><dt>Asesor asignado</dt><dd>{esc(advisor_name(client['asesor']))}</dd></div>
    <div><dt>IBAN</dt><dd class="mono">{esc(client['iban'] or '—')}</dd></div>
    <div><dt>Balance de situación</dt><dd>{balance}</dd></div>
  </dl>
  <h2 style="font-size:16px;margin-top:24px">Notas</h2>
  <p class="muted">{esc(client['notas'] or 'Sin notas.')}</p>
  <h2 style="font-size:16px;margin-top:22px">Actividad</h2>
  <div class="doc-row"><span class="doc-name">Ficha creada</span><span class="doc-meta">{esc(client['created_at'])}</span></div>
  {('<div class="doc-row"><span class="doc-name">Balance de situación adjunto</span><span class="doc-meta mono">' + esc(client["balance"]) + '</span></div>') if client["balance"] else ''}
</div>"""


@app.get("/", response_class=HTMLResponse)
def dashboard() -> HTMLResponse:
    active = [c for c in CLIENTS if c["estado"] == "activo"]
    pending = [c for c in CLIENTS if c["estado"] == "pendiente"]
    with_balance = [c for c in CLIENTS if c["balance"]]
    recent = "".join(client_row(client) for client in CLIENTS[:5])
    body = f"""
<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
  <div><h1>Resumen de la gestoría</h1><p class="lede">Clientes, balances y obligaciones del despacho.</p></div>
  <a class="btn" href="/clientes/nuevo">+ Nuevo cliente</a>
</div>
<div class="grid kpis">
  <div class="card kpi"><div class="n">{len(active)}</div><div class="l">Clientes activos</div><div class="s">{len(CLIENTS)} fichas en total</div></div>
  <div class="card kpi"><div class="n">{len(with_balance)}</div><div class="l">Balances recibidos</div><div class="s">Ejercicio 2025</div></div>
  <div class="card kpi"><div class="n">{len(pending)}</div><div class="l">Pendientes</div><div class="s">Documentación por completar</div></div>
  <div class="card kpi"><div class="n">3</div><div class="l">Obligaciones esta semana</div><div class="s">IVA · IRPF · Sociedades</div></div>
</div>
<div class="cols">
  <div>
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2 style="margin:0">Últimos clientes</h2><a href="/clientes">Ver todos →</a>
    </div>
    <div class="card table-card" style="margin-top:12px"><div class="scroll"><table>
      <thead><tr><th>Cliente</th><th>CIF</th><th>Tipo</th><th>Estado</th><th>Asesor</th><th></th></tr></thead>
      <tbody>{recent}</tbody>
    </table></div></div>
  </div>
  <div class="card">
    <h2>Agenda fiscal</h2>
    <div class="doc-row"><span class="doc-name">Presentar IVA 3T</span><span class="doc-meta">20 oct</span></div>
    <div class="doc-row"><span class="doc-name">Nóminas de octubre</span><span class="doc-meta">31 oct</span></div>
    <div class="doc-row"><span class="doc-name">Modelo 111</span><span class="doc-meta">20 nov</span></div>
    <div class="doc-row"><span class="doc-name">Cierre de balances</span><span class="doc-meta">15 dic</span></div>
    <p class="muted" style="margin-top:16px;font-size:12px">Demo con datos ficticios. No se presentan declaraciones reales.</p>
  </div>
</div>"""
    return layout("Resumen", body, "home")


@app.get("/clientes", response_class=HTMLResponse)
def clients_page() -> HTMLResponse:
    body = f"""
<div style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap">
  <div><h1>Clientes</h1><p class="lede">Busca por nombre, CIF o email y abre la ficha del cliente.</p></div>
  <a class="btn" href="/clientes/nuevo">+ Nuevo cliente</a>
</div>
<div class="toolbar">
  <form id="client-search" method="get" action="/clientes">
    <input class="search-q" type="search" name="q" placeholder="Nombre, CIF o email" aria-label="Buscar clientes">
    <select name="estado" aria-label="Estado">
      <option value="">Todos los estados</option>{options(STATUSES)}
    </select>
    <select name="tipo" aria-label="Tipo">
      <option value="">Todos los tipos</option>{options(TYPES)}
    </select>
    <button class="btn" type="submit">Buscar</button>
  </form>
</div>
<div class="toolbar">
  <form id="name-search" method="get" action="/clientes">
    <input class="search-q" type="search" name="name" placeholder="Nombre y apellidos exactos" aria-label="Buscar por nombre">
    <button class="btn btn--outline" type="submit">Buscar por nombre</button>
  </form>
</div>
<div class="card table-card"><div class="scroll"><table>
  <thead><tr><th>Cliente</th><th>CIF</th><th>Tipo</th><th>Estado</th><th>Asesor</th><th></th></tr></thead>
  <tbody id="client-rows"></tbody>
</table></div><div id="client-empty" class="empty" hidden>No hay clientes que coincidan con la búsqueda.</div></div>
<section id="client-detail"></section>
<p class="muted" style="margin-top:18px">Los resultados se cargan desde la API interna <span class="mono">/api/clients</span>.</p>
<script>{JS}</script>"""
    return layout("Clientes", body, "clients")


@app.get("/api/clients")
def api_clients(q: str = "", estado: str = "", tipo: str = "") -> JSONResponse:
    needle = q.strip().lower()
    results = []
    for client in CLIENTS:
        if estado and client["estado"] != estado:
            continue
        if tipo and client["tipo"] != tipo:
            continue
        haystack = " ".join([client["nombre"], client["apellidos"], client["cif"], client["email"]]).lower()
        if needle and needle not in haystack:
            continue
        results.append(client_payload(client))
    return JSONResponse({"clients": results, "total": len(results)})


@app.get("/api/clients/by-name")
def api_client_by_name(name: str = "") -> JSONResponse:
    needle = norm(name)
    if not needle:
        return JSONResponse({"client": None, "message": "Indica un nombre."})
    for client in CLIENTS:
        if needle in norm(f"{client['nombre']} {client['apellidos']}"):
            return JSONResponse({"client": client_payload(client)})
    return JSONResponse({"client": None, "message": "No existe ningún cliente con ese nombre."})


@app.get("/api/clients/{client_id}")
def api_client(client_id: str) -> JSONResponse:
    client = find_client(client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return JSONResponse({"client": client_payload(client)})


@app.get("/clientes/nuevo", response_class=HTMLResponse)
def new_client_form() -> HTMLResponse:
    token = secrets.token_urlsafe(24)
    TOKENS.add(token)
    body = f"""
<a class="btn btn--ghost btn--sm" href="/clientes">← Volver a clientes</a>
<h1 style="margin-top:14px">Nuevo cliente</h1>
<p class="lede">Alta de ficha fiscal. Los campos marcados con * son obligatorios.</p>
<form id="new-client" class="card" method="post" action="/clientes/nuevo" enctype="multipart/form-data">
  <input type="hidden" name="csrf_token" value="{token}">
  <fieldset>
    <legend>Datos identificativos</legend>
    <div class="form-grid">
      <div class="field"><label for="nombre">Nombre *</label><input id="nombre" name="nombre" required></div>
      <div class="field"><label for="apellidos">Apellidos *</label><input id="apellidos" name="apellidos" required></div>
      <div class="field"><label for="cif">CIF / NIF *</label><input id="cif" name="cif" required placeholder="B12345678"></div>
      <div class="field"><label for="tipo">Tipo de cliente *</label><select id="tipo" name="tipo">{options(TYPES)}</select></div>
    </div>
  </fieldset>
  <fieldset style="margin-top:18px">
    <legend>Contacto</legend>
    <div class="form-grid">
      <div class="field"><label for="telefono">Teléfono *</label><input id="telefono" name="telefono" type="tel" required></div>
      <div class="field"><label for="email">Email *</label><input id="email" name="email" type="email" required></div>
      <div class="field full"><label for="direccion">Dirección *</label><input id="direccion" name="direccion" required></div>
      <div class="field"><label for="ciudad">Ciudad</label><input id="ciudad" name="ciudad" value="Madrid"></div>
      <div class="field"><label for="cp">Código postal</label><input id="cp" name="cp" value="28001"></div>
      <div class="field"><label for="provincia">Provincia</label><input id="provincia" name="provincia" value="Madrid"></div>
      <div class="field"><label for="iban">IBAN</label><input id="iban" name="iban" placeholder="ES91 2100 0418 4502 0005 1332"></div>
    </div>
  </fieldset>
  <fieldset style="margin-top:18px">
    <legend>Gestión</legend>
    <div class="form-grid">
      <div class="field"><label for="asesor">Asesor asignado *</label><select id="asesor" name="asesor">{options([(a['id'], a['name']) for a in ADVISORS])}</select></div>
      <div class="field"><label for="estado">Estado *</label><select id="estado" name="estado">{options(STATUSES)}</select></div>
      <div class="field"><label for="fecha_alta">Fecha de alta *</label><input id="fecha_alta" name="fecha_alta" type="date" value="{date.today().isoformat()}" required></div>
      <div class="field"><label for="balance">Balance de situación (PDF) *</label><input id="balance" name="balance" type="file" accept="application/pdf" required>
        <span class="hint">PDF del último ejercicio. Máximo 10 MB.</span></div>
      <div class="field full"><label for="notas">Notas</label><textarea id="notas" name="notas" rows="3" placeholder="Régimen fiscal, obligaciones, incidencias…"></textarea></div>
    </div>
  </fieldset>
  <label class="checks"><input type="checkbox" name="rgpd" checked>
    <span>Confirmo que el cliente ha autorizado el tratamiento de sus datos y la gestión fiscal (RGPD).</span></label>
  <div class="actions">
    <button class="btn" type="submit">Crear cliente</button>
    <a class="btn btn--ghost" href="/clientes">Cancelar</a>
  </div>
</form>"""
    response = layout("Nuevo cliente", body, "clients")
    response.set_cookie("gestoria_session", token, httponly=True, samesite="lax")
    return response


@app.post("/clientes/nuevo")
async def create_client(
    nombre: str = Form(""),
    apellidos: str = Form(""),
    telefono: str = Form(""),
    email: str = Form(""),
    cif: str = Form(""),
    direccion: str = Form(""),
    ciudad: str = Form(""),
    cp: str = Form(""),
    provincia: str = Form(""),
    tipo: str = Form("empresa"),
    iban: str = Form(""),
    fecha_alta: str = Form(""),
    asesor: str = Form("elena"),
    estado: str = Form("activo"),
    notas: str = Form(""),
    csrf_token: str = Form(""),
    gestoria_session: str | None = Cookie(default=None),
    balance: UploadFile = File(...),
) -> Any:
    global NEXT_NUMBER
    if not gestoria_session or gestoria_session != csrf_token or csrf_token not in TOKENS:
        return layout("Error", '<div class="notice error">La sesión ha caducado. Vuelve a cargar el formulario.</div>'
                              '<p><a class="btn btn--outline" href="/clientes/nuevo">Volver al formulario</a></p>',
                      status_code=403)
    TOKENS.discard(csrf_token)
    if not all([nombre.strip(), apellidos.strip(), telefono.strip(), email.strip(), cif.strip(),
                direccion.strip(), fecha_alta.strip()]):
        return layout("Error", '<div class="notice error">Faltan campos obligatorios.</div>'
                              '<p><a class="btn btn--outline" href="/clientes/nuevo">Volver al formulario</a></p>',
                      status_code=400)
    if "@" not in email or tipo not in TYPES_MAP or estado not in STATUSES_MAP or asesor not in ADVISORS_MAP:
        return layout("Error", '<div class="notice error">Revisa el email, el tipo, el estado y el asesor.</div>'
                              '<p><a class="btn btn--outline" href="/clientes/nuevo">Volver al formulario</a></p>',
                      status_code=400)
    # Aviso de CIF duplicado (no bloquea: el explorador repite ejemplos en la demo).
    duplicate = (not cif.strip().upper().startswith("ZXQ")
                 and any(client["cif"].upper() == cif.strip().upper() for client in CLIENTS))
    content = await balance.read()
    if not content or len(content) > 10 * 1024 * 1024 or not content.startswith(b"%PDF"):
        return layout("Error", '<div class="notice error">El balance debe ser un PDF válido de menos de 10 MB.</div>'
                              '<p><a class="btn btn--outline" href="/clientes/nuevo">Volver al formulario</a></p>',
                      status_code=400)

    client_id = f"CL-2026-{NEXT_NUMBER:04d}"
    NEXT_NUMBER += 1
    filename = f"{client_id}-balance.pdf"
    (UPLOADS / filename).write_bytes(content)
    CLIENTS.append({
        "id": client_id, "nombre": nombre.strip(), "apellidos": apellidos.strip(),
        "telefono": telefono.strip(), "email": email.strip(), "cif": cif.strip().upper(),
        "direccion": direccion.strip(), "ciudad": ciudad.strip(), "cp": cp.strip(),
        "provincia": provincia.strip(), "tipo": tipo, "iban": iban.strip(),
        "fecha_alta": fecha_alta, "asesor": asesor, "estado": estado,
        "notas": notas.strip(), "balance": filename, "created_at": date.today().isoformat(),
        "cif_duplicado": duplicate,
    })
    response = RedirectResponse(f"/clientes/{client_id}", status_code=303)
    response.delete_cookie("gestoria_session")
    return response


@app.get("/clientes/{client_id}", response_class=HTMLResponse)
def client_page(client_id: str) -> HTMLResponse:
    client = find_client(client_id)
    if not client:
        return layout("Cliente no encontrado", '<h1>Cliente no encontrado</h1>'
                                                '<p><a class="btn btn--outline" href="/clientes">Volver a clientes</a></p>',
                      status_code=404)
    return layout(f"{client['nombre']} {client['apellidos']}", client_detail(client), "clients")


@app.get("/clientes/{client_id}/balance")
def client_balance(client_id: str) -> FileResponse:
    client = find_client(client_id)
    if not client or not client["balance"]:
        raise HTTPException(status_code=404, detail="Balance no encontrado")
    uploaded = UPLOADS / client["balance"]
    seeded = DOCUMENTS / client["balance"]
    path = uploaded if uploaded.exists() else seeded
    if not path.exists():
        raise HTTPException(status_code=404, detail="Balance no encontrado")
    return FileResponse(path, media_type="application/pdf",
                        filename=f"{client['nombre']} {client['apellidos']}.pdf")


@app.get("/documentos", response_class=HTMLResponse)
def documents_page() -> HTMLResponse:
    rows = "".join(
        f"""<div class="doc-row"><div><div class="doc-name">{esc(c['nombre'])} {esc(c['apellidos'])}</div>
        <div class="doc-meta mono">{esc(c['id'])} · {esc(c['balance'])}</div></div>
        <a class="btn btn--outline btn--sm" data-agent-skip href="/clientes/{esc(c['id'])}/balance">Descargar</a></div>"""
        for c in CLIENTS if c["balance"])
    body = f"""
<h1>Documentos</h1>
<p class="lede">Balances de situación recibidos. Los PDF son documentos de demostración.</p>
<div class="card">{rows or '<p class="muted">No hay documentos.</p>'}</div>
<p class="muted" style="margin-top:18px">Los balances se adjuntan al crear un cliente o desde su ficha.</p>"""
    return layout("Documentos", body, "docs")


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "site": "gestoria-meridian", "clients": len(CLIENTS)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8003)
