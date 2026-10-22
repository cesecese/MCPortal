# MCPortal

MCPortal convierte una web que **no tiene API pública** en un servidor **MCP** con
herramientas tipadas y validadas para un asistente de IA.

La idea: pegas la URL de una web, un agente la explora en un navegador real,
descubre qué acciones funcionan, genera un manifiesto MCP y lo valida. Después
puedes publicarlo, descubrirlo en el catálogo e instalarlo en Claude, Cursor o
cualquier cliente compatible con MCP.

> **Solo lectura por defecto en webs de terceros.** Las acciones que escriben
> (crear, reservar, comprar…) solo se permiten en las webs de demo o en dominios
> propios con permiso explícito.

## Qué hace

- **Explora** una web con Playwright/Chromium y registra las peticiones y acciones
  que funcionan.
- **Analiza** el tráfico de forma determinista: endpoints, parámetros, CSRF,
  cookies, dependencias entre llamadas y subidas de archivos.
- **Sintetiza** un manifiesto MCP con nombres, descripciones, esquemas de entrada
  y ejemplos.
- **Valida** el manifiesto ejecutando las herramientas de verdad contra la web.
- **Publica** el MCP en un registro propio, con catálogo, generación en vivo por
  SSE, estrellas y reportes.
- **Sirve** las herramientas con un runtime MCP genérico por `stdio`, sin generar
  código por cada web.
- Incluye **tres webs de demo** para probar todo el flujo sin tocar webs reales:
  una tienda, un restaurante y una gestoría con subida de PDF.

### Flujo de uso

```text
URL de una web
      │
      ▼
Explorador (Chromium) ──► Análisis ──► Manifiesto MCP ──► Validación
                                                         │
                                                         ▼
                                              Registro / Portal
                                                         │
                                                         ▼
                                           ./mcportal install <slug>
                                                         │
                                                         ▼
                                              Cliente MCP (stdio)
```

## Piezas del proyecto

| Pieza | Carpeta | Qué es |
|---|---|---|
| Core | `core/` | Explorador, analizador, sintetizador, validador y runtime MCP en Python. Incluye el panel en vivo. |
| Portal | `src/` | Interfaz Next.js para explorar el catálogo, crear MCPs, revisar herramientas y publicar. |
| Registro | `registry/` | API FastAPI + SQLite que genera, guarda y sirve los MCPs al portal. |
| Webs de demo | `sites/` | Librería Zeta (tienda), Casa Zeta (restaurante) y Gestoría Meridian (software interno). |
| Manifiestos | `manifests/` | Manifiestos ya validados que lee el runtime. |
| CLI | `mcportal` | Instala un MCP del registro y muestra la configuración para tu cliente. |

## Requisitos

- **Python 3.11+**
- **Node.js 20+** y npm
- **Chromium** de Playwright (se instala aparte)
- macOS/Linux para los comandos de shell; en Windows usa PowerShell equivalente
  o WSL.

Los puertos que usa el proyecto son:

| Servicio | URL |
|---|---|
| Portal Next.js | <http://localhost:5179> |
| Panel en vivo | <http://localhost:8000> |
| Librería Zeta | <http://localhost:8001> |
| Casa Zeta | <http://localhost:8002> |
| Gestoría Meridian | <http://localhost:8003> |
| Registro | <http://localhost:8010> |

No uses los puertos `3000` ni `3001`: están reservados en el entorno de desarrollo.

## Instalación

### 1. Clona el repositorio

```bash
git clone https://github.com/cesecese/MCPortal.git
cd MCPortal
```

### 2. Entorno de Python

```bash
python3 -m venv .venv
source .venv/bin/activate

pip install --upgrade pip
pip install -e "core[llm]"     # con Anthropic
# o, si no vas a usar LLM:
# pip install -e core

python -m playwright install chromium
```

`core[llm]` instala el SDK de Anthropic. El resto del core funciona sin LLM en
modo determinista.

### 3. Dependencias del portal

```bash
npm install
```

### 4. Crea tu `.env.local` personal

Este es el paso importante. En este proyecto el archivo personal es
**`.env.local`** (no `.env`): Next.js lo carga solo y `.gitignore` lo excluye. El
repositorio solo trae un ejemplo; **tu archivo personal no se sube a git**.

