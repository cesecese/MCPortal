# Registro de MCPs (fase 3)

FastAPI + SQLite + ficheros. Es el puente entre el core (que genera y valida) y el
portal (que descubre, crea y publica). **No se despliega en Vercel**: corre en local
o en un servidor/contenedor propio; el portal sí puede estar en Vercel apuntando a
`MCPORTAL_REGISTRY_URL`.

## Arranque

```bash
cd /ruta/al/repo
set -a; . ./.env.local; set +a          # clave del LLM y contacto
.venv/bin/python -m uvicorn registry.server:app --host 127.0.0.1 --port 8010
```

- `registry/seed.json`: catálogo de ejemplo (27 MCPs) que se carga la primera vez.
- `manifests/*.json`: los manifiestos validados del core se añaden a la semilla.
- `registry/registry.db` y `registry/data/`: datos generados, ignorados en git.
- Para empezar de cero: para el registro, borra `registry/registry.db` y `registry/data/` y vuelve a arrancar.

## API

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Estado y número de MCPs |
| GET | `/mcps?q&category&impl&mode&verified&order&page&pageSize` | Catálogo (`{items,total,page,pageSize}`) |
| GET | `/mcps/{slug}` | Ficha completa con manifiesto |
| GET | `/mcps/{slug}/manifest` | Manifiesto §6.1 |
| GET | `/u/{handle}` · `/me` | Autores (mínimo para el portal) |
| POST | `/generate` | Lanza `mcportal_core.pipeline` como trabajo |
| GET | `/jobs/{id}` | Estado y borrador (`draft`) del trabajo |
| GET | `/jobs/{id}/events` | Eventos del pipeline por **SSE** |
| POST | `/jobs/{id}/cancel` | Cancela el trabajo |
| POST | `/mcps` | Publica un MCP (`permissionConfirmed: true` obligatorio) |
| POST | `/mcps/{slug}/star` | Suma una estrella |
| POST | `/mcps/{slug}/report` | Registra un reporte |

### Generar

```bash
curl -s -X POST localhost:8010/generate -H 'content-type: application/json' -d '{
  "url": "http://localhost:8001/",
  "policy": "auto",
  "maxSteps": 20,
  "mode": "read_write",
  "headless": true
}'
# → {"id":"job-…","slug":"localhost-8001","status":"running"}

curl -N localhost:8010/jobs/job-…/events        # eventos SSE
curl -s localhost:8010/jobs/job-…               # status + draft
```

`mode: "read_only"` fuerza el modo solo lectura en la red (para webs de terceros).
El registro solo permite una generación simultánea.

### Publicar

```bash
curl -s -X POST localhost:8010/mcps -H 'content-type: application/json' -d '{
  "mcp": { "...": "objeto Mcp de src/types/portal.ts" },
  "permissionConfirmed": true
}'
```

Sin `permissionConfirmed` devuelve **403**. El manifiesto se guarda también en
`registry/data/manifests/<slug>.json`.

## Portal

El portal lee del registro con:

```bash
NEXT_PUBLIC_DATA_SOURCE=registry
NEXT_PUBLIC_REGISTRY_URL=http://localhost:8010
```

`src/services/registry.ts` implementa lectura, `POST /generate`, SSE,
publicación e instalación. Si el registro no responde, el catálogo cae al mock y
la creación real avisa y usa la simulación (para que la demo no se caiga).

CORS: por defecto `localhost:5179` y `localhost:5180`; se puede ampliar con
`MCPORTAL_CORS_ORIGINS` (lista separada por comas). También se acepta cualquier
`https://*.vercel.app`.

## Instalar un MCP

```bash
./mcportal install localhost-8001
```

Descarga el manifiesto a `manifests/<slug>.json` e imprime el bloque `mcpServers`
para pegarlo en Claude Code, Claude Desktop o cualquier cliente MCP.

## Seguridad

- El core fuerza solo lectura en webs de terceros; el registro añade
  `MCPORTAL_FORCE_READ_ONLY=1` cuando el portal elige `read_only`.
- Publicar exige confirmar el permiso para automatizar la web.
- No hay login: el registro es anónimo en esta fase; el autor se guarda como texto.
- No se despliega en Vercel porque explorar requiere Chromium y trabajos largos.
