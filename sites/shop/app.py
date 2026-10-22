"""Librería Zeta: tienda de demostración con API JSON y carrito encadenado.

Forma parte del atrezo de MCPortal: pone a prueba la detección de endpoints y el
encadenamiento de identificadores (cart_id, product_id) por parte del explorador.

Arranque:  uvicorn sites.shop.app:app --port 8001
"""

from __future__ import annotations

import secrets
import unicodedata
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI(title="Librería Zeta")

# --------------------------------------------------------------------------- #
# Datos
# --------------------------------------------------------------------------- #

CATEGORIES: list[dict[str, str]] = [
    {"id": "scifi", "name": "Ciencia ficción"},
    {"id": "fantasy", "name": "Fantasía"},
    {"id": "history", "name": "Historia"},
    {"id": "programming", "name": "Programación"},
]

PRODUCTS: list[dict[str, Any]] = [
    {"id": "bk-1001", "title": "Fundación", "author": "Isaac Asimov", "category": "scifi",
     "price": 19.90, "stock": 7,
     "description": "Un matemático predice la caída del Imperio Galáctico y funda una colonia para acortar la edad oscura."},
    {"id": "bk-1002", "title": "Yo, robot", "author": "Isaac Asimov", "category": "scifi",
     "price": 17.50, "stock": 4,
     "description": "Nueve relatos sobre las tres leyes de la robótica y los límites de la obediencia mecánica."},
    {"id": "bk-1003", "title": "Dune", "author": "Frank Herbert", "category": "scifi",
     "price": 21.00, "stock": 3,
     "description": "La política, la religión y la ecología chocan en el desierto de Arrakis."},
    {"id": "bk-1004", "title": "El problema de los tres cuerpos", "author": "Cixin Liu", "category": "scifi",
     "price": 18.90, "stock": 9,
     "description": "Primer contacto con una civilización alienígena al borde de la extinción."},
    {"id": "bk-1005", "title": "Neuromante", "author": "William Gibson", "category": "scifi",
     "price": 16.95, "stock": 2,
     "description": "El hacker Case recibe una segunda oportunidad en el ciberespacio de Chiba City."},
    {"id": "bk-1006", "title": "La mano izquierda de la oscuridad", "author": "Ursula K. Le Guin", "category": "scifi",
     "price": 20.50, "stock": 6,
     "description": "Un enviado humano descubre una sociedad sin género fijo en el planeta Invierno."},
    {"id": "bk-1007", "title": "El nombre del viento", "author": "Patrick Rothfuss", "category": "fantasy",
     "price": 22.90, "stock": 5,
     "description": "Kvothe narra su vida entre la Universidad, la música y la magia."},
    {"id": "bk-1008", "title": "La comunidad del anillo", "author": "J. R. R. Tolkien", "category": "fantasy",
     "price": 24.00, "stock": 8,
     "description": "Frodo hereda un anillo y emprende el viaje hacia los fuegos de Mordor."},
    {"id": "bk-1009", "title": "El hobbit", "author": "J. R. R. Tolkien", "category": "fantasy",
     "price": 15.90, "stock": 11,
     "description": "Bilbo Bolsón se une a trece enanos para recuperar un tesoro guardado por un dragón."},
    {"id": "bk-1010", "title": "SPQR", "author": "Mary Beard", "category": "history",
     "price": 26.50, "stock": 3,
     "description": "Mil años de historia de Roma, desde las aldeas del Lacio hasta el Imperio."},
    {"id": "bk-1011", "title": "Los Ángeles que llevamos dentro", "author": "Steven Pinker", "category": "history",
     "price": 23.90, "stock": 2,
     "description": "Una historia de la violencia y de las fuerzas que la han reducido."},
    {"id": "bk-1012", "title": "El programador pragmático", "author": "Andrew Hunt y David Thomas", "category": "programming",
     "price": 34.90, "stock": 6,
     "description": "Hábitos y técnicas para escribir software mantenible durante toda una carrera."},
    {"id": "bk-1013", "title": "Código limpio", "author": "Robert C. Martin", "category": "programming",
     "price": 29.90, "stock": 4,
     "description": "Principios, patrones y prácticas para escribir código que otros puedan leer."},
]

BY_ID = {p["id"]: p for p in PRODUCTS}
CART: dict[str, dict[str, Any]] = {}