```bash
cp .env.example .env.local
```

Si ya tienes un `.env.local`, **no lo sobrescribas**: edítalo directamente.

Abre `.env.local` y rellena tus valores:

```dotenv
# LLM (opcional: sin clave, el core usa el modo determinista)
MCPORTAL_LLM_PROVIDER=anthropic
MCPORTAL_LLM_API_KEY=sk-ant-...
MCPORTAL_MODEL=claude-sonnet-5-5
MCPORTAL_EFFORT_SYNTH=medium
MCPORTAL_CONTACT=https://github.com/tu-usuario

# Portal: mock para la maqueta, registry para el registro real
NEXT_PUBLIC_DATA_SOURCE=registry
NEXT_PUBLIC_REGISTRY_URL=http://localhost:8010
```

Notas:

- **No commitees `.env.local` ni pegues tu clave en un README, un issue o un
  mensaje.** `.gitignore` ya excluye `.env*` excepto `.env.example`.
- El modelo exacto depende del proveedor y cambia con el tiempo. Si no sabes cuál
  usar, deja la clave vacía y trabaja en modo determinista.
- Next.js lee `.env.local` automáticamente. **Python no**: para el registro, el
  core o `start.sh`, carga las variables en la shell antes de arrancar:

  ```bash
  set -a
  source .env.local
  set +a
  ```

- Para volver a la maqueta sin registro, pon `NEXT_PUBLIC_DATA_SOURCE=mock` y
  reinicia el portal.
- En Windows PowerShell puedes definir las variables con `$env:MCPORTAL_...` o
  usar un cargador de `.env`; los comandos `source` son de macOS/Linux.

## Arranque

Hacen falta tres terminales (o tres procesos) para la experiencia completa.

### Terminal 1 — webs de demo + panel

```bash
set -a; source .env.local; set +a
bash start.sh
```

Esto arranca:

- Librería Zeta en `8001`
- Casa Zeta en `8002`
- Gestoría Meridian en `8003`
- Panel en vivo en `8000`

`Ctrl+C` para todos. El panel y las webs guardan sus datos en memoria: al
reiniciar se pierden carritos, reservas y clientes creados.

También puedes arrancar cada web por separado:

```bash
.venv/bin/uvicorn sites.shop.app:app --host 127.0.0.1 --port 8001
.venv/bin/uvicorn sites.restaurant.app:app --host 127.0.0.1 --port 8002
.venv/bin/uvicorn sites.gestoria.app:app --host 127.0.0.1 --port 8003
.venv/bin/python core/panel/server.py
```

### Terminal 2 — registro

```bash
set -a; source .env.local; set +a
.venv/bin/python -m uvicorn registry.server:app --host 127.0.0.1 --port 8010
```

La primera vez crea `registry/registry.db` y carga `registry/seed.json` más los
manifiestos de `manifests/`. Si no responde, el portal cae al catálogo mock.

### Terminal 3 — portal

```bash
npm run dev
```

Abre <http://localhost:5179>.

Si solo quieres ver la interfaz sin backend, pon `NEXT_PUBLIC_DATA_SOURCE=mock`
en `.env.local`, reinicia el portal y no hace falta arrancar el registro.

## Cómo se usa

### Crear un MCP desde el portal

1. Abre <http://localhost:5179>.
2. Escribe una URL en el buscador principal. Si es una web nueva, pulsa
   **Conectar esta web** (también funciona pulsar Enter).
3. La URL se traslada al paso de creación.
4. Elige el modo: **solo lectura** o **lectura y escritura** (solo en demos o
   webs propias), y confirma que puedes automatizarla.
5. Espera la exploración. El registro emite eventos SSE en vivo.
6. Revisa las herramientas validadas, los nombres y los esquemas.
7. Publica el MCP con la confirmación de permiso.

### Instalar un MCP en tu cliente

Con el registro arrancado:

```bash
./mcportal install localhost-8003
```

El comando descarga el manifiesto en `manifests/localhost-8003.json` y muestra un
bloque `mcpServers` listo para pegar en la configuración de tu cliente MCP
(Claude Desktop, Claude Code, Cursor, etc.). El runtime se ejecuta por `stdio`:

