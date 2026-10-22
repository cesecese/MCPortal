# MCPortal

Convierte cualquier web sin API pública en un servidor MCP con herramientas tipadas y validadas.

Dos partes:

- **Core** (`core/`, Python): explora la web con un agente, analiza el tráfico de forma determinista,
  sintetiza un manifiesto, lo valida y lo sirve con un runtime MCP genérico.
- **Portal** (`portal/`, Next.js + React): descubrir, instalar, crear y publicar los MCPs generados.
  Se despliega en Vercel; el backend no.

La especificación completa está en [`MASTER_PROMPT.md`](MASTER_PROMPT.md) y el reparto de trabajo entre
las 4 personas en [`MASTER_PROMPT_EQUIPO.md`](MASTER_PROMPT_EQUIPO.md).

## Acuerdos del equipo

| Qué | Valor |
|---|---|
| Servidor MCP | `mcportal` (transporte stdio) |
| Prefijo de variables de entorno | `MCPORTAL_*` |
| Tienda de demo «Librería Zeta» | `http://localhost:8001` |
| Restaurante de demo «Casa Zeta» | `http://localhost:8002` |
| Panel en vivo | `http://localhost:8000` |
| Registro (fase 3) | `http://localhost:8010` |
| Portal en local | `http://localhost:5180` (`next dev -p 5180`) |
| Ramas | `main` + una por persona: `p1-explorer`, `p2-core`, `p3-portal-ui`, `p4-portal-flows` |

Los puertos 3000 y 3001 están ocupados en la máquina de desarrollo: no usarlos.

## Puesta en marcha (core)

```bash
py -m venv .venv
.venv/Scripts/activate        # Windows; en Linux/macOS: source .venv/bin/activate
pip install -e core
python -m playwright install chromium
```

Comprobar el runtime contra el manifiesto de ejemplo:

```bash
python core/tests/mcp_smoke.py
```

Arrancar las webs de demo y el panel (requiere las webs de la persona 1):

```bash
bash start.sh
```

## Variables de entorno

| Variable | Uso |
|---|---|
| `MCPORTAL_LLM_PROVIDER` | Proveedor de LLM |
| `MCPORTAL_LLM_API_KEY` | Clave del proveedor (sin ella todo funciona en modo determinista) |
| `MCPORTAL_MODEL` | Modelo del proveedor |
| `MCPORTAL_EFFORT_SYNTH` | Nivel de razonamiento del sintetizador |
| `MCPORTAL_HEADED=1` | Ver el navegador de las herramientas `browser` |
| `MCPORTAL_CONTACT` | Contacto que se añade al User-Agent |
| `MCPORTAL_ALLOW_WRITES=1` | Quitar el modo solo lectura (nunca en webs reales de terceros) |

## LLM (opcional)

Sin clave todo funciona en modo determinista. Con Anthropic:

```bash
pip install -e "core[llm]"
export MCPORTAL_LLM_PROVIDER=anthropic
export MCPORTAL_MODEL=<modelo>          # obligatorio: los nombres cambian por versión
export MCPORTAL_LLM_API_KEY=<clave>
```

## Estructura

```
core/                core en Python (mcportal_core) + panel + pruebas
sites/               webs de demo (tienda y restaurante)
portal/              portal Next.js (fase 2)
registry/            registro FastAPI (fase 3)
fixtures/            datos de prueba escritos a mano (traza, eventos)
manifests/           manifiestos validados que sirve el runtime
runs/  cache/        artefactos de ejecución (ignorados en git)
manifest.example.json  manifiesto de ejemplo para desarrollar contra él
start.sh             arranca webs de demo y panel
```