class ItemIn(BaseModel):
    product_id: str
    qty: int


class CheckoutIn(BaseModel):
    name: str
    email: str


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.casefold())
    return "".join(c for c in text if not unicodedata.combining(c))


def _public(product: dict[str, Any]) -> dict[str, Any]:
    return {k: product[k] for k in ("id", "title", "author", "category", "price")}


def _cart(cart_id: str) -> dict[str, Any]:
    cart = CART.get(cart_id)
    if cart is None:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    return cart


def _cart_view(cart: dict[str, Any]) -> dict[str, Any]:
    return {
        "cart_id": cart["cart_id"],
        "status": cart["status"],
        "items": cart["items"],
        "total": round(cart["total"], 2),
    }


# --------------------------------------------------------------------------- #
# API JSON
# --------------------------------------------------------------------------- #


@app.get("/api/categories")
def api_categories() -> dict[str, Any]:
    return {"categories": CATEGORIES}


@app.get("/api/search")
def api_search(q: str = "", category: str = "") -> dict[str, Any]:
    needle = _norm(q.strip())
    cat = category.strip()
    results = []
    for product in PRODUCTS:
        if cat and product["category"] != cat:
            continue
        if needle and needle not in _norm(product["title"]) and needle not in _norm(product["author"]):
            continue
        results.append(_public(product))
    return {"query": q, "category": cat, "count": len(results), "results": results}


