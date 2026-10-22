# Fase 3 en local: qué hay, qué falta y cómo se ejecuta

Fecha: 22 de octubre de 2026 · Rama: `feat/hostal-mcp`

Este documento analiza la fase 3 del proyecto (registro + integración
portal ↔ core) y deja montado lo que ya se puede ejecutar en este ordenador:
una web de recepción real y su servidor MCP.

## 1. Qué pide la fase 3

Según el master prompt (§9):

- **`registry/`** (FastAPI, puerto 8010, SQLite + ficheros):
  - `GET /mcps` con búsqueda y filtros, `GET /mcps/{slug}`,
    `GET /mcps/{slug}/manifest`.
  - `POST /generate` que lanza el pipeline del core como trabajo.
  - `GET /jobs/{id}/events` (SSE con los eventos de §6.4).
  - `POST /mcps` para publicar (exige confirmación de permiso), versiones,
    estrellas e informes.
  - CORS para el dominio de Vercel y `localhost:5180`.
- **Portal** con `NEXT_PUBLIC_DATA_SOURCE=registry` y
  `NEXT_PUBLIC_REGISTRY_URL`: el catálogo sale del registro y el paso 2 de
  «Crear» muestra la generación real por SSE.
- El backend no va a Vercel: registro y trabajador corren en local o en un
  contenedor propio.
- CLI `mcportal install <slug>` y gobernanza (solo lectura por defecto,
  revalidación, informes).

## 2. Qué existe hoy en el repositorio

| Pieza | Estado |
|---|---|
| Portal Next.js (diseño + comunidad) | ✅ en `main` y en `feat/hostal-mcp` |
| Capa de datos del portal (`src/services`, `src/types`, `src/state`) | ✅ persona 4, con `registry.ts` de lectura |
| Explorador + análisis determinista | ✅ en `origin/p1-explorer` (traído a esta rama) |
| Webs de demo (tienda y restaurante) | ✅ en `origin/p1-explorer` |
| Sintetizador | ❌ no está en ninguna rama |
| Validador | ❌ no está |
| Runtime MCP completo | ⚠️ hay una versión mínima HTTP en esta rama (`core/mcportal_core/runtime`) |
| Pipeline (`pipeline.py`) | ❌ no está |
| Registro fase 3 | ❌ no está |
| Portal consumiendo el registro | ⚠️ existe el servicio, pero las pantallas siguen leyendo del `useStore` (datos de ejemplo) |

Conclusión: **la fase 3 no se puede ejecutar tal cual** porque falta el core de
la persona 2 (sintetizador, validador y pipeline) y el registro. El portal
tampoco está cableado al servicio de registro en las pantallas.

## 3. Qué se ha montado y verificado aquí

### Entorno

- Python 3.12 de Homebrew + `.venv` en la raíz.
- `mcp 2.3.0`, `fastapi 0.159`, `uvicorn`, `httpx`, `playwright` (Chromium),
  `beautifulsoup4`.
- Explorador de la persona 1 (`core/mcportal_core/explorer`) funcionando.

### Web de recepción

`sites/hostal/app.py` (puerto **8020**, SQLite `sites/hostal/hostal.db`):

- Habitaciones: tipos, disponibilidad, reserva, check-in, check-out.
- Restaurante: mesas libres por fecha/hora/comensales, reserva de mesa, carta.
- Pedidos: alta para habitación o mesa, estados `pending → preparing → served`.
- Interfaz de recepción + API JSON que la propia interfaz consume con `fetch`.
- 16 habitaciones, 10 mesas, 12 platos y reservas de ejemplo al sembrar.

Arranque:

```bash
./start-hostal.sh          # http://127.0.0.1:8020
```

### Servidor MCP

`manifests/hostal-zeta.json` (15 herramientas, contrato §6.1) y
`core/mcportal_core/runtime/{executor,server}.py`:

```bash
PYTHONPATH=core .venv/bin/python -m mcportal_core.runtime.server manifests
```

Prueba de humo (por stdio, con el cliente MCP oficial):

```bash
.venv/bin/python tests/mcp_smoke.py
# 15/15 comprobaciones
```

Cubre: resumen, disponibilidad, reserva, check-in, check-out, mesas, reserva de
mesa, carta, pedido, listado de pedidos y cambio de estado.