```bash
.venv/bin/python -m mcportal_core.runtime.server manifests
```

El runtime lee todos los `.json` de `manifests/` y expone sus herramientas. No
necesita un servidor HTTP propio para el cliente MCP.

### Webs de demo

| Web | Puerto | Caso de uso |
|---|---|---|
| Librería Zeta | 8001 | Tienda con búsqueda, carrito y checkout simulado. Descubre el encadenamiento `cart_id`. |
| Casa Zeta | 8002 | Reservas con formulario HTML y CSRF: obliga a usar navegador. |
| Gestoría Meridian | 8003 | Software interno: buscar clientes, ficha, alta y subida de un PDF de balance. |

La gestoría arranca con **un único cliente base** (`CL-2026-0001`, Marta Rivas).
Los otros 7 clientes están como datos de entrada en
`sites/gestoria/sample-data/` (texto, JSON y PDFs) para que los crees tú desde
el MCP. Al crearlos en orden reciben `CL-2026-0002` a `CL-2026-0008`. Los PDFs
subidos se guardan en `sites/gestoria/uploads/` (ignorado en git).

## Tecnologías

| Capa | Tecnología |
|---|---|
| Portal | Next.js 15 (App Router), React 19, TypeScript, CSS con variables de diseño |
| Core | Python 3.11+, Playwright/Chromium, SDK MCP, httpx, BeautifulSoup, jsonschema |
| Registro | FastAPI, Uvicorn, SQLite, SSE, ficheros JSON |
| Panel | FastAPI + HTML/JS, eventos en vivo |
| Webs de demo | FastAPI + HTML/JS sin frameworks; formularios, CSRF y subida multipart |
| LLM | Anthropic (opcional); también hay soporte para proveedores compatibles con OpenAI |
| Persistencia | SQLite y `registry/data/` para el registro; `localStorage` para el estado del portal; memoria para las demos |

## Estructura

```text
core/
  mcportal_core/
    explorer/       exploración con navegador y análisis
    synthesizer/    generación del manifiesto
    validator/      validación ejecutando las herramientas
    runtime/        servidor MCP genérico por stdio
    panel/          panel en vivo
  tests/            pruebas de plantilla, MCP y generación

sites/
  shop/             Librería Zeta (8001)
  restaurant/       Casa Zeta (8002)
  gestoria/         Gestoría Meridian (8003)
  README.md         detalle de las tres webs

registry/
  server.py         API FastAPI + SSE + publicación
  seed.json         catálogo inicial
  install.py        implementación de ./mcportal install
  README.md         API y detalles del registro

src/
  app/              rutas Next.js
  screens/          Explorar, Crear, Cómo funciona, Biblioteca, detalle…
  components/       componentes compartidos
  services/         mock y cliente del registro
  store/            estado del portal
  styles/           CSS del portal

manifests/          manifiestos validados que lee el runtime
mcportal            CLI de instalación
start.sh            arranca demos + panel
.env.example        plantilla de configuración personal
```

## Comprobaciones y tests

```bash
# Core
.venv/bin/python core/tests/template_cases.py
.venv/bin/python core/tests/mcp_smoke.py
.venv/bin/python core/tests/generated_smoke.py

# Portal
npm run typecheck
npm run build
```

Para `npm run build`, **para antes el servidor de desarrollo**. Next.js usa la
misma carpeta `.next` para `dev` y `build`; si se ejecutan a la vez, el servidor
puede quedar corrupto. Si pasa:

```bash
rm -rf .next
npm run dev
```

## Variables de entorno

Todas las variables del core empiezan por `MCPORTAL_`; las públicas del portal
por `NEXT_PUBLIC_`.