@app.get("/api/products/{product_id}")
def api_product(product_id: str) -> dict[str, Any]:
    product = BY_ID.get(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return dict(product)


@app.post("/api/cart")
def api_create_cart() -> dict[str, str]:
    cart_id = "cart_" + secrets.token_hex(4)
    CART[cart_id] = {"cart_id": cart_id, "status": "open", "items": [], "total": 0.0}
    return {"cart_id": cart_id}


@app.get("/api/cart/{cart_id}")
def api_get_cart(cart_id: str) -> dict[str, Any]:
    return _cart_view(_cart(cart_id))


@app.post("/api/cart/{cart_id}/items")
def api_add_item(cart_id: str, item: ItemIn) -> dict[str, Any]:
    cart = _cart(cart_id)
    if cart["status"] != "open":
        raise HTTPException(status_code=409, detail="El carrito ya está cerrado")
    if item.qty < 1:
        raise HTTPException(status_code=422, detail="La cantidad debe ser al menos 1")
    product = BY_ID.get(item.product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for line in cart["items"]:
        if line["product_id"] == item.product_id:
            line["qty"] += item.qty
            line["subtotal"] = round(line["qty"] * product["price"], 2)
            break
    else:
        cart["items"].append({
            "product_id": product["id"],
            "title": product["title"],
            "qty": item.qty,
            "subtotal": round(item.qty * product["price"], 2),
        })
    cart["total"] = round(sum(line["subtotal"] for line in cart["items"]), 2)
    return _cart_view(cart)


@app.post("/api/cart/{cart_id}/checkout")
def api_checkout(cart_id: str, data: CheckoutIn) -> dict[str, Any]:
    cart = _cart(cart_id)
    if cart["status"] != "open":
        raise HTTPException(status_code=409, detail="El carrito ya está pagado")
    if not cart["items"]:
        raise HTTPException(status_code=409, detail="El carrito está vacío")
    if not data.name.strip() or "@" not in data.email:
        raise HTTPException(status_code=422, detail="Nombre o email inválidos")
    cart["status"] = "paid"
    return {
        "order_id": "ord_" + secrets.token_hex(4),
        "cart_id": cart_id,
        "total": round(cart["total"], 2),
        "customer": {"name": data.name.strip(), "email": data.email.strip()},
        "message": "Pago simulado correcto. Gracias por tu compra.",
    }


# --------------------------------------------------------------------------- #
# Página
# --------------------------------------------------------------------------- #

PAGE = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Librería Zeta</title>
<style>
  :root { --paper:#f7f5ef; --ink:#1c1a16; --muted:#6c675d; --line:#ddd8cb; --signal:#c2370a; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  header { border-bottom:1px solid var(--line); padding:18px 28px; }
  header h1 { margin:0 0 12px; font-size:22px; letter-spacing:-.02em; }
  header h1 span { color:var(--signal); }
  #search-form { display:flex; gap:8px; flex-wrap:wrap; }
  input, select, button { font:inherit; }
  input, select { padding:8px 10px; border:1px solid var(--line); background:#fff; border-radius:4px; }
  input[name=q] { flex:1 1 280px; }
  button { padding:8px 14px; border:1px solid var(--ink); background:var(--ink); color:var(--paper);
           border-radius:4px; cursor:pointer; }
  button:hover { background:#33302a; }
  button.ghost { background:transparent; color:var(--ink); }
  nav { display:flex; gap:14px; flex-wrap:wrap; padding:12px 28px; border-bottom:1px solid var(--line); }
  nav a { color:var(--muted); text-decoration:none; font-size:14px; }
  nav a:hover { color:var(--signal); }
  main { max-width:1060px; margin:0 auto; padding:24px 28px 60px; }
  #status { min-height:22px; color:var(--muted); font-size:14px; }
  #results { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
  .product { border:1px solid var(--line); background:#fffdf8; border-radius:6px; padding:14px; }
  .product h3 { margin:0 0 4px; font-size:17px; }
  .product .meta { color:var(--muted); font-size:13px; margin:0 0 10px; }
  .product .price { font-weight:600; }
  .product .actions { display:flex; gap:8px; align-items:center; margin-top:12px; flex-wrap:wrap; }
  .product input[type=number] { width:64px; }
  .product button { font-size:13px; padding:6px 10px; }
  #cart { margin-top:30px; border-top:1px solid var(--line); padding-top:20px; }
  #cart h2 { font-size:18px; }
  #cart table { width:100%; border-collapse:collapse; margin:10px 0 16px; }
  #cart th, #cart td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); font-size:14px; }
  #cart .total { text-align:right; font-weight:600; }
  #detail { margin-top:24px; }
  #detail .card { border-left:3px solid var(--signal); padding:12px 16px; background:#fffdf8; }
  #checkout-form { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; }
  #checkout-form input { flex:1 1 180px; }
  .ok { color:#1f7a4d; }
  .error { color:var(--signal); }
</style>
</head>
<body>
<header>
  <h1>Librería <span>Zeta</span></h1>
  <form id="search-form" method="get" action="/">
    <input name="q" type="search" placeholder="Buscar por título o autor" aria-label="Buscar por título o autor">
    <button type="submit">Buscar</button>
  </form>
</header>
<nav id="categories" aria-label="Categorías"></nav>
<main>
  <p id="status"></p>
  <section id="results" aria-label="Resultados"></section>
  <section id="detail"></section>
  <section id="cart"></section>
</main>
<script>
let cartId = null;
let cartCount = 0;

const $ = (sel) => document.querySelector(sel);
const money = (n) => n.toFixed(2).replace(".", ",") + " €";
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function setStatus(text, kind) {
  const el = $("#status");
  el.textContent = text;
  el.className = kind || "";
}

async function loadCategories() {
  const { ok, data } = await api("/api/categories");
  if (!ok) return;
  const nav = $("#categories");
  nav.innerHTML = "";
  for (const category of data.categories) {
    const link = document.createElement("a");
    link.href = "#";
    link.textContent = category.name;
    link.dataset.category = category.id;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      runSearch("", category.id);
    });
    nav.appendChild(link);
  }
}

function renderResults(results) {
  const box = $("#results");
  if (!results.length) {
    box.innerHTML = "<p>No hay resultados para esa búsqueda.</p>";
    return;
  }
  box.innerHTML = results.map((p) => `
    <article class="product">
      <h3>${esc(p.title)}</h3>
      <p class="meta">${esc(p.author)} · ${esc(p.category)}</p>
      <p class="price">${money(p.price)}</p>
      <div class="actions">
        <button type="button" class="ghost detail" data-id="${esc(p.id)}">Ver detalle</button>
        <input type="number" name="qty" value="1" min="1" max="20" aria-label="Cantidad">
        <button type="button" class="add" data-id="${esc(p.id)}">Añadir al carrito</button>
      </div>
    </article>`).join("");
  box.querySelectorAll("button.detail").forEach((button) => {
    button.addEventListener("click", () => showDetail(button.dataset.id));
  });
  box.querySelectorAll("button.add").forEach((button) => {
    button.addEventListener("click", () => {
      const qty = Number(button.closest(".product").querySelector("input[name=qty]").value) || 1;
      addToCart(button.dataset.id, qty);
    });
  });
}

async function runSearch(q, category) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const query = params.toString();
  setStatus("Buscando…");
  const { ok, data } = await api("/api/search" + (query ? "?" + query : ""));
  if (!ok) { setStatus("No se pudo buscar.", "error"); return; }
  renderResults(data.results);
  const label = [q ? `«${q}»` : null, category || null].filter(Boolean).join(" · ");
  setStatus(`${data.count} resultado${data.count === 1 ? "" : "s"}${label ? " para " + label : ""}`);
}

async function showDetail(productId) {
  const { ok, data } = await api("/api/products/" + encodeURIComponent(productId));
  const box = $("#detail");
  if (!ok) { box.innerHTML = '<p class="error">No se pudo cargar el detalle.</p>'; return; }
  box.innerHTML = `<div class="card">
    <h3>${esc(data.title)}</h3>
    <p class="meta">${esc(data.author)} · ${esc(data.category)} · ${money(data.price)}</p>
    <p>${esc(data.description)}</p>
    <p>Stock disponible: <strong>${data.stock}</strong> unidades</p>
  </div>`;
}

async function addToCart(productId, qty) {
  if (!cartId) {
    const created = await api("/api/cart", { method: "POST" });
    if (!created.ok) { setStatus("No se pudo crear el carrito.", "error"); return; }
    cartId = created.data.cart_id;
  }
  const { ok, data } = await api(`/api/cart/${encodeURIComponent(cartId)}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId, qty: qty }),
  });
  if (!ok) { setStatus(data.detail || "No se pudo añadir al carrito.", "error"); return; }
  cartCount = data.items.reduce((total, line) => total + line.qty, 0);
  const toggle = $("#cart-toggle");
  if (toggle) toggle.textContent = `Ver carrito (${cartCount})`;
  setStatus("Añadido al carrito.", "ok");
}

function ensureCartToggle() {
  if ($("#cart-toggle")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.id = "cart-toggle";
  button.textContent = `Ver carrito (${cartCount})`;
  button.style.marginTop = "20px";
  button.addEventListener("click", showCart);
  $("#results").after(button);
}

async function showCart() {
  if (!cartId) { setStatus("El carrito está vacío.", ""); return; }
  const { ok, data } = await api("/api/cart/" + encodeURIComponent(cartId));
  if (!ok) { setStatus("No se pudo cargar el carrito.", "error"); return; }
  const box = $("#cart");
  const rows = data.items.map((line) => `
    <tr><td>${esc(line.title)}</td><td>${line.qty}</td><td>${money(line.subtotal)}</td></tr>`).join("");
  box.innerHTML = `<h2>Tu carrito</h2>
    <table>
      <thead><tr><th>Libro</th><th>Cantidad</th><th>Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="total">Total: ${money(data.total)}</p>
    <form id="checkout-form">
      <input name="name" placeholder="Nombre" aria-label="Nombre">
      <input name="email" type="email" placeholder="Email" aria-label="Email">
      <button type="submit">Finalizar compra</button>
    </form>`;
  $("#checkout-form").addEventListener("submit", (event) => {
    event.preventDefault();
    checkout();
  });
  setStatus(`${cartCount} unidad${cartCount === 1 ? "" : "es"} en el carrito.`);
}

async function checkout() {
  const form = $("#checkout-form");
  const name = form.elements.namedItem("name").value;
  const email = form.elements.namedItem("email").value;
  const { ok, data } = await api(`/api/cart/${encodeURIComponent(cartId)}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: name, email: email }),
  });
  if (!ok) { setStatus(data.detail || "No se pudo finalizar la compra.", "error"); return; }
  $("#cart").innerHTML = `<h2 class="ok">Pedido confirmado</h2>
    <p>Gracias, ${esc(data.customer.name)}. Tu pedido <strong>${esc(data.order_id)}</strong>
    por ${money(data.total)} está en camino.</p>`;
  cartId = null;
  cartCount = 0;
  setStatus("Compra completada.", "ok");
}

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const q = $("#search-form input[name=q]").value;
  runSearch(q, "");
});

loadCategories();
runSearch("", "");
ensureCartToggle();
</script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def index() -> HTMLResponse:
    return HTMLResponse(PAGE)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"ok": True, "site": "libreria-zeta"})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