### Explorador contra la recepción

```bash
PYTHONPATH=core .venv/bin/python -m mcportal_core.explorer.explore \
  http://localhost:8020/ --policy heuristic --max-steps 30 --headless
```

Resultado (`runs/localhost-8020/trace.json`): **31 pasos, 45 peticiones,
14 candidatos y 5 dependencias**. Entre ellos:

- `GET /api/hotel/disponibilidad` (desde, noches, personas).
- `POST /api/hotel/reservas` (room_type_id, checkin, nights, huésped…).
- `POST /api/hotel/reservas/{booking_id}/checkin` y `/checkout` con
  `booking_id` sacado de la lista de reservas (dependencia detectada).
- `GET /api/restaurante/mesas` y `POST /api/restaurante/reservas`.
- `POST /api/restaurante/pedidos` (booking_id, item_id, qty, notas).
- `PATCH /api/restaurante/pedidos/{order_id}` con `order_id` de la lista.

Esto demuestra que la web es explorable y encadenable. El manifiesto publicado
se escribió a mano sobre esa traza (el sintetizador de la persona 2 no está),
que es exactamente el caso que el master prompt contempla para la fase 1.

## 4. Qué falta exactamente para la fase 3

1. **Sintetizador** (`synthesizer/synthesize.py`): candidatos → manifiesto
   propuesto, modo determinista y modo LLM con salida estructurada. Sin él no
   hay `POST /generate`.
2. **Validador** (`validator/validate.py`): orden topológico por `depends_on`,
   ejecución con el mismo ejecutor, juicio 2xx y cambio http → navegador.
3. **Pipeline** (`pipeline.py`): explorar → sintetizar → validar →
   `manifests/<slug>.json` + `proposed.json` + `validation.json` + eventos.
4. **Registro** (`registry/app.py`): SQLite, endpoints de §9, SSE y CORS.
5. **Portal cableado**: hoy `Explore` y `McpDetail` usan `useStore` con los
   datos de ejemplo; hay que hacer que el catálogo y el detalle lean de
   `src/services` (servidor) y que «Crear» use el SSE del registro.
6. **Runtime completo**: el de esta rama solo ejecuta HTTP. Para webs con CSRF
   hace falta el ejecutor de navegador (Playwright) de la persona 2.
7. **Clave LLM**: sin `ANTHROPIC_API_KEY` el sintetizador solo puede funcionar
   en modo determinista (nombres menos cuidados).

## 5. Cómo se ejecutará cuando esté (comandos previstos)

```bash
# core + registro
.venv/bin/uvicorn registry.app:app --port 8010

# portal contra el registro
cd portal  # o raíz, según la estructura final
NEXT_PUBLIC_DATA_SOURCE=registry \
NEXT_PUBLIC_REGISTRY_URL=http://127.0.0.1:8010 \
npx next dev -p 5180
```

Variables y puertos: portal 5180, registro 8010, recepción 8020, tienda 8001,
restaurante 8002. CORS del registro para `http://localhost:5180` y el dominio de
Vercel.

`POST /generate` recibiría `{url, hint, mode, max_steps, policy}` y emitiría por
SSE los eventos de §6.4; el portal los pintaría en el paso 2 de «Crear».

## 6. Plan propuesto si se quiere cerrar la fase 3 en esta rama

1. Pipeline mínimo determinista con la traza ya generada (sintetizador +
   validador + `pipeline.py`). Verificable con la recepción.
2. Registro FastAPI con SQLite, CORS y SSE; `POST /generate` lanzando el
   pipeline como subproceso.
3. Cablear el portal: catálogo/detalle desde `services/` y «Crear» contra SSE.
4. Pruebas: pipeline sobre la recepción, registro (listado/publicación),
   portal en modo registro y `next build`.

Riesgo principal: los nombres generados en modo determinista son funcionales
pero poco comerciales (`hostal_zeta_get_hotel_disponibilidad`). Con clave LLM se
resuelve; sin ella, el manifiesto curado que ya funciona es la mejor demo.

## 7. Nota de seguridad

La web es propia y de práctica: se permite lectura y escritura. Las
exploraciones contra webs de terceros siguen en solo lectura y con User-Agent
identificable. No hay login ni datos reales; la base se puede borrar para
volver al estado sembrado.
