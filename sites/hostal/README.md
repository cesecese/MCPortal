# Hostal Zeta · recepción

Web de gestión básica de un alojamiento con restaurante. Pensada para que el
personal de recepción haga tres cosas rápido:

1. **Habitaciones:** consultar disponibilidad por fecha/noches/personas, crear
   reservas, hacer check-in y check-out.
2. **Restaurante:** ver mesas libres por fecha/hora/comensales y reservar mesa.
3. **Pedidos:** enviar un pedido a cocina para una habitación o una mesa y mover
   su estado (`pending → preparing → served`).

La interfaz consume una **API JSON propia** con `fetch`, así que el explorador de
MCPortal puede descubrir las acciones y generar herramientas MCP.

## Instalación en una máquina nueva

Requisitos: Python 3.12 (en macOS, `brew install python@3.12`).

```bash
/opt/homebrew/opt/python@3.12/bin/python3.12 -m venv .venv
.venv/bin/pip install -U pip
.venv/bin/pip install -r requirements.txt
# solo si vas a usar el explorador (Playwright):
.venv/bin/python -m playwright install chromium
```

## Arranque

```bash
./start-hostal.sh
# http://127.0.0.1:8020
```

Por dentro:

```bash
.venv/bin/uvicorn sites.hostal.app:app --host 127.0.0.1 --port 8020
```

Los datos viven en `sites/hostal/hostal.db` (SQLite, ignorado en git). Al arrancar
por primera vez se siembra con 16 habitaciones, 10 mesas, 12 platos y reservas de
ejemplo para hoy. Para empezar de cero: borra el fichero y reinicia.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/resumen` | Contadores del día (libres, llegadas, mesas, pedidos). |
| GET | `/api/hotel/tipos` | Tipos de habitación con capacidad y precio. |
| GET | `/api/hotel/disponibilidad?desde=&noches=&personas=` | Tipos con habitaciones libres y total. |
| POST | `/api/hotel/reservas` | Crea reserva; devuelve `booking_id`. |
| GET | `/api/hotel/reservas?estado=activas\|hoy\|todas` | Lista reservas. |
| GET | `/api/hotel/reservas/{booking_id}` | Detalle de una reserva. |
| POST | `/api/hotel/reservas/{booking_id}/checkin` | Check-in. |
| POST | `/api/hotel/reservas/{booking_id}/checkout` | Check-out. |
| GET | `/api/restaurante/mesas?fecha=&hora=&personas=` | Mesas libres (90 min por franja). |
| POST | `/api/restaurante/reservas` | Reserva mesa; devuelve `reservation_id`. |
| GET | `/api/restaurante/reservas?fecha=` | Reservas de mesa. |
| GET | `/api/restaurante/carta` | Carta con `item_id` y precio. |
| POST | `/api/restaurante/pedidos` | Pedido para habitación o mesa; devuelve `order_id`. |
| GET | `/api/restaurante/pedidos?estado=` | Pedidos y estado. |
| PATCH | `/api/restaurante/pedidos/{order_id}` | Cambia el estado del pedido. |

### Encadenamiento que explota MCPortal

- `disponibilidad` → `room_type_id` → `POST /api/hotel/reservas` → `booking_id`
- `booking_id` → `check-in` → `check-out`
- `mesas` → `table_id` → `POST /api/restaurante/reservas` → `reservation_id`
- `carta` → `item_id` + `booking_id` → `POST /api/restaurante/pedidos` → `order_id`
- `order_id` → `PATCH` para mover el pedido en cocina

Los ids son largos a propósito (`bk-5c1527`, `dish-1001`, `tbl-04`) para que el
análisis determinista detecte las dependencias.

## Uso bajo MCP

El manifiesto `manifests/hostal-zeta.json` expone 15 herramientas. Para servirla:

```bash
PYTHONPATH=core .venv/bin/python -m mcportal_core.runtime.server manifests
```

En Claude Code:

```bash
claude mcp add --scope project hostal \
  -- "$PWD/.venv/bin/python" -m mcportal_core.runtime.server "$PWD/manifests"
```

Prueba de humo completa (disponibilidad → reserva → check-in/out → mesa → pedido):

```bash
.venv/bin/python tests/mcp_smoke.py
```