| Variable | Uso |
|---|---|
| `MCPORTAL_LLM_PROVIDER` | `anthropic`, `openai`, `openrouter`, `deepseek` u `ollama`. |
| `MCPORTAL_LLM_API_KEY` | Clave del proveedor. Si falta, modo determinista. |
| `MCPORTAL_MODEL` | Modelo exacto del proveedor. |
| `MCPORTAL_LLM_BASE_URL` | URL base alternativa para proveedores compatibles con OpenAI. |
| `MCPORTAL_EFFORT_SYNTH` | Nivel de esfuerzo del sintetizador (`low`, `medium`, `high`). |
| `MCPORTAL_CONTACT` | Contacto que se añade al User-Agent. |
| `MCPORTAL_HEADED=1` | Muestra el navegador durante la exploración. |
| `MCPORTAL_ALLOW_WRITES=1` | Permite escrituras. **Solo en demos o webs propias.** |
| `MCPORTAL_FORCE_READ_ONLY=1` | Fuerza solo lectura aunque el modo pedido sea escritura. |
| `MCPORTAL_REGISTRY_URL` | URL que usa `./mcportal install` (por defecto `http://localhost:8010`). |
| `MCPORTAL_REGISTRY_PORT` | Puerto del registro (por defecto `8010`). |
| `MCPORTAL_CORS_ORIGINS` | Orígenes permitidos por el registro, separados por comas. |
| `MCPORTAL_USER` | Handle de autor que usa el registro (por defecto `davidpargaa`). |
| `NEXT_PUBLIC_DATA_SOURCE` | `mock` o `registry`. |
| `NEXT_PUBLIC_REGISTRY_URL` | URL del registro que consume el portal. |

## Seguridad y límites

- El explorador fuerza **solo lectura en webs de terceros**. No automatices
  acciones que creen, compren o reserven en sitios ajenos.
- Para escribir en una web propia, usa el modo de escritura y confirma el permiso.
  No pongas `MCPORTAL_ALLOW_WRITES=1` por defecto.
- No se admiten webs con login, captchas o pagos reales en esta demo.
- El registro no tiene autenticación: es anónimo en esta fase. No lo expongas
  públicamente sin añadir autenticación.
- El core necesita Chromium y trabajos largos: no está pensado para desplegarse
  en Vercel. El portal Next.js sí puede desplegarse aparte apuntando al registro.
- No subas `.env.local` ni claves al repositorio.

## Datos y reinicio

| Qué | Dónde | Cómo se reinicia |
|---|---|---|
| Catálogo del registro | `registry/registry.db`, `registry/data/` | para el registro y borra esas rutas |
| Manifiestos instalados | `manifests/` | vuelve a ejecutar `./mcportal install` |
| PDFs subidos a la gestoría | `sites/gestoria/uploads/` | borra los PDFs y reinicia la gestoría |
| Carritos, reservas y clientes | memoria de cada web | reinicia el proceso |
| Estado del portal | `localStorage` del navegador | borra los datos del sitio |

Las rutas generadas están en `.gitignore`; `manifests/` sí se versiona.

## Problemas frecuentes

**El portal no arranca o da un error raro después de un build.**

Para `npm run dev`, borra `.next` y vuelve a arrancar:

```bash
rm -rf .next
npm run dev
```

**El registro no responde.**

Comprueba `curl http://localhost:8010/health`. El portal seguirá funcionando con
el catálogo mock, pero la creación real avisará y usará la simulación.

**No aparece el LLM.**

Revisa que hayas hecho `source .env.local` en la terminal del registro/panel y
que `MCPORTAL_LLM_API_KEY` y `MCPORTAL_MODEL` estén definidos. Sin clave, todo
funciona en modo determinista.

**Falta Chromium.**


```bash
source .venv/bin/activate
python -m playwright install chromium
```

**Un puerto está ocupado.**

Mira qué proceso lo usa con `lsof -i :8003` (macOS/Linux) y páralo, o cambia el
puerto solo para pruebas. Los manifiestos y las demos esperan los puertos de la
tabla anterior.

## Documentación adicional

- [`registry/README.md`](registry/README.md): API del registro, generación,
  publicación y seguridad.
- [`sites/README.md`](sites/README.md): endpoints y comportamiento de las tres
  webs de demo.
- [`src/services/README.md`](src/services/README.md): capa de servicios del
  portal, mock y registro.
- [`MASTER_PROMPT.md`](MASTER_PROMPT.md): especificación completa del producto.
- [`MASTER_PROMPT_EQUIPO.md`](MASTER_PROMPT_EQUIPO.md): reparto de trabajo del
  equipo.
- [`DESIGN.md`](DESIGN.md): sistema de diseño.
- [`manifest.example.json`](manifest.example.json): forma de un manifiesto MCP.
