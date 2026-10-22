# Webs de demostración

Atrezo de MCPortal: dos webs sin API pública pensadas para que el explorador
descubra acciones y el validador las ejecute. Datos falsos en memoria; al reiniciar
se pierden carritos y reservas.

## Arranque

Desde la raíz del repo, con el venv activo (`.venv`):

```bash
.venv/bin/uvicorn sites.shop.app:app --host 127.0.0.1 --port 8001
.venv/bin/uvicorn sites.restaurant.app:app --host 127.0.0.1 --port 8002
```

En la demo se arrancan junto al panel con `start.sh` (lo mantiene la persona 2).
Si los puertos están ocupados, se puede usar `--port 8101` / `8102`, pero el
contrato y los manifiestos usan **8001** y **8002**.

## Librería Zeta (`sites/shop`, puerto 8001)

Tienda de una página en HTML + JS sin frameworks. La carga inicial pide categorías
y resultados; el buscador y los enlaces de categoría usan `fetch`.

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/categories` | 4 categorías `{id, name}` |
| GET | `/api/search?q=&category=` | Busca en título o autor; sin parámetros devuelve los 13 libros |
| GET | `/api/products/{product_id}` | Ficha con stock y descripción; 404 si no existe |
| POST | `/api/cart` | Crea un carrito y devuelve `cart_id` |
| GET | `/api/cart/{cart_id}` | Carrito con líneas y total |
| POST | `/api/cart/{cart_id}/items` | `{product_id, qty}`; 404/409/422 según el caso |
| POST | `/api/cart/{cart_id}/checkout` | `{name, email}`; pago simulado; 409 si está vacío o pagado |

El primer «Añadir al carrito» crea el carrito y guarda el `cart_id` en memoria del
JS; por eso la exploración descubre el encadenamiento `POST /api/cart` →
`POST /api/cart/{cart_id}/items`. Los ids (`bk-1001`) son largos a propósito.

Comprobación rápida:

```bash
cid=$(curl -s -X POST localhost:8001/api/cart | python3 -c 'import json,sys;print(json.load(sys.stdin)["cart_id"])')
curl -s -X POST localhost:8001/api/cart/$cid/items -H 'content-type: application/json' \
  -d '{"product_id":"bk-1001","qty":2}'
curl -s -X POST localhost:8001/api/cart/$cid/checkout -H 'content-type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com"}'
```

## Casa Zeta (`sites/restaurant`, puerto 8002)

HTML renderizado en servidor, sin JSON. El POST del formulario de reserva exige un
token CSRF oculto ligado a una cookie `session` httpOnly: una petición HTTP simple
recibe **403**, así que el validador debe cambiar la herramienta a navegador.

- `GET /` inicio con formulario de consulta por código.
- `GET /menu` carta estática.
- `GET /disponibilidad?date=&people=` formulario GET; con datos válidos, tabla de
  horas libres con enlaces a `/reservar?...`; datos inválidos → 400.
- `GET /reservar` formulario POST con `csrf_token`, nombre, teléfono, fecha, hora
  (9 franjas) y comensales.
- `POST /reservar` 403 token inválido, 400 datos inválidos, 409 sin mesa, 200 con
  código `R-XXXXXX` (y rota el token).
- `GET /reserva?code=` consulta; un código inexistente devuelve **200** con
  «No existe ninguna reserva…» para que la herramienta valide.

Disponibilidad determinista: una franja está libre si
`md5(fecha + hora) % 10 < 10 - min(personas, 8)` y quedan mesas (4 por franja).
La exploración reserva una mesa; el validador usa otra de las cuatro.

Comprobación rápida del CSRF:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:8002/reservar \
  -d 'csrf_token=x&name=Ada&phone=600123456&date=2026-10-24&time=13:00&people=2'
# 403: sin cookie de sesión no vale
```

## Gestoría Meridian (`sites/gestoria`, puerto 8003)

Software interno de demostración: dashboard, buscador de clientes, ficha, alta con
CSRF y **subida real de un PDF** de balance de situación. Es el caso de uso
«software interno sin API» del pitch.

- `GET /` resumen; `GET /clientes` buscador (la tabla se carga por `fetch`);
  `GET /clientes/nuevo` formulario; `GET /clientes/{id}` ficha;
  `GET /documentos` balances.
- `GET /api/clients?q=&estado=&tipo=` JSON para el buscador;
  `GET /api/clients/{id}` JSON de la ficha.
- `POST /clientes/nuevo` multipart con `csrf_token` + cookie de sesión y un PDF
  obligatorio (`balance`); 303 a la ficha creada. CIF duplicado se muestra como
  aviso, no bloquea (el explorador repite ejemplos).
- `GET /clientes/{id}/balance` sirve el PDF subido o el de ejemplo.

PDF de ejemplo para el explorador y el MCP:
`sites/gestoria/samples/balance-ejemplo.pdf`.

Prueba rápida:

```bash
curl -s 'http://localhost:8003/api/clients?q=rivas' | python3 -m json.tool
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
  http://localhost:8003/clientes/CL-2026-0001/balance
```

El alta exige el PDF: el explorador lo sube con la acción `upload` y el runtime
la reproduce con `set_input_files`; el PDF queda en `sites/gestoria/uploads/`
(ignorado en git).
