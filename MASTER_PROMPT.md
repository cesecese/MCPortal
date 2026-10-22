# MASTER PROMPT: MCPortal, desde cero

Este documento contiene **todo** lo necesario para construir MCPortal en un repositorio vacío. No depende de ningún
otro archivo. Recoge el brief original, la especificación del portal y lo aprendido al construir un prototipo
funcional del core (especificaciones exactas, prompts que funcionaron, código de referencia de las partes delicadas y
errores reales que no hay que repetir).

**Cómo leerlo:** el cuerpo (secciones 0 a 12) es la especificación vigente. Los anexos A y B son los documentos
originales (en el A solo se han cambiado las referencias a herramientas concretas por equivalentes
genéricos). Si algo del cuerpo contradice a un anexo, **manda el cuerpo**: son decisiones posteriores y
probadas (por ejemplo, los puertos, la espera de red o la web real elegida).

---

## 0. Cómo trabajar

- Construye por fases (sección 4) y **no empieces una fase sin verificar la anterior** con sus criterios de
  aceptación.
- Al terminar cada fase, informa de: qué funciona y con qué comando lo has comprobado (y su resultado), qué no has
  podido probar y qué decisiones has tomado por tu cuenta. Nunca des por probado algo que no has ejecutado.
- Primero el contrato (sección 6), después cada pieza contra datos de prueba escritos a mano y al final la
  integración. Ante la duda, que la demo funcione de extremo a extremo antes que añadir funcionalidades.
- Si algo se atasca más de 20 minutos, simplifica (o escribe a mano esa parte del manifiesto), sigue y avísame.
- Interfaz, documentación y descripciones de herramientas en **español**; código, identificadores y nombres de
  herramientas en **inglés**.
- **Pregúntame antes de:** lanzar exploraciones repetidas contra webs reales de terceros (gastan crédito de la API y
  pueden activar anti-bots), añadir una licencia, hacer commits o push, publicar o desplegar cualquier cosa, o matar
  procesos que no hayas arrancado tú.
- Antes de usar la API de una librería, comprueba la versión instalada: varias tienen versiones mayores recientes con
  cambios incompatibles (sección 3).

---

## 1. El producto

**MCPortal** es un proyecto open source con dos partes:

1. **Core:** le das la URL de una web **sin API pública**. Un agente la explora solo, descubre qué **acciones**
   permite (buscar, filtrar, ver detalle, crear, añadir, reservar, comprar…) y genera un **servidor MCP validado** con
   herramientas tipadas para esa web. Después, cualquier agente compatible con MCP se conecta y hace tareas
   reales en la web.
2. **Portal:** plataforma web para **descubrir, instalar, crear y publicar** los MCPs que genera el core. Es el punto
   de encuentro entre quien necesita un MCP y quien lo crea.

**Idea clave para el pitch:** el agente **no extrae contenido, descubre capacidades**. El resultado no son datos, son
herramientas. Frase de demo: «Esta web no tiene API. Dentro de tres minutos, tu agente podrá usarla como si la tuviera.
Cero clics humanos: de URL a herramientas funcionando.»

**Problema.** La mayoría de webs no tienen API: paneles internos, CRMs y ERPs antiguos, portales de proveedores o de
la administración, SaaS sin integración. Automatizarlas hoy significa meses de integración a medida o robots frágiles
que hacen clic.

**Dónde está el valor real.**
- **Caso principal:** webs a las que el usuario tiene **acceso legítimo** pero sin API (herramientas internas,
  portales de proveedores, SaaS que se paga). Ahí se lee **y se escribe**, la tarea se repite cada día y la
  alternativa actual es cara.
- **Webs públicas de terceros:** solo lectura. Sirven para demostrar que el sistema generaliza, no para venderlo.
- **Frente a la búsqueda web de un LLM** (pregunta segura del jurado):

  | | Búsqueda web del LLM | Herramienta generada |
  |---|---|---|
  | Datos | Lo indexado por un buscador, a veces desactualizado | La base de datos viva de la web (stock, precios) |
  | Webs con JavaScript (SPA) | Descargar el HTML no trae el contenido | Llama directamente a la API interna |
  | Filtros | Lo que aparezca en una página | Filtros reales: categoría, marca, precio, paginación |
  | Formato | Texto que hay que interpretar | JSON tipado y fiable |
  | Encadenar | Difícil | Ids de una herramienta a otra (`cart_id`, `brand_id`) |

  Y sobre todo: **se explora una vez y se usa siempre**. Un agente con navegador tarda minutos por tarea y falla a
  veces; aquí la exploración se paga una vez (unos 3 minutos) y después cada tarea es una llamada HTTP de
  milisegundos, validada y repetible, utilizable por cualquier agente. Para una pregunta puntual sobre información
  pública, la búsqueda web basta: no es el caso de uso.
- **Frase de pitch:** «Toda empresa tiene diez webs internas sin API. Hoy automatizarlas cuesta meses de integración
  o robots frágiles que hacen clic. Con MCPortal, de URL a herramientas en tres minutos.»
- **Siguiente paso que preguntará el jurado:** el login (casi todas las webs internas lo piden). Ver fase 4.

**Referencias y diferencia.**
- **Spectral (`spectral-mcp`):** genera MCPs a partir del tráfico grabado mientras **un humano** navega; tiene
  autorreparación.
- **Integuru (YC W24, open source):** a partir de un HAR grabado por un humano genera código Python; resuelve
  dependencias entre peticiones con un grafo (la mejor referencia de encadenamiento).
- **Pilot Browse MCP:** un agente explora webs y construye manuales de capacidades.
- **Nuestro diferencial:** ciclo **100 % autónomo**, **validado** antes de servir y **seguro por defecto**.

**Respuesta legal preparada.** Usar APIs internas no oficiales puede chocar con términos de servicio o leyes (CFAA en
EE. UU.). Por eso: las acciones con efectos (comprar, reservar) solo se hacen en webs propias o demos hechas para
practicar; en webs reales el explorador va en **solo lectura impuesta a nivel de red**; se respetan términos de uso y
User-Agent identificable; no se evaden anti-bots ni captchas; y publicar un MCP en el portal exige confirmar que se
tiene permiso para automatizar esa web.

---

## 2. Principios no negociables

1. **El LLM nunca genera código, solo datos estructurados.** Un único runtime genérico interpreta el manifiesto.
2. **Atribución determinista:** qué campo produce cada parámetro y qué id viene de qué respuesta se decide **con
   código** (valores centinela y búsqueda de valores en respuestas anteriores), nunca con el LLM. No alucina.
3. **Solo se sirve lo validado.** Cada herramienta se ejecuta con entradas de ejemplo antes de servirse o publicarse.
4. **Seguridad por defecto:** solo lectura fuera de una lista de webs permitidas, impuesta en la red (no solo en el
   prompt); el agente nunca inicia sesión, crea cuentas, paga ni publica contenido; se para ante verificaciones
   humanas; User-Agent con contacto.
5. **El contrato es el manifiesto** (sección 6): interfaz entre explorador, sintetizador, validador, runtime, registro
   y portal.
6. **Open source:** código claro, módulos de una sola responsabilidad, documentación de uso y de contribución.

---

## 3. Entorno y dependencias

- **Python 3.11+** con un venv en el repo. Dependencias del core (comprobadas en octubre de 2026):
  `mcp>=2.3` · `httpx>=0.27` · `playwright>=1.47` (+ `python -m playwright install chromium`) · SDK oficial del proveedor de LLM ·
  `fastapi>=0.110` · `uvicorn>=0.29` · `python-multipart>=0.0.9` · `beautifulsoup4>=4.12`.
- **Ojo con las versiones mayores:**
  - `mcp` 2.x cambió la API de bajo nivel: **ya no hay decoradores** (`@server.list_tools()`); los handlers se pasan
    al constructor y los tipos viven en `mcp_types` con campos en snake_case (sección 7.3).
  - Portal: **Next.js (App Router) con React 19 y TypeScript**. Next.js cambia bastante entre versiones mayores:
    comprueba la instalada antes de usar su API (por ejemplo, en las versiones recientes los `params` de las páginas
    dinámicas llegan como promesa).
- **Node 20+** para el portal.
- **Despliegue:**
  - **Portal en Vercel.** Next.js es su plataforma nativa: vista previa por rama y páginas renderizadas en servidor.
  - **El backend no cambia y no va a Vercel.** Core, panel y registro siguen en Python. El runtime MCP corre en la
    máquina de cada usuario (lo arranca su cliente MCP). El core y el registro, en local o en un servidor o contenedor
    propio: explorar es tener Chromium navegando varios minutos, y las funciones de Vercel están pensadas para
    peticiones cortas.
- **Puertos configurables.** En la máquina de desarrollo 3000 y 3001 están ocupados por otras apps (además escuchan en
  IPv6, así que `localhost:3001` acababa en otra app). Por defecto: tienda **8001**, restaurante **8002**, panel
  **8000**, registro **8010**, portal **5180** (Next.js arranca por defecto en el 3000, que está ocupado: usa
  `next dev -p 5180`).
- **Variables de entorno:**

  | Variable | Uso |
  |---|---|
  | `MCPORTAL_LLM_PROVIDER` | Proveedor de LLM (la capa de LLM es independiente del proveedor, sección 7.10) |
  | `MCPORTAL_LLM_API_KEY` | Clave del proveedor (o su variable estándar). Sin ella todo funciona en modo determinista (plan B) |
  | `MCPORTAL_MODEL` | Modelo del proveedor |
  | `MCPORTAL_EFFORT_SYNTH` | Nivel de razonamiento del sintetizador, si el proveedor lo admite (por defecto medio; el explorador usa bajo) |
  | `MCPORTAL_HEADED=1` | Ver el navegador de las herramientas browser en el runtime |
  | `MCPORTAL_CONTACT` | URL o email que se añade al User-Agent (Wikimedia o crates.io lo piden) |
  | `MCPORTAL_ALLOW_WRITES=1` | Quitar el modo solo lectura (nunca en webs reales de terceros) |

---

## 4. Fases

| Fase | Qué | Resultado |
|---|---|---|
| 1 | Core + webs de demo + panel en vivo + integración con clientes MCP | De URL a herramientas validadas usadas desde un cliente MCP |
| 2 | Portal en Next.js + React (solo capa de presentación, datos simulados), desplegable en Vercel | App navegable con identidad de marca, lista para conectar |
| 3 | Registro e integración portal ↔ core | Generación real desde el portal, publicar e instalar |
| 4 | Hoja de ruta (login, autorreparación, empaquetado open source) | Preguntar antes de empezarla |

---

## 5. Estructura del monorepo

```
core/
  pyproject.toml                 instalable en modo editable: pip install -e core
  mcportal_core/
    common/events.py             eventos JSONL de una ejecución
    common/llm.py                capa de LLM independiente del proveedor
    explorer/observe.js          observación compacta (código de referencia en 7.4)
    explorer/browser.py          sesión Playwright: captura, espera, atribución, solo lectura
    explorer/policies.py         agente LLM y heurística
    explorer/analyze.py          análisis determinista: centinelas, dependencias, candidatos
    explorer/explore.py          CLI del explorador
    synthesizer/synthesize.py    candidatos → manifiesto propuesto
    validator/validate.py        manifiesto propuesto → manifiesto validado
    runtime/executor.py          ejecuta herramientas http y browser (lo comparten runtime y validador)
    runtime/server.py            servidor MCP genérico
    pipeline.py                  explorar → sintetizar → validar → manifests/<sitio>.json
  panel/server.py, panel/index.html   panel en vivo
  tests/                         mcp_smoke.py, generated_smoke.py, fake_llm.py
sites/shop/                      tienda de demo (API JSON encadenada)
sites/restaurant/                restaurante de demo (HTML + CSRF)
portal/                          fase 2: Next.js + React (App Router, carpeta src/), desplegado en Vercel
registry/                        fase 3: FastAPI (backend, fuera de Vercel)
manifests/                       manifiestos validados (uno por web); los sirve el runtime
runs/<sitio>/                    trace.json, proposed.json, validation.json, events.jsonl (ignorado en git)
cache/<sitio>/trace.json         exploraciones buenas guardadas (plan B)
docs/
manifest.example.json            manifiesto escrito a mano para desarrollar contra él
start.sh                         arranca webs de demo y panel
```

`.gitignore`: `.venv/`, `__pycache__/`, `runs/`, `node_modules/`, `.next/`, `.vercel/`.

---

## 6. Contratos

### 6.1 Manifiesto

```jsonc
{
  "site": "localhost:8001",
  "start_url": "http://localhost:8001/",
  "synthesis": "llm",                       // "llm" | "heuristic"
  "validated_at": "2026-10-22 10:00:00",
  // metadatos de registro (los usa el portal; el runtime los ignora)
  "slug": "libreria-zeta", "display_name": "Librería Zeta", "version": "0.1.0",
  "category": "comercio", "tags": ["libros", "carrito"], "license": "MIT",
  "author": "handle", "mode": "read_write",  // "read_only" | "read_write"
  "generated_with": "mcportal-core 0.1",
  "tools": [
    {
      "name": "libreria_zeta_add_to_cart",   // snake_case, inglés, prefijo de sitio, único en todo el runtime
      "description": "Añade un libro al carrito. Requiere un cart_id obtenido con libreria_zeta_create_cart y un product_id obtenido con libreria_zeta_search_products.",
      "input_schema": {
        "type": "object",
        "properties": {
          "cart_id": {"type": "string", "description": "…"},
          "product_id": {"type": "string", "description": "…"},
          "qty": {"type": "integer", "description": "Unidades", "default": 1}
        },
        "required": ["cart_id", "product_id"]
      },
      "impl": {
        "kind": "http",
        "method": "POST",                    // cualquier método, incluido QUERY
        "url": "http://localhost:8001/api/cart/{cart_id}/items",
        "body_type": "json",                 // "json" | "form"
        "body": {"product_id": "{product_id}", "qty": "{qty}"},
        "headers": {}                        // opcional; admite {param}
      },
      "examples": {"product_id": "bk-1001", "qty": 1},                                  // solo validador
      "depends_on": [{"param": "cart_id", "tool": "libreria_zeta_create_cart", "path": "cart_id"}]  // solo validador
    },
    {
      "name": "casa_zeta_book_table",
      "description": "Reserva mesa… Devuelve el código de reserva.",
      "input_schema": {"type": "object", "properties": {
        "name": {"type": "string"}, "phone": {"type": "string"},
        "date": {"type": "string", "format": "date"},
        "time": {"type": "string", "enum": ["13:00", "13:30", "14:00", "14:30", "20:00", "20:30", "21:00", "21:30", "22:00"]},
        "people": {"type": "integer"}}, "required": ["name", "phone", "date", "time", "people"]},
      "impl": {
        "kind": "browser",
        "start_url": "http://localhost:8002/reservar",
        "steps": [                            // acciones: fill | select | click | press | check | wait
          {"action": "fill",   "selector": "form[action=\"/reservar\"] input[name=\"name\"]",   "value": "{name}"},
          {"action": "fill",   "selector": "form[action=\"/reservar\"] input[name=\"phone\"]",  "value": "{phone}"},
          {"action": "fill",   "selector": "form[action=\"/reservar\"] input[name=\"date\"]",   "value": "{date}"},
          {"action": "select", "selector": "form[action=\"/reservar\"] select[name=\"time\"]",  "value": "{time}"},
          {"action": "fill",   "selector": "form[action=\"/reservar\"] input[name=\"people\"]", "value": "{people}"},
          {"action": "click",  "selector": "form[action=\"/reservar\"] button[type=\"submit\"]"}
        ],
        "extract": "main"                     // selector CSS del texto que se devuelve
      }
    }
  ]
}
```

**Reglas de las plantillas** (las aplica el ejecutor, sección 7.2):
- Antes de rellenar se aplican los `default` del `input_schema`; los argumentos `null` se ignoran.
- En la URL, `{p}` se sustituye con codificación URL (los booleanos como `true` o `false`). Un par de query cuyo valor
  es solo `{p}` y `p` no viene en los argumentos **se elimina** de la URL (así hay parámetros opcionales).
- En el `body`, una cadena que es exactamente `"{p}"` se sustituye por el valor **con su tipo** (número, booleano);
  si `p` no viene, la clave se elimina. Las cadenas con `{p}` dentro se rellenan como texto. Las claves con puntos
  (`a.b`) representan JSON anidado.
- `body_type: "form"` envía `application/x-www-form-urlencoded` con todos los valores como texto.

`manifest.example.json` (escrito a mano en la fase 1, antes que nada) debe tener al menos: una herramienta `http` de
una web real de solo lectura (por ejemplo búsqueda en crates.io o Wikipedia), las cuatro del carrito de la tienda
(`search_products`, `create_cart`, `add_to_cart`, `checkout`), `check_availability` del restaurante (http GET) y
`book_table` (browser, como el ejemplo de arriba).

### 6.2 Traza de exploración (`runs/<sitio>/trace.json`)

```jsonc
{
  "site": "localhost:8001", "title": "Librería Zeta", "start_url": "…", "policy": "llm",
  "started": 1792607347.1, "finished": 1792607523.4,
  "steps": [{
    "i": 3, "action": {"type": "click", "id": 11},
    "element": {/* elemento de la observación (ver observe.js) */},
    "url_before": "…", "url_after": "…", "request_ids": [7, 8],
    "error": null, "note": null, "has_main": true, "forms": [/* forms de la observación */]
  }],
  "requests": [{
    "id": 7, "step": 3, "kind": "fetch", "method": "POST", "url": "…", "status": 200,
    "request_content_type": "application/json", "post_data": "{…}",
    "content_type": "application/json", "body": "…(hasta 200 KB)", "json": {/* si es JSON */}
  }],
  "candidates": [/* 6.3 */],
  "dependencies": [{"from_request": 6, "path": "cart_id", "to_request": 7, "location": "path", "key": null,
                    "value": "cart_8f2c1a", "from_candidate": "c4", "to_candidate": "c5"}]
}
```

### 6.3 Candidato (salida del análisis determinista)

```jsonc
{
  "id": "c5", "request_ids": [7], "variants": 1, "step": 3, "trigger": "click [11] button \"Añadir al carrito\"",
  "method": "POST", "origin": "http://localhost:8001", "path": "/api/cart/{cart_id}/items",
  "query": [["q", "{q}"], ["limit", "10"]],          // pares; los literales se conservan
  "url": "http://localhost:8001/api/cart/{cart_id}/items",
  "body_type": "json", "body": {"product_id": "{product_id}", "qty": 1},
  "params": [{
    "name": "cart_id", "type": "string", "example": "cart_8f2c1a", "location": "path", "key": null,
    "source": "response", "from_request": 6, "from_candidate": "c4", "path": "cart_id"
  }, {
    "name": "q", "type": "string", "example": "zxq_asimov", "location": "query", "key": "q",
    "source": "input", "label": "Buscar por título o autor"   // y "format"/"enum" si el campo los tenía
  }],
  "literals": [{"location": "query", "key": "limit", "value": "10"}],
  "status": 200, "content_type": "application/json", "response_preview": "{…reducido…}",
  "csrf_fields": [],                                  // p. ej. ["csrf_token"]
  "browser": {"start_url": "…", "steps": [/* como impl.browser */], "extract": "main", "params": [/* como params */]}
}
```

### 6.4 Eventos del pipeline (`runs/<sitio>/events.jsonl`)

Una línea JSON por evento, siempre con `t` (epoch) y `type`. Los consumen el panel y, en la fase 3, el portal (por
SSE). **Los tipos del portal deben coincidir con estos.**

| type | campos |
|---|---|
| `run_started` | `url`, `cached` |
| `explore_started` | `url`, `policy`, `max_steps` |
| `mode` | `read_only`, `site` |
| `warning` | `text` |
| `thought` | `text` (lo que piensa el agente, resumido) |
| `step` | `i`, `action` (texto legible), `url`, `requests` (ids), `error` |
| `request` | `id`, `step`, `method`, `url`, `status`, `kind` |
| `blocked` | `step`, `method`, `url` (envío cortado por solo lectura) |
| `finish` | `summary` |
| `candidate` | `id`, `method`, `url`, `params`, `csrf`, `browser` |
| `explore_done` | `steps`, `requests`, `candidates`, `dependencies` |
| `tool_proposed` | `name`, `kind`, `description` |
| `candidate_discarded` | `candidate_id`, `reason` |
| `synth_done` | `mode`, `proposed`, `discarded` |
| `validate_retry` | `name`, `reason`, `kind` |
| `validated` | `name`, `ok`, `kind`, `reason`, `swapped`, `status` |
| `validate_done` | `proposed`, `validated` |
| `done` | `proposed`, `validated`, `manifest` |

`slug` de una URL: el host con todo lo que no sea `[a-z0-9]` cambiado por `-` (`localhost:8001` → `localhost-8001`).

---

## 7. Fase 1: core

### 7.1 Webs de demostración (atrezo: rápidas, datos falsos, diseño mínimo pero digno)

**Tienda «Librería Zeta»** (`sites/shop`, FastAPI, puerto 8001). Pone a prueba endpoints JSON y encadenamiento de ids.
- Datos: 13 libros con ids largos tipo `bk-1001` (los ids de 2 caracteres no sirven para detectar dependencias),
  campos `id, title, author, category, price`; 4 categorías `{id, name}`: `scifi` (6 libros, incluidos Fundación y
  Yo, robot de Asimov), `fantasy`, `history`, `programming`.
- API:
  - `GET /api/categories` → `{categories: [...]}`
  - `GET /api/search?q=&category=` → `{query, category, count, results: [...]}` (q en título o autor; vacío = todo)
  - `GET /api/products/{product_id}` → producto + `stock` + `description`; 404 si no existe
  - `POST /api/cart` → `{cart_id: "cart_<8 hex>"}`
  - `GET /api/cart/{cart_id}` → `{cart_id, status, items: [{product_id, title, qty, subtotal}], total}`
  - `POST /api/cart/{cart_id}/items` `{product_id, qty}` → carrito; 404 carrito o producto inexistente, 409 carrito
    cerrado, 422 qty < 1
  - `POST /api/cart/{cart_id}/checkout` `{name, email}` → `{order_id, cart_id, total, customer, message}`; 409 si
    vacío o ya pagado (pago simulado)
- Página única en HTML + JS sin frameworks: buscador (`<form>` con `input name=q`, envío por fetch), enlaces de
  categoría (`href="#"`, cargan por fetch), rejilla de productos (cada uno con «Ver detalle», un `input type=number
  name=qty` y «Añadir al carrito»), botón «Ver carrito (n)» y formulario de checkout (`name`, `email`). Al cargar
  pide categorías y `search?q=`. El primer «Añadir» crea el carrito (`POST /api/cart`) y guarda el `cart_id` en
  memoria del JS. Ojo: en JS `form.name` es el nombre del formulario, no el input; usa
  `form.elements.namedItem("name")`.

**Restaurante «Casa Zeta»** (`sites/restaurant`, FastAPI, puerto 8002, HTML renderizado en servidor, sin JSON).
Pone a prueba herramientas de navegador y la elección http/browser.
- Franjas: `13:00, 13:30, 14:00, 14:30, 20:00, 20:30, 21:00, 21:30, 22:00`. **4 mesas por franja** (si hay una sola,
  la propia exploración ocupa la hora y la validación falla). Disponibilidad determinista: una franja está libre si
  `md5(f"{fecha}{hora}") % 10 < 10 - min(personas, 8)` y quedan mesas.
- Páginas (todas con cabecera de navegación y el contenido dentro de `<main>`; título «<página> · Casa Zeta»):
  - `GET /` inicio con enlaces; `GET /menu` estático.
  - `GET /disponibilidad?date=&people=`: `<form method=GET>` con `date` (type date) y `people` (number 1–12). Con
    datos, tabla de horas libres con enlaces `/reservar?date=…&time=…&people=…`. Datos inválidos → 400.
  - `GET /reservar`: `<form method=POST action=/reservar>` con `csrf_token` oculto, `name`, `phone` (tel), `date`,
    `time` (select con las franjas; preseleccionada si viene en la query) y `people`. Crea una cookie `session`
    httpOnly ligada al token.
  - `POST /reservar`: si la cookie no existe o el token no coincide → **403** «Token CSRF inválido»; datos inválidos
    → 400; sin mesa → 409 con enlace a otras horas; si todo va bien → página «Reserva confirmada» con código
    `R-XXXXXX` y **rota el token**.
  - `GET /reserva?code=`: consulta; una reserva inexistente devuelve **200** con «No existe ninguna reserva…» (no
    404, para que la herramienta valide).
- `start.sh`: arranca tienda, restaurante y panel con `trap 'kill 0' EXIT`.

### 7.2 Ejecutor compartido (`runtime/executor.py`)

Lo usan el runtime y el validador, para validar exactamente lo que se servirá.
- `Result(ok, status, text, data, url)`: `text` es lo que recibe el consumidor; `data` el JSON parseado (para
  encadenar en el validador).
- **http:** rellena según 6.1; `httpx.AsyncClient(timeout=20, follow_redirects=True)` con User-Agent
  `mcportal/0.1 (…; $MCPORTAL_CONTACT)`. Salida: `HTTP <estado>\n` + cuerpo:
  - JSON: `json.dumps(trim_strings(data), ensure_ascii=False, separators=(",", ":"))`, con `trim_strings` acortando
    toda cadena de más de 160 caracteres (las descripciones largas hacían que una lista de productos ocupara 15 000
    caracteres y se cortara tras 4 elementos, perdiendo la paginación del final).
  - HTML: `html_to_text` con BeautifulSoup: raíz = `main` o `[role=main]` o `#content|#main|#main-content|
    #page-content` o `body`; elimina `script, style, noscript, svg, nav, header, footer, template` y cualquier
    elemento cuyo `class` o `id` contenga `header|nav|navbar|menu|footer|breadcrumb|sidebar|cookie|banner`; conserva
    los enlaces como ` [href] texto`, separa celdas con ` | ` y bloques con saltos de línea. (Sin esto, en
    MusicBrainz la mitad de la respuesta eran menús.)
  - Recorte final a **8000 caracteres** con aviso «… (recortado, N caracteres en total)».
  - `ok` = estado 2xx.
- **browser:** un **único Chromium perezoso** por proceso (`MCPORTAL_HEADED=1` para verlo), una pestaña nueva por
  llamada que se cierra al final. Registra el estado de cada respuesta `document|xhr|fetch` del mismo host; recorre
  los pasos (`select`: primero por valor, si falla por etiqueta; `click`: clic y 300 ms); espera `networkidle`
  (máx. 8 s); devuelve `Página: <url>\n` + `inner_text` del selector `extract`. `ok` = el último estado registrado
  es < 400.

### 7.3 Runtime MCP genérico (`runtime/server.py`)

- API de bajo nivel del SDK, **no FastMCP** (FastMCP deduce esquemas de funciones; los nuestros vienen de JSON).
- Lee **todos** los `*.json` de las rutas que recibe por argumento (ficheros o carpetas); por defecto `manifests/`,
  o `manifest.example.json` si está vacía. **Relee en cada `list_tools` y `call_tool`** (los manifiestos se
  regeneran mientras corre). Nombres duplicados: se queda el primero y avisa por stderr.
- Errores → `is_error=True` con el mensaje (de la web o de la excepción), para que el consumidor se corrija.
- Vigila cada 2 s la fecha de modificación de los manifiestos y, si cambian, envía `send_tool_list_changed()` a las
  sesiones vistas (anunciando `NotificationOptions(tools_changed=True)`). Los logs, siempre a stderr.
- Código de referencia (mcp 2.x):

```python
import mcp.server.stdio
import mcp_types as types
from mcp.server.lowlevel import NotificationOptions, Server

async def list_tools(ctx, params) -> types.ListToolsResult:
    sessions.add(ctx.session)
    return types.ListToolsResult(tools=[
        types.Tool(name=t["name"], description=t.get("description", ""),
                   input_schema=t.get("input_schema") or {"type": "object", "properties": {}})
        for t in load_tools(PATHS).values()])

async def call_tool(ctx, params: types.CallToolRequestParams) -> types.CallToolResult:
    sessions.add(ctx.session)
    tool = load_tools(PATHS).get(params.name)
    if tool is None:
        return types.CallToolResult(content=[types.TextContent(text=f"Herramienta desconocida: {params.name}")], is_error=True)
    try:
        result = await executor.run(tool, params.arguments or {})
    except Exception as e:
        return types.CallToolResult(content=[types.TextContent(text=f"Error ejecutando {params.name}: {e}")], is_error=True)
    return types.CallToolResult(content=[types.TextContent(text=result.text)], is_error=not result.ok)

server = Server("mcportal", version="0.1.0",
                instructions="Herramientas generadas automáticamente explorando webs sin API. Si una herramienta pide "
                             "un id (cart_id, product_id…), obtenlo antes con la herramienta que indica su descripción.",
                on_list_tools=list_tools, on_call_tool=call_tool)

async def main():
    watcher = asyncio.create_task(watch_manifests())   # envía s.send_tool_list_changed() a cada sesión vista
    try:
        async with mcp.server.stdio.stdio_server() as (read_stream, write_stream):
            await server.run(read_stream, write_stream,
                             server.create_initialization_options(NotificationOptions(tools_changed=True)))
    finally:
        watcher.cancel()
        await executor.close()
```

- El encadenamiento lo resuelve el consumidor: el servidor no orquesta flujos; expone herramientas con buenas
  descripciones y el agente consumidor encadena solo.

### 7.4 Explorador

**Sesión** (`explorer/browser.py`):
- Chromium visible por defecto (`slow_mo=150` si es visible; `--headless` opcional), contexto `locale="es-ES"`,
  viewport 1280×860.
- **Dominio base:** los dos últimos labels del host (`www.demoblaze.com` → `demoblaze.com`, para aceptar
  `api.demoblaze.com`); host con puerto o IP, tal cual. «Mismo sitio» = host igual o subdominio del base.
- **Captura:** en el **contexto** (no la página), `response` de tipo `xhr`, `fetch` o `document`, del mismo sitio y
  que no sean estáticos (`.js .css .png .jpg .svg .woff…`). Por cada una: cuerpo (si no es redirección; máx.
  200 KB), JSON parseado si el content-type lo es, `post_data`, content-type de la petición y paso actual. **Calcula
  el id de la petición sin ningún `await` entre calcularlo y añadirla a la lista** (si no, los ids se duplican).
- Ventanas emergentes: se cierran. Diálogos (`alert/confirm`): se descartan.
- **Atribución acción → peticiones:** antes de cada acción se apunta cuántas peticiones hay; se ejecuta; se espera a
  que la red esté inactiva; las nuevas se asocian a esa acción. Si la acción saca del dominio, se vuelve atrás y se
  anota.
- **Espera de red propia.** `wait_for_load_state("networkidle")` vuelve enseguida si la página ya había cargado y
  **no espera a los fetch que lanza un clic**. Cuenta las peticiones en vuelo con los eventos `request`,
  `requestfinished` y `requestfailed` del contexto:

```python
async def wait_idle(self, quiet=0.5, timeout=6.0):
    await asyncio.sleep(0.25)                      # deja que arranquen los fetch con debounce
    deadline, calm_since = time.monotonic() + timeout, None
    while time.monotonic() < deadline:
        if self.inflight == 0:
            calm_since = calm_since or time.monotonic()
            if time.monotonic() - calm_since >= quiet:
                break
        else:
            calm_since = None
        await asyncio.sleep(0.05)
    if self.pending:                               # tareas que leen cuerpos de respuestas
        await asyncio.gather(*self.pending, return_exceptions=True)
```

- **Acciones:** `click(id)` (timeout 3 s), `fill(id, value, submit)` (Enter si `submit`), `select(id, option)` (por
  valor y, si falla, por etiqueta), `goto(url)` (timeout 15 s, para no colgarse en páginas de verificación humana),
  `back()`. Se localizan con `page.locator('[data-agent-id="N"]').first` (atraviesa shadow DOM abierto).
- **Regla de `goto`:** el agente conoce muchas webs por su entrenamiento y **escribirá URLs con parámetros**
  (`goto /search?q=dune`); entonces no hay relleno que atribuir y la exploración no produce herramientas (pasó en
  Open Library: 0 herramientas). Rechaza toda URL con query que no aparezca como enlace en la última observación,
  con este error: «no construyas URLs con parámetros: haz la acción con la interfaz (rellena el campo y envíalo; si
  el buscador o el formulario está oculto, pulsa el botón que lo abre). goto solo sirve para ir a secciones o seguir
  enlaces de la página». La carga inicial está exenta.
- **Solo lectura:** si el dominio base no está en la lista de permitidas (`localhost`, `127.0.0.1`,
  `demoblaze.com`, `automationintesting.online`, `practicesoftwaretesting.com`, `toscrape.com`) y no hay
  `MCPORTAL_ALLOW_WRITES=1`, todo envío que no sea GET, HEAD u OPTIONS hacia el sitio se aborta en la red, se emite
  `blocked` y la acción lleva la nota «solo lectura, web real: bloqueado POST /ruta». Se emite `mode` al empezar.

```python
await self.context.route("**/*", self._guard)

async def _guard(self, route):
    req = route.request
    if req.method not in ("GET", "HEAD", "OPTIONS") and same_site(req.url, self.base):
        self.blocked.append({"step": self.step, "method": req.method, "url": req.url})
        self.events.emit("blocked", step=self.step, method=req.method, url=req.url)
        await route.abort()
    else:
        await route.continue_()
```

**Observación compacta** (`explorer/observe.js`, se ejecuta con `page.evaluate`). Nunca se pasa HTML al LLM. Este
código ya resolvió varios problemas reales (shadow DOM, enlaces a fichas sin agrupar, límite que dejaba fuera el
buscador, selectores que no casaban, etiquetas con el texto de las opciones):

```javascript
() => {
  const SEL = 'a[href], button, input, select, textarea, [role=button], [role=link], [onclick]';
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const quote = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const isField = el => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  const labelOf = el => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    if (isField(el)) {
      if (el.labels && el.labels.length) {   // solo el texto propio del <label>, sin las opciones del select
        const lab = el.labels[0];
        const own = clean([...lab.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' '));
        return (own || clean(lab.innerText)).slice(0, 60);
      }
      return clean(el.placeholder || el.getAttribute('name') || el.title || el.id);
    }
    return clean(el.innerText || el.value || el.title || el.getAttribute('alt') || '').slice(0, 60);
  };
  const normHref = href => {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return '#';
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return u.href;
      // /works/OL45883W/Foundation → /works/{id}: lo que sigue al primer id suele ser un slug
      const path = u.pathname.replace(/\/[^/]*\d[^/]*(?=\/|$)/g, '/{id}').replace(/(\{id\}).*$/, '$1');
      return path + (u.search ? '?…' : '') + (u.hash && u.pathname === location.pathname ? u.hash : '');
    } catch (e) { return href; }
  };
  const forms = [...document.forms];
  const formInfo = forms.map((f, i) => ({
    index: i + 1,
    method: (f.getAttribute('method') || 'GET').toUpperCase(),
    action: f.getAttribute('action') || location.pathname,
    hidden: [...f.querySelectorAll('input[type=hidden]')].map(h => ({ name: h.name, value: h.value })),
  }));
  const scopeOf = el => {
    const f = el.form;
    if (!f) return '';
    if (f.id) return `form#${CSS.escape(f.id)} `;
    if (f.getAttribute('action')) return `form[action="${quote(f.getAttribute('action'))}"] `;
    return `form:nth-of-type(${forms.indexOf(f) + 1}) `;
  };
  const selectorOf = (el, label) => {   // selectores estables para las recetas de navegador
    const tag = el.tagName.toLowerCase();
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const scope = scopeOf(el);
    const name = el.getAttribute('name');
    if (name) return `${scope}${tag}[name="${quote(name)}"]`;
    if (tag === 'button' && el.getAttribute('type') === 'submit') return `${scope}button[type="submit"]`;
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute(attr);
      if (v) return `${scope}${tag}[${attr}="${quote(v)}"]`;
    }
    if (label && !isField(el)) return `${scope}${tag}:has-text("${quote(label.slice(0, 40))}")`;  // nunca en inputs
    return null;
  };
  let next = window.__agentNextId || 1;
  const groups = new Map();
  const elements = [];
  // Recorre también los shadow roots abiertos (web components); los locators de Playwright los atraviesan.
  const deepQuery = (root, sel, out = []) => {
    out.push(...root.querySelectorAll(sel));
    for (const host of root.querySelectorAll('*')) if (host.shadowRoot) deepQuery(host.shadowRoot, sel, out);
    return out;
  };
  for (const el of deepQuery(document, SEL)) {
    if (el.type === 'hidden' || el.disabled || !visible(el)) continue;
    let id = el.getAttribute('data-agent-id');
    if (!id) { id = String(next++); el.setAttribute('data-agent-id', id); }
    const tag = el.tagName.toLowerCase();
    const label = labelOf(el);
    const href = tag === 'a' ? normHref(el.getAttribute('href')) : null;
    const kind = tag === 'a' ? 'link' : (el.getAttribute('role') || tag);
    // los enlaces a fichas (/works/{id}) se agrupan por patrón aunque el texto cambie
    const key = href && href.includes('{id}') ? `link|${href}`
      : [kind, el.type || '', label, href || '', el.getAttribute('name') || ''].join('|');
    if (groups.has(key)) { groups.get(key).similar++; continue; }
    const info = {
      id: Number(id), tag, kind, label, href,
      raw_href: tag === 'a' ? el.href : null,
      type: isField(el) ? (el.type || tag) : (el.getAttribute('type') || null),
      name: el.getAttribute('name'),
      value: isField(el) ? el.value : null,
      required: !!el.required,
      min: el.getAttribute('min'), max: el.getAttribute('max'),
      options: tag === 'select' ? [...el.options].map(o => ({ value: o.value, label: clean(o.text) })).slice(0, 12) : null,
      form: el.form ? forms.indexOf(el.form) + 1 : null,
      selector: selectorOf(el, label),
      similar: 0,
    };
    groups.set(key, info);
    elements.push(info);
  }
  window.__agentNextId = next;
  const main = document.querySelector('main') || document.body;
  return {
    url: location.href,
    title: document.title,
    text: clean(main.innerText).slice(0, 400),
    has_main: !!document.querySelector('main'),
    // límite: primero campos y botones, después enlaces, manteniendo el orden del documento
    elements: (() => {
      const links = elements.filter(e => e.kind === 'link').slice(0, 50);
      const rest = elements.filter(e => e.kind !== 'link').slice(0, 90);
      const keep = new Set([...links, ...rest]);
      return elements.filter(e => keep.has(e));
    })(),
    forms: formInfo,
  };
}
```

**Texto que ve el LLM** (`render_observation`):
```
URL: /  ·  Título: Librería Zeta
Texto visible: <primeros 300 caracteres del main>
[1] button "Ver carrito (0)"
[2] input[text] "Buscar por título o autor" name=q (form GET /)
[3] button "Buscar" (form GET /)
[5] link "Ciencia ficción"
[9] button "Ver detalle" (×13 similares)
[10] input[number] "qty" name=qty valor='1' (×13 similares)
[9] select "Hora" name=time opciones: 13:00, 13:30, 14:00, … (form POST /reservar)
```
(tipo entre corchetes solo en input/textarea; `name=`, `valor=` si tiene, `opciones:` hasta 8, `→ href` si no es
`#`, `(form MÉTODO acción)` y `(×N similares)`).

**Agente LLM** (`explorer/policies.py`). Bucle manual con herramientas (sección 7.10 para los parámetros de la API):
- Herramientas (todas `strict: true` con `additionalProperties: false`):
  `click{id:int}`, `fill{id:int, value:str, submit:bool}`, `select{id:int, option:str}`,
  `goto{url:str}` («Navega a una sección o enlace del mismo dominio (sin construir parámetros)»), `back{}`,
  `finish{summary:str}`.
- Primer mensaje: «Web a explorar», fecha de hoy, pista del dominio (opcional), aviso de **MODO SOLO LECTURA** si
  aplica («Céntrate en buscar, filtrar y consultar; cualquier envío que modifique datos se bloqueará»), «Tienes como
  máximo N acciones», peticiones de la carga inicial y la observación.
- El modelo puede pedir **varias acciones por turno** (rellenar tres campos y pulsar enviar): se ejecutan en orden y
  cada `tool_result` dice `OK.` o `Error: …` (con `is_error`), la nota si la hay, y las peticiones provocadas:
  `  NUEVO POST /api/cart/{…}/items body={"product_id":"bk-1001","qty":1} → 200 json{cart_id, status, items}`
  («NUEVO» si el patrón `MÉTODO /ruta-normalizada?claves` no se había visto). Al **último** resultado del turno se
  le añade: endpoints descubiertos, «Acciones usadas: X/N» y la nueva observación.
- Se añade al historial la respuesta completa del asistente. El razonamiento resumido (si el proveedor lo devuelve)
  y el texto se emiten como evento `thought` (400 caracteres).
- Para: `finish`, máximo de acciones (20), **6 acciones seguidas sin endpoints nuevos**, o 3 respuestas seguidas
  sin herramienta (tras pedirle «Responde con una herramienta (o finish si has terminado)»).
- Si la API del LLM falla (red, cuota, clave o rechazo), emite `warning` y sigue con la heurística en la misma sesión.
- **Prompt de sistema (probado; úsalo tal cual):**

```text
Eres un agente que explora una web para descubrir qué ACCIONES permite (buscar, filtrar, ver detalle, crear, añadir, reservar, comprar…), no para leer su contenido. Con lo que descubras se generarán herramientas tipadas para que otro agente use la web como si tuviera API.

Cómo explorar:
- Prueba cada tipo de formulario y de botón UNA vez. No repitas patrones (si hay 20 botones «Añadir al carrito», pulsa uno) y no explores contenido (no abras diez fichas de producto).
- Completa los flujos de varios pasos hasta el final (añadir al carrito → ver carrito → finalizar compra; consultar disponibilidad → reservar): así se descubren los encadenamientos de identificadores.
- En campos de texto libre usa valores centinela con prefijo zxq_ que describan el campo (zxq_asimov, zxq_nombre, zxq@example.com). En números, fechas, horas y desplegables usa valores válidos y realistas.
- Rellena todos los campos de un formulario y después pulsa su botón de envío. Puedes pedir varias acciones en el mismo turno (por ejemplo, rellenar tres campos y pulsar enviar); se ejecutan en orden.
- Si una búsqueda con centinela no da resultados, vuelve al listado y sigue con el resto de acciones.
- Quédate en el dominio. No inicies sesión, no crees cuentas, no publiques ni edites contenido, no hagas pagos reales y no pulses enlaces de redes sociales, idioma, cookies o textos legales.
- No escribas URLs con parámetros en goto aunque conozcas la web: el sistema solo aprende una acción si la haces con la interfaz, porque así sabe qué campo produce cada parámetro. Si un buscador o formulario no está visible, pulsa el botón o icono que lo abre.
- Si una página te lleva a una verificación humana o a un captcha, no insistas: es un límite de la web.
- Llama a finish cuando hayas probado todas las acciones distintas o cuando tus últimas acciones ya no descubran peticiones nuevas.

Tras cada acción verás las peticiones de red que provocó y, al final del turno, la página resultante. Los elementos se identifican por su número entre corchetes.
```

**Heurística sin LLM** (plan B y pruebas sin clave). Por cada observación:
1. Encola los enlaces internos (mismo host, con `href` real) cuyo patrón de página no se ha visitado; si ya hay uno
   para ese patrón, prefiere el que lleva query (suele venir precargado, como `/reservar?date=…&time=…`).
2. Pulsa el primer botón (o `role=button`) fuera de formulario no probado en esta página, o un enlace `#` (máximo 2
   por página). Clave de «probado»: (página, tipo, etiqueta); como «Ver carrito (1)» cambia de etiqueta, se vuelve a
   pulsar y descubre `GET /api/cart/{id}`.
3. Si no hay botones nuevos, rellena el siguiente formulario no probado (clave: página, método, acción y **nombres de
   sus campos**, porque los formularios JS sin `action` comparten `GET /`) y pulsa su envío (o Enter en el último
   campo). Valores: el valor precargado si lo hay; email `zxq.user@example.com`; tel `600123456`; número el `min` o
   `2`; fecha hoy + 2 días; hora `21:00`; select el valor actual o la primera opción no vacía; texto
   `zxq_<name>`. Nunca password, file ni checkbox.
4. Si no queda nada en la página, `goto` al siguiente enlace encolado; si no hay, termina.
- Nunca pulsa elementos cuya etiqueta case con `borrar|eliminar|delete|remove|logout|cerrar sesi|salir|sign out|
  iniciar sesi|log in|sign in|registr|sign up|idioma|language|cookies|privacidad|privacy|saltar al|skip to|donar|
  donate|editar|edit|publicar|publish|subir archivo|upload|comentar|comment`.
- Limitación conocida: en webs reales grandes es floja (pulsa elementos tapados, sigue contenido). Para webs reales
  usa el agente LLM.

### 7.5 Análisis determinista (`explorer/analyze.py`): el corazón

Para cada petición capturada, en orden:
1. **Rellenos:** pasos `fill`/`select` sin error, anteriores o iguales al paso de la petición, con `value`, `name`,
   `label`, `type`, `selector`, `form` y `options` del elemento.
2. **Huecos** de la petición: segmentos del path, pares de la query y hojas del body (JSON aplanado con rutas tipo
   `a.b[0].c`; o pares de formulario).
3. **Clasifica cada hueco:**
   - **Entrada** si coincide con un relleno: valor igual **y** (misma clave que el `name` del campo, o el valor
     contiene `zxq`, o tiene 4+ caracteres); o el valor contiene un centinela `zxq…`. Nombre del parámetro: la clave
     (última parte de la ruta) en snake_case; en el path, el `name` o la etiqueta del campo.
   - **Dependencia** si el valor (4+ caracteres, no `true/false/null`, no un entero de 1–3 cifras) aparece como hoja
     de una respuesta JSON **anterior**, buscando de la más reciente a la más antigua y **saltando las del mismo
     endpoint** (si no, `category` acababa dependiendo de la propia búsqueda en lugar de `/api/categories`). Nombre:
     la clave del hueco; en el path, si la clave de origen es genérica (`id, key, uuid, pk, slug`), el segmento
     anterior en singular + `_id` (`/products/{x}` → `product_id`).
   - **Literal** en otro caso.
   - Nombres únicos por candidato (`name_2`…). Tipo: `integer`/`number` si el campo era number/range; `boolean` si
     checkbox; si no, el tipo JSON del valor; `format: date` si el campo era date; `enum` con las opciones de un
     select.
4. **¿Es candidata?**
   - `xhr`/`fetch`: sí, salvo un GET que devuelve HTML sin parámetros (precargas, service worker).
   - Documento no GET (envío de formulario POST): sí.
   - Documento GET: solo si tiene parámetros de entrada y lo disparó un envío de formulario (`fill` con submit, o
     clic en un elemento de formulario). Navegar por enlaces no crea herramientas.
5. **CSRF:** literales de body o query de 16+ caracteres cuya clave case con `csrf|xsrf|authenticity|(^|_)token$` o
   cuyo valor sea un campo oculto del formulario → `csrf_fields`.
6. **Receta de navegador** si la disparó un `click` o un `fill` con submit sobre un elemento con selector: bloque de
   pasos consecutivos en la misma página que acaba en el disparo, los `fill`/`select` del **mismo formulario** (el
   último por campo gana) con `{param}` y el clic final (o `press Enter`). Parámetros: los de la petición si casan;
   si no, a partir del campo. `extract`: `main` si la página tenía `<main>`, si no `body`.
7. **Plantilla:** huecos de entrada o dependencia → `{nombre}`; literales tal cual (y los literales numéricos del
   body conservan el tipo).
8. **Agrupa** por `método + origen + path` (con `{…}` normalizados): une las variantes (los pares de query nuevos se
   añaden y un parámetro gana a un literal), une parámetros, se queda con la receta de navegador con más parámetros,
   y cuenta `variants`. Asigna ids `c1, c2…` y resuelve `from_candidate` de cada dependencia.
9. `response_preview`: JSON reducido (listas a 2 elementos + «… (N elementos)», cadenas a 80) o el texto del HTML,
   600 caracteres.

### 7.6 Sintetizador (`synthesizer/synthesize.py`)

- Entrada para el LLM (JSON compacto, sin cuerpos completos): `site`, `site_title`, `prefix`, `start_url`, resumen de
  pasos (`"3: click [11] button \"Añadir al carrito\" → POST /api/cart, POST /api/cart/{…}/items"`) y candidatos
  (`id, method, url, body_type, body, status, content_type, response_preview, trigger, csrf_fields, variants`,
  params sin `location`/`from_request`, literales no vacíos de query y body, y `browser` como
  `{start_url, params: [nombres]}`).
- **Prefijo de sitio:** en webs reales, el dominio (`openlibrary.org` → `openlibrary`); en localhost, el nombre del
  sitio sacado del título: parte el título por ` · `, ` | `, ` - `, ` — `, ` : ` **antes** de quitar caracteres no ASCII
  (si no, desaparece el `·`), descarta segmentos genéricos (`inicio, home, welcome, bienvenido, index, portada,
  principal`) y toma las dos primeras palabras del último (`Inicio · Casa Zeta` → `casa_zeta`).
- Llamada con **salida estructurada estricta**. El esquema estricto exige `additionalProperties: false` en todos los
  objetos, así que **no se puede pedir un JSON Schema libre**: el LLM devuelve los parámetros como lista y el código
  construye `input_schema`. Esquema exacto:

```json
{
  "type": "object",
  "properties": {
    "tools": {"type": "array", "items": {
      "type": "object",
      "properties": {
        "candidate_id": {"type": "string"},
        "name": {"type": "string"},
        "description": {"type": "string"},
        "kind": {"type": "string", "enum": ["http", "browser"]},
        "method": {"type": "string"},
        "url": {"type": "string"},
        "body_type": {"type": "string", "enum": ["none", "json", "form"]},
        "body": {"type": "array", "items": {"type": "object",
          "properties": {"key": {"type": "string"}, "value": {"type": "string"}},
          "required": ["key", "value"], "additionalProperties": false}},
        "params": {"type": "array", "items": {"type": "object",
          "properties": {
            "name": {"type": "string"},
            "type": {"type": "string", "enum": ["string", "integer", "number", "boolean"]},
            "description": {"type": "string"},
            "required": {"type": "boolean"},
            "example": {"type": "string"},
            "enum": {"type": "array", "items": {"type": "string"}},
            "depends_on_tool": {"type": "string"},
            "depends_on_field": {"type": "string"}},
          "required": ["name", "type", "description", "required", "example", "enum", "depends_on_tool", "depends_on_field"],
          "additionalProperties": false}}},
      "required": ["candidate_id", "name", "description", "kind", "method", "url", "body_type", "body", "params"],
      "additionalProperties": false}},
    "discarded": {"type": "array", "items": {"type": "object",
      "properties": {"candidate_id": {"type": "string"}, "reason": {"type": "string"}},
      "required": ["candidate_id", "reason"], "additionalProperties": false}}
  },
  "required": ["tools", "discarded"],
  "additionalProperties": false
}
```

- **Prompt de sistema (probado):**

```text
Conviertes la traza de exploración de una web en herramientas MCP para que otro agente use esa web como si tuviera API. Los parámetros y las dependencias ya vienen resueltos por código determinista: tu trabajo es decidir qué candidatos merecen ser herramientas, nombrarlas, describirlas, deduplicarlas y escribir sus esquemas. Solo produces datos; nunca código.

Reglas:
- Una herramienta por capacidad distinta (buscar, ver detalle, crear carrito, añadir, pagar, consultar, reservar…). Descarta lo que no aporta: cargas de página, peticiones de analítica o seguimiento, recursos internos, duplicados. Explica cada descarte en discarded.
- kind "http" si hay un endpoint claro. kind "browser" si el candidato tiene csrf_fields (token ligado a la sesión) o solo funciona a través de la interfaz. En browser, usa exactamente los nombres de parámetro de browser.params del candidato; url, method y body se ignoran.
- En http, url y body son plantillas: {nombre} se sustituye por el parámetro. Puedes renombrar un parámetro (q → query) cambiándolo también en la plantilla, convertir en parámetro un literal útil (p. ej. qty) o dejar literales fijos. Cada {nombre} de la plantilla debe estar en params. Un parámetro de query opcional ausente se omite de la URL.
- Nombres en snake_case e inglés, con el prefijo de sitio indicado (p. ej. PREFIJO_search_products).
- Descripciones en español, concretas: qué hace, qué devuelve y de qué depende («requiere un cart_id obtenido con PREFIJO_create_cart»). Incluye formatos (fecha YYYY-MM-DD) y valores válidos conocidos.
- Si un parámetro sale de la respuesta de otra herramienta (source "response" en el candidato), pon en depends_on_tool el nombre de la herramienta que generas para el candidato from_candidate y en depends_on_field la ruta del campo (path del candidato, p. ej. results[0].id o cart_id). Si no, déjalos vacíos.
- example: valor realista para probar la herramienta. Nunca el centinela zxq_…: si el campo era una búsqueda, pon un término con resultados probables. Vacío en los parámetros que salen de dependencias.
```

- **Montaje del manifiesto** (código, no LLM):
  - `browser`: impl = receta del candidato; si el LLM omitió un parámetro que la receta usa, se añade desde la
    receta. Sin receta → se descarta con aviso.
  - `http`: método (o el del candidato), URL, `body` reconstruido desde la lista (claves con puntos → anidado) y
    **cada literal recupera su tipo original** si coincide con el texto del body observado (`qty: 1`, no `"1"`).
  - **Descarta** la herramienta si la plantilla usa `{p}` no declarado.
  - Adjunta `impl.alt` (receta de navegador) solo si sus parámetros son **exactamente** los mismos que los de la
    plantilla http (lo usa el validador).
  - Conserva `format` y `enum` del análisis aunque el LLM no los repita. **Convierte los `enum` al tipo del
    parámetro** y descarta los que no encajen (el LLM y los select los dan como texto; un `limit` entero con
    `enum: ["25","50"]` rompe a los clientes estrictos).
  - `examples` desde `example` convertido al tipo; `depends_on` desde `depends_on_tool`/`depends_on_field`; nombres
    repetidos o candidatos desconocidos se descartan con aviso.
- **Modo determinista** (sin clave, `--no-llm` o si el LLM falla por error de la API o JSON inválido): una
  herramienta por candidato, nombre `<prefijo>_<método>_<palabras del path sin {…}, api, v1, v2>`, **siempre http
  primero** (el validador cambia a navegador si hace falta), parámetros opcionales si son de query y el candidato
  tiene varias variantes, descripción «MÉTODO /ruta en sitio. Descubierta al hacer: … Respuesta de ejemplo: …».

### 7.7 Validador (`validator/validate.py`)

- Orden topológico por `depends_on`.
- Argumentos: `examples` + dependencias resueltas desde la salida JSON de la herramienta origen ya validada. La ruta
  admite `results[0].id`; si no existe, se busca la clave final en cualquier nivel; si sigue sin haber valor, se usa
  el ejemplo. Falta un requerido sin valor → «sin valor de ejemplo».
- **Juicio:** mala si el estado no es 2xx, el cuerpo está vacío, el JSON tiene `error`/`errors`, o (sin JSON) los
  primeros 300 caracteres casan con `\b(error|exception|traceback|not found|no encontrad|forbidden|denegad)`.
- **Autorreparación ligera:** si falla y hay `impl.alt`, se prueba; si funciona, se cambia la implementación y se
  anota «http falló (estado 403); funciona con navegador». (Con la regla de «mismos parámetros», porque una receta
  que pulsaba «Añadir al carrito» sin usar `cart_id` ni `product_id` dio un **falso positivo**.)
- Salida: manifiesto solo con las validadas (sin `alt` ni `candidate`), `validated_at`, y `validation.json` con
  `{proposed, validated, results: [{name, kind, ok, reason, swapped, args, status, seconds, preview}]}`.

### 7.8 Pipeline y caché

`python -m mcportal_core.pipeline URL [--policy auto|llm|heuristic] [--no-llm] [--headless] [--max-steps 20]
[--hint "…"]` → reinicia `events.jsonl`, explora, guarda `trace.json`, sintetiza (`proposed.json`), valida
(`validation.json`) y escribe `manifests/<slug>.json`. `--from-trace cache/<slug>/trace.json` **repite en el panel
la exploración guardada** (emite pasos y peticiones con 0,35 s entre pasos) y vuelve a sintetizar y validar: es el
plan B de la demo. `auto` = LLM si hay clave; si no, heurística con aviso.

### 7.9 Panel en vivo (`panel/`)

- FastAPI (puerto 8000): `GET /` (página), `GET /api/runs` (ejecuciones y la activa), `GET /api/events?run=&since=N`
  (eventos desde la línea N; si el fichero encoge, el cliente reinicia), `GET /api/manifest?run=`,
  `POST /api/run {url, policy, no_llm, from_cache, headless}` (una a la vez, 409 si hay otra; vacía los eventos
  **antes** de lanzar el subproceso del pipeline; el subproceso hereda el entorno del panel, incluida la clave).
- Página (HTML + JS sin frameworks, oscura, sondeo cada 400 ms): cabecera con URL, selector de agente
  (auto/LLM/heurístico), «desde caché», «Explorar», botones rápidos de las webs de demo y selector de ejecuciones;
  barra de fases (1 Explorar · 2 Sintetizar · 3 Validar · 4 Servir por MCP); tres columnas: **Agente** (pasos
  numerados, pensamientos, avisos, «🔒 Solo lectura»), **Red capturada** (método coloreado, ruta, estado, tipo;
  bloqueados en rojo) y **Herramientas** (candidatos, herramientas propuestas con su tipo http/browser que pasan a ✓
  o ✗, notas de reintento y cambio a navegador) con el contador «N propuestas · M validadas». Al acabar: «listo →
  manifests/… · en el cliente MCP: reconectar si no aparecen».

### 7.10 Capa de LLM (`common/llm.py`), independiente del proveedor

El resto del core no conoce el proveedor: solo llama a dos funciones de `common/llm.py`.

- `agent_turn(system, tools, messages, effort)`: un turno del agente explorador. Devuelve el texto, el razonamiento
  resumido (si el proveedor lo da) y la lista de llamadas a herramientas, con sus entradas ya parseadas como JSON.
- `structured(system, user, schema, effort)`: una respuesta JSON válida contra el esquema (para el sintetizador).

**Requisitos del modelo:** llamadas a herramientas con esquemas estrictos y varias llamadas por turno; salida
estructurada con JSON Schema estricto (o, si no la hay, una herramienta con ese esquema); contexto amplio (el bucle
acumula unas 20 observaciones).

**Configuración:** `MCPORTAL_LLM_PROVIDER`, `MCPORTAL_MODEL` y la clave (`MCPORTAL_LLM_API_KEY` o la variable
estándar del proveedor). Usa el SDK oficial del proveedor elegido; no escribas peticiones HTTP a mano a su API.

**Parámetros:**
- **Explorador:** razonamiento bajo (prima la rapidez), hasta unos 8000 tokens de salida y herramientas estrictas.
  Usa caché de prompt si el proveedor la ofrece: el sistema, las herramientas y el historial se repiten en cada turno.
- **Sintetizador:** razonamiento medio, hasta unos 16 000 tokens de salida y salida estructurada estricta con el
  esquema de la sección 7.6.

**Lecciones generales (aplican a cualquier proveedor):**
- Algunos modelos **rechazan que se fuerce una herramienta concreta**. Usa el modo automático, pide la herramienta en
  el prompt y, si la respuesta no trae ninguna, vuelve a pedirla (hasta dos veces) antes de rendirte.
- Los esquemas estrictos exigen `additionalProperties: false` en todos los objetos y todos los campos en `required`.
  Por eso los parámetros del sintetizador van como lista y el esquema final lo construye el código.
- Devuelve al historial la respuesta completa del asistente, incluidos los bloques de razonamiento si el proveedor
  los exige para continuar la conversación.
- Parsea las entradas de las herramientas como JSON y valídalas contra su esquema; nunca compares el texto en bruto.
- Trata igual los errores de API (red, cuota, clave) y los rechazos del modelo: aviso en el panel y vuelta a la
  heurística o al sintetizador determinista. La demo no debe caerse por el LLM.
- Valida el JSON del sintetizador contra el esquema aunque el proveedor lo garantice.

### 7.11 Pruebas

- `tests/mcp_smoke.py`: arranca el runtime por stdio con un cliente MCP (`mcp.client.stdio.stdio_client` +
  `ClientSession`) sobre `manifest.example.json` y llama a todo: buscar, crear carrito, añadir, checkout,
  disponibilidad y reserva (browser con CSRF).
- `tests/generated_smoke.py`: lo mismo con los manifiestos **generados**: buscar → carrito → 2 artículos →
  checkout → disponibilidad → reserva.
- `tests/fake_llm.py`: sustituye la capa de LLM por respuestas guionizadas (perezosas, turno a turno, buscando ids en
  la observación) para ejercitar el bucle del agente (varias acciones por turno, resultado con observación), el
  montaje del sintetizador (renombrar `q` → `query`, convertir `qty` en parámetro) y la validación encadenada.
- Ejecuta las tres tras cada cambio del core.

### 7.12 Integración con clientes MCP

El runtime es un servidor MCP por stdio: el cliente MCP del usuario lo arranca como proceso local. La mayoría de
clientes aceptan esta configuración (bloque `mcpServers`):

```json
{
  "mcpServers": {
    "mcportal": {
      "command": "/ruta/al/repo/.venv/bin/python",
      "args": ["-m", "mcportal_core.runtime.server", "/ruta/al/repo/manifests"],
      "env": {"MCPORTAL_CONTACT": "https://github.com/tu-equipo/mcportal"}
    }
  }
}
```

- Rutas absolutas: el cliente no arranca el servidor desde la carpeta del repo.
- Las variables del runtime van en `env` de esta configuración: el servidor lo arranca el cliente, no tu terminal.
- Tras regenerar manifiestos, el runtime envía `tools/list_changed` y las herramientas nuevas aparecen solas en los
  clientes que lo soportan. En los demás, reconecta el servidor desde el cliente. Los cambios de **código** del
  runtime solo se cargan al reiniciar el servidor.
- Para que la demo no se interrumpa, aprueba de antemano en el cliente las herramientas del servidor `mcportal`.
- En la fase 3, `mcportal install <slug>` escribe este bloque (o lo imprime para copiarlo).

### 7.13 Webs reales: lo que se comprobó

| Web | Resultado | Notas |
|---|---|---|
| **Toolshop** (practicesoftwaretesting.com) | **5/5 validadas** con el agente LLM: buscar, listar con filtros (categoría, marca, precio), categorías, marcas, especificaciones | La mejor demo «ajena». API en `api.practicesoftwaretesting.com`, usa el método HTTP **`QUERY`**, tiene Cloudflare (lenta, puede fallar en directo). El agente paró antes del carrito: relánzalo con pista «abrir ficha y añadir al carrito» |
| **crates.io** | Buscar dispara `GET /api/v1/crates?page=1&per_page=10&sort=relevance&q=…` | Real, conocida por público técnico, sin anti-bots vistos. Piden User-Agent con contacto y 1 petición/s. Recomendada como web real |
| **MusicBrainz** | 1 herramienta: búsqueda por tipo (artist, release, recording, event…) | Formulario GET que devuelve HTML. La búsqueda simple no filtra por fecha (`method=advanced` sí). Las fichas no se convierten en herramientas (ver fase 4) |
| **Wikipedia** | Escribir en el buscador dispara `GET /w/rest.php/v1/search/title?q=…` | Tiene API oficial (menos impactante en el pitch). **Se edita sin cuenta**: por eso existe el modo solo lectura |
| **Open Library** | El autocompletado de la portada llama a `GET /search.json` | Buscador dentro de un web component (shadow DOM). `/search` redirige a `/verify_human`. Estuvo **caída** el 21-10-2026. El agente inventó URLs (de ahí la regla de `goto`) |
| Demoblaze, automationintesting.online | Cargan rápido; API en `api.demoblaze.com/entries` y `/api/room` | Demos de práctica: se permite escribir (carrito, reserva de hotel) |
| quotes.toscrape.com | `POST /filter.aspx` con `__VIEWSTATE` | Desplegables con autopostback que confunden a la heurística |
| Lichess | Página «Un momento…» (anti-bots) | Descartada |

### 7.14 Criterios de aceptación de la fase 1

- [ ] Tienda y restaurante en modo determinista: todas validadas (7/7 y 3/3); la reserva pasa a navegador tras el
  403 por CSRF; la cadena del carrito usa un `cart_id` nuevo.
- [ ] `generated_smoke.py`, `mcp_smoke.py` y `fake_llm.py` pasan.
- [ ] Con clave: el agente LLM explora la tienda y el restaurante; una web real en solo lectura (crates.io) produce al
  menos una herramienta validada; la exploración se guarda en `cache/`.
- [ ] El panel muestra una ejecución completa en vivo y en modo caché.
- [ ] Desde un cliente MCP con el servidor registrado, se completa la tarea cruzada de la demo (sección 11).

---

## 8. Fase 2: portal (solo capa de presentación)

Los requisitos literales están en el **anexo B** y son obligatorios. Aquí van las concreciones.

- **Contexto:** el que pide el anexo B («lee contexto.txt») es este documento (secciones 1, 2 y 6).
- **Alcance:** solo interfaz, datos simulados y estado local; sin motor, APIs externas, base de datos, autenticación,
  descargas ni publicaciones reales. Pero **nada de pantallas estáticas**: botones, filtros, buscadores, menús,
  formularios y flujos responden; lo que no existe se simula de forma convincente.
- **Tecnología: Next.js + React**, decidido por el equipo para que el portal quede cuidado y se despliegue en
  Vercel. El backend no cambia.
  - **Base:** Next.js con App Router, React y TypeScript en `portal/`, con la carpeta `src/`. Comprueba la versión
    mayor instalada antes de usar su API.
  - **Estilos:** tokens en variables CSS (`src/styles/tokens.css`, importado en el layout raíz) y CSS Modules por
    componente. **Sin kit de UI genérico** ni plantillas.
  - **Fuentes con `next/font`** (por ejemplo IBM Plex Sans y Mono): se descargan al compilar y se sirven desde el
    propio dominio, sin peticiones a servicios externos.
  - **Iconos:** un único set.
  - **Rutas** (`src/app/`):
    - `page.tsx`: inicio y explorador
    - `mcp/[slug]/page.tsx`: detalle
    - `crear/page.tsx` y `biblioteca/page.tsx`
    - `u/[handle]/page.tsx`: perfil
    - `not-found.tsx`
    - `styleguide/page.tsx`: solo en desarrollo; en producción llama a `notFound()`. Ojo: las carpetas que empiezan
      por `_` no generan ruta.
  - **Servidor y cliente:**
    - El catálogo y el detalle se renderizan en servidor con los datos de `services/`. Así los enlaces se pueden
      compartir, y `generateMetadata` da a cada MCP su título y descripción para buscadores y redes.
    - Todo lo interactivo es componente de cliente (`"use client"`): buscador, filtros, copiar, estrellas, «Crear»,
      biblioteca y paleta de comandos.
    - `localStorage` solo se usa en cliente y después de montar, para no provocar errores de hidratación.
    - Los MCPs que crea el usuario viven en `localStorage`: si el servidor no encuentra su página de detalle, se
      resuelve en cliente.
  - **Capa de datos tras una interfaz** (`src/services/`):
    - Una implementación mock (datos de ejemplo, sin `window` ni `localStorage`, válida en servidor y en cliente) y,
      en la fase 3, la del registro.
    - Se elige con `NEXT_PUBLIC_DATA_SOURCE=mock|registry`, sin tocar pantallas.
    - **Tipos idénticos al contrato** (6.1) y a los eventos (6.4).
  - **Persistencia** en `localStorage` (estado local de cliente en `src/state/`): lo creado, publicado y guardado, y
    el perfil editado.
  - **Despliegue en Vercel:**
    - `next build` debe pasar sin errores de tipos; cada rama tiene su vista previa.
    - Pregunta al equipo antes de crear o conectar el proyecto de Vercel.
    - En local: `next dev -p 5180`.
- **Dirección visual recomendada** (mejórala si tienes un motivo, pero que no parezca una plantilla):
  - **Concepto:** registro técnico / hoja de especificaciones. Papel `#F4F2EC`, tinta `#15140F`, reglas `#D9D5CA`,
    texto secundario `#6E6A60`, un único color de señal naranja `#FF4F1A` (en texto `#C2370A` por contraste); estados:
    verde `#1F7A4D` validado/publicado, ámbar `#B7791F` borrador, azul `#2B59C3` en preparación.
  - **Tipografía:** IBM Plex Sans (interfaz) + IBM Plex Mono (ids, firmas, comandos, etiquetas en versalitas con
    tracking).
  - **Catálogo como índice con líneas divisorias**, no rejilla de tarjetas con sombra. Firmas de herramientas en
    mono: `search_products(query: string, category?: string) → JSON` con etiqueta `HTTP GET` o `BROWSER`. Bloques
    tipo terminal (tinta) para instalar y para el registro de generación. Indicadores: instalaciones, estrellas,
    validación «7/7» y una pequeña sparkline de instalaciones semanales.
  - **Logotipo:** un «puerto» (un conector que encaja en un hueco) + wordmark «MCPortal».
  - **Detalles de herramienta para desarrolladores:** `/` enfoca el buscador, paleta de comandos con ⌘K, copiar
    comando con confirmación, estados de foco visibles, transiciones sutiles.
- **Datos de ejemplo creíbles y variados:** las webs de la sección 7.13 y las de demo, más MCPs de herramientas
  internas genéricas (panel de facturas, intranet de vacaciones, CRM antiguo) y portales públicos; autores con
  handle; categorías (comercio, reservas, datos abiertos, desarrollo, música y cultura, administración pública,
  herramientas internas, viajes); instalaciones, estrellas, fechas, modo solo lectura / lectura y escritura,
  verificados.
- **Pantallas** (anexo B, con estas concreciones):
  - **A. Inicio y explorador:** propuesta de valor con un ejemplo vivo «URL → herramientas»; buscador destacado;
    «Crear MCP»; catálogo con filtros (categoría, implementación http/navegador/mixta, modo, verificados) y orden
    (popular, reciente, mejor validado); estado vacío de búsqueda.
  - **B. Detalle:** instalación con pestañas (CLI `mcportal install <slug>`, bloque JSON `mcpServers` para cualquier
    cliente MCP, instalación manual) y copiar; pestañas
    Herramientas (firma, descripción, tipo, parámetros desplegables), Manifiesto (visor JSON), Validación (informe
    por herramienta con tiempos) y Versiones; ficha técnica (versión, licencia, transporte stdio, implementación,
    modo, última validación, instalaciones, repositorio); autor; relacionados.
  - **C. Crear (4 pasos navegables):** 1) URL con validación, pista para el agente y modo (lectura y escritura exige
    confirmar permiso); 2) generación simulada que imita al core: fases Explorar → Sintetizar → Validar, registro en
    vivo con eventos como los de 6.4, contadores, herramientas apareciendo y cancelar (escenarios por dominio +
    generador genérico); 3) revisión: nombre, slug, descripción, activar/desactivar herramientas, editar
    descripciones, «N propuestas · M validadas», vista previa del manifiesto; 4) publicación: visibilidad (pública,
    no listada, privada), categoría, etiquetas, licencia y **confirmación obligatoria de permiso**; «Publicar»
    (pantalla de éxito con comando de instalación) y «Guardar borrador».
  - **D. Biblioteca:** Publicados, Borradores, En preparación (un trabajo simulado que avanza y acaba en borrador con
    aviso) y Guardados; abrir, editar (vuelve a la revisión), duplicar, publicar/despublicar, eliminar con
    confirmación; estados vacíos con llamada a la acción.
  - **E. Perfil y navegación:** perfil propio y de otros autores (estadísticas, MCPs, actividad), editar perfil, menú
    de usuario, 404 con identidad, avisos, navegación móvil.
- **Verificación obligatoria:**
  - `next build` sin errores.
  - Arranca la app (`next start -p 5180` o la vista previa de Vercel) y haz capturas con Playwright de cada vista a
    1440, 834 y 390 px.
  - Recorre los flujos: buscar → detalle → copiar instalación; crear de principio a fin; gestionar la biblioteca.
    Recarga la página en cada paso para comprobar la persistencia y que no haya errores de hidratación.
  - Ni errores ni avisos en la consola.
  - Corrige y repite hasta que parezca un producto terminado.

---

## 9. Fase 3: registro e integración

- **`registry/`** (FastAPI, puerto 8010, SQLite + ficheros): `GET /mcps` (búsqueda y filtros), `GET /mcps/{slug}`,
  `GET /mcps/{slug}/manifest`, `POST /generate` (lanza el pipeline del core como trabajo), `GET /jobs/{id}/events`
  (SSE con los eventos de 6.4), `POST /mcps` (publicar, exige confirmación de permiso), versiones, estrellas y
  reportes.
- **Portal:**
  - Con `NEXT_PUBLIC_DATA_SOURCE=registry` y `NEXT_PUBLIC_REGISTRY_URL`, `services/` pasa a llamar al registro.
  - El paso 2 de «Crear» muestra la generación real del core (eventos por SSE).
  - El registro debe permitir CORS desde el dominio de Vercel y desde `localhost:5180`.
  - El backend (registro y trabajador de generación) no se despliega en Vercel: corre en local o en un servidor o
    contenedor propio.
- **Instalación:** CLI `mcportal install <slug>` que descarga el manifiesto a `manifests/` y registra el runtime en
  el cliente MCP del usuario (o imprime el bloque de configuración). El runtime puede leer también del registro.
- **Gobernanza:** solo lectura por defecto; revalidación periódica (marca como «roto» lo que deje de validar);
  reportes; nunca publicar MCPs de webs con login de terceros sin confirmación de permiso.

## 10. Fase 4: hoja de ruta (preguntar antes)

- **Webs con login:** el usuario inicia sesión una vez en el navegador del explorador; se guarda el `storage_state`
  de Playwright y lo reutilizan explorador, validador y runtime. Abre el caso principal (herramientas internas).
  Para demostrarlo: una zona privada en el restaurante («panel de gestión» de reservas con usuario y contraseña).
- **Autorreparación:** si una herramienta deja de validar, reexplorar solo ese flujo y proponer el arreglo.
- **Fichas de detalle:** convertir en herramientas las páginas que se abren desde resultados (hoy solo formularios y
  llamadas a APIs), para encadenar «buscar → ver detalle» también en webs HTML.
- **Búsquedas avanzadas:** detectar modos avanzados (como `method=advanced` de MusicBrainz) y exponerlos como
  parámetro.
- **Empaquetado open source:** licencia, CONTRIBUTING, CI con las pruebas de humo, documentación de arquitectura y
  contrato.

---

## 11. Demo y pitch

**Guion (5 minutos):**
1. Presentar la tienda como «la web interna de una empresa, sin API».
2. Lanzar la exploración **en directo** desde el panel con el agente LLM: navegador moviéndose, peticiones
   capturadas, herramientas apareciendo.
3. Validación: «N propuestas, M validadas». Enseñar en el restaurante el cambio «http 403 → navegador» por CSRF.
4. En el cliente MCP, las herramientas ya están (o se reconecta el servidor).
5. Tarea que cruza webs: «Busca libros de ciencia ficción de Asimov en la tienda, añade dos al carrito, paga a nombre
   de Ada (ada@example.com) y resérvame mesa para 4 el viernes a las 21:00». Si sobra tiempo, una consulta a una web
   real en solo lectura (crates.io o Toolshop: «¿qué productos de MightyCraft hay en stock?»).
6. Cierre: diferencial (autónomo, validado, seguro), respuesta legal, valor en herramientas internas y el login como
   siguiente paso.

**Plan B:** exploraciones buenas en `cache/` (`--from-trace` o «desde caché» en el panel) y un vídeo grabado de la
demo completa. Las webs reales pueden caerse (Open Library lo hizo) o tener anti-bots.

**Reglas de recorte:** no prometer que funcione en cualquier web, solo en las elegidas; nada de webs con login,
pagos reales, captchas o anti-bots; autorreparación completa y extras solo si sobra tiempo.

---

## 12. Reparto orientativo (equipo de 4, hackathon de 5 h)

| Persona | Responsabilidad |
|---|---|
| 1 | Explorador: Playwright, observación, captura, atribución, centinelas, análisis |
| 2 | Sintetizador y validador |
| 3 | Runtime MCP, pipeline, integración con clientes MCP |
| 4 | Webs de demo, panel en vivo, pitch (y portal si da tiempo) |

| Tiempo | Qué |
|---|---|
| 0:00–0:30 | Contrato, stack, webs y guion; `manifest.example.json` |
| 0:30–2:30 | Piezas en paralelo contra datos escritos a mano |
| 2:30–3:30 | Integración de extremo a extremo con las webs de demo |
| 3:30–4:15 | Web real y pulido del panel |
| 4:15–5:00 | Congelar, grabar vídeo de respaldo, ensayar el pitch dos veces |

---

# Anexo A: brief original (adaptado)

> Documento original del proyecto; solo se han cambiado las referencias a herramientas concretas por
> equivalentes genéricos. Donde contradiga al cuerpo (puertos 3001/3002, `networkidle` como espera,
> Open Library como web real), manda el cuerpo.

# Auto-MCP: brief del proyecto (hackathon de 5 h, equipo de 4)

> Documento de contexto para el asistente de IA que lo implemente. Resume la idea, las decisiones ya tomadas y el plan. Trabajemos de forma incremental: primero el contrato (manifiesto), después cada pieza por separado con datos de prueba y al final la integración. Ante la duda, prioriza que la demo funcione de extremo a extremo antes que añadir funcionalidades.

---

## 1. La idea

Le das una URL de una web **sin API pública**. Un agente la explora solo, descubre qué **acciones** permite (buscar, filtrar, crear, reservar, comprar…) y genera un **servidor MCP** con herramientas tipadas para esa web. Después, un agente consumidor (cualquier cliente MCP) se conecta a ese servidor y hace tareas reales en la web.

Importante para el pitch: el agente **no scrapea contenido, descubre capacidades**. El resultado no son datos, son herramientas.

**Frase de la demo:** «Esta web no tiene API. Dentro de tres minutos, tu agente podrá usarla como si la tuviera. Cero clics humanos: de URL a herramientas funcionando.»

## 2. Referencias y en qué nos diferenciamos

- **Spectral (`spectral-mcp`)**: graba el tráfico mientras **un humano** navega, un LLM interpreta las llamadas y genera herramientas MCP. Tiene autorreparación: si una herramienta falla, un LLM la corrige.
- **Integuru (YC W24, open source)**: a partir de un HAR (grabado por un humano), cookies y un prompt, genera código Python que llama a los endpoints internos. Resuelve dependencias entre peticiones con un **grafo**: recorre desde las peticiones finales hacia atrás hasta la petición maestra. Es la mejor referencia para el encadenamiento.
- **Pilot Browse MCP**: un agente explora webs y construye "manuales" con capacidades reutilizables.
- Piezas base: Playwright (lo usaremos directamente), browser-use y Playwright MCP.

**Nuestro diferencial:** ciclo **100 % autónomo y en vivo**: explorar, descubrir, sintetizar, validar, servir y usar, sin que un humano navegue. Si sobra tiempo: autorreparación.

**Nota legal:** usar APIs internas no oficiales puede chocar con los términos de servicio o con leyes (CFAA en EE. UU.). Por eso usamos webs propias y una pública sin login. Hay que tener la respuesta preparada por si el jurado pregunta.

## 3. Webs objetivo (2 propias + 1 real)

Las webs propias son atrezo: tienen que estar listas en 20 o 30 minutos, con datos falsos y diseño mínimo.

1. **Tienda propia con API JSON y peticiones encadenadas** (caso fácil y difícil a la vez)
   - Buscador que llama a `GET /api/search?q=...`
   - `POST /api/cart`, que devuelve un `cart_id`
   - `POST /api/cart/{cart_id}/items` con `product_id` y `qty`
   - `POST /api/cart/{cart_id}/checkout`
   - Pone a prueba la detección de endpoints y el encadenamiento de IDs.

2. **Reservas de restaurante propia, solo HTML renderizado en servidor** (sin API JSON)
   - Formularios clásicos (`<form method="POST">`) para buscar disponibilidad y reservar.
   - Pone a prueba las herramientas de tipo navegador. Nota: el POST del formulario también se captura, así que a veces se puede convertir en herramienta HTTP. Si metemos un token CSRF, se fuerza el uso de Playwright. Decidir si incluirlo, porque demuestra que el agente elige el tipo de herramienta según lo que encuentra.

3. **Web real: Open Library** (o similar, pública, sin login ni anti-bots)
   - Su buscador usa una API JSON detectable en el tráfico.
   - Demuestra que el sistema generaliza y no está hecho a medida.
   - **Comprobar antes del hackathon** que la exploración funciona.

## 4. Arquitectura (5 piezas)

```
URL ──► [1] Explorador ──► traza + emparejamientos
                           │
                           ▼
        [2] Sintetizador ──► manifest.json (propuesto)
                           │
                           ▼
        [3] Validador ──► manifest.json (solo herramientas que funcionan)
                           │
                           ▼
        [4] Runtime MCP genérico ◄──► [5] Cliente MCP (consumidor)
```

### 4.1 El contrato: `manifest.json`

Es la interfaz entre todas las piezas. Se cierra en la primera media hora y cada pieza se desarrolla contra un manifiesto escrito a mano mientras las demás no existen.

```json
{
  "site": "openlibrary.org",
  "tools": [
    {
      "name": "search_books",
      "description": "Busca libros por título o autor",
      "input_schema": {
        "type": "object",
        "properties": { "query": { "type": "string" } },
        "required": ["query"]
      },
      "impl": {
        "kind": "http",
        "method": "GET",
        "url": "https://openlibrary.org/search.json?q={query}"
      }
    },
    {
      "name": "book_table",
      "description": "Reserva mesa en el restaurante",
      "input_schema": { "...": "..." },
      "impl": {
        "kind": "browser",
        "start_url": "http://localhost:3002/reservar",
        "steps": [
          { "action": "fill", "selector": "input[name=people]", "value": "{people}" },
          { "action": "fill", "selector": "input[name=date]", "value": "{date}" },
          { "action": "click", "selector": "button[type=submit]" }
        ],
        "extract": "main"
      }
    }
  ]
}
```

Hay dos tipos de implementación: **`http`** (plantilla de petición, rápida y robusta) y **`browser`** (pasos de Playwright con parámetros). Pendiente de definir: cómo se representan el cuerpo de un POST y las cabeceras en `impl` (propuesta: `body` como plantilla JSON o form y `headers` opcional).

### 4.2 Explorador

Bucle **observar → decidir → actuar** sobre un Chromium controlado con Playwright (visible, que queda mejor en la demo).

**Captura de red.** Antes de empezar, `page.on("response", ...)` guarda las peticiones `xhr` y `fetch` y también las navegaciones `document` con POST (envíos de formularios). De cada una: método, URL, cuerpo enviado, estado y un fragmento de la respuesta.

**Observación compacta.** Nunca pasar el HTML al LLM. Un script de JavaScript inyectado recorre los elementos interactivos **visibles** (`a`, `button`, `input`, `select`, `textarea`, `[role=button]`), asigna `data-agent-id` y devuelve:

```
URL: /shop  ·  Título: Tienda
[3] input "Buscar productos" (placeholder)
[4] button "Buscar"
[7] link "Ciencia ficción"
[12] button "Añadir al carrito" (×20 similares)
```

Los elementos repetidos se agrupan ("×20 similares") para no gastar pasos.

**Decisión.** El LLM recibe la observación, una memoria corta de lo explorado y una pista del dominio. Responde con una llamada a herramienta: `click(id)`, `fill(id, value)`, `select(id, option)`, `goto(url)`, `back()` o `finish()`. Se ejecuta con `page.locator('[data-agent-id="N"]')`.

Idea clave del prompt: *«Tu objetivo es descubrir qué acciones distintas permite la web. Prueba cada tipo de formulario y botón una vez. No repitas patrones ni explores contenido.»*

**Atribución acción → peticiones (el corazón).** Antes de cada acción se apunta el número de peticiones capturadas; después se ejecuta, se espera con `wait_for_load_state("networkidle")` y las peticiones nuevas se asocian a esa acción:

```json
{ "accion": "fill [3] 'zxq_asimov' + click [4]",
  "peticiones": [{ "method": "GET", "url": "/api/search?q=zxq_asimov", "status": 200 }] }
```

**Valores centinela.** Al rellenar campos, el agente usa valores raros y reconocibles (`zxq_asimov`, `zxq_4`). Después, **con código y no con el LLM**, se buscan en las peticiones capturadas para saber qué input corresponde a qué parámetro. Es determinista y no alucina. Lo mismo para IDs encadenados: si un valor de una respuesta (por ejemplo `cart_id`) aparece después en otra petición, hay una dependencia.

**Límites.** Unos 20 pasos como máximo, solo el mismo dominio, URLs normalizadas (`/book/123` pasa a ser `/book/{id}`) para no repetir páginas, y parar cuando no aparezcan patrones nuevos.

**Salida.** La traza completa más los emparejamientos de parámetros y dependencias ya resueltos.

### 4.3 Sintetizador

Un LLM convierte la traza en el `manifest.json`. Como los emparejamientos ya vienen resueltos, su trabajo es sobre todo **nombrar, describir, deduplicar y escribir los esquemas**.

- Preferir `http` si hay un endpoint claro; usar `browser` si solo funciona por interfaz o hay CSRF o sesión.
- En las descripciones, explicitar las dependencias: *«requiere un `cart_id` obtenido con `create_cart`»*.
- El LLM **solo produce datos estructurados (JSON), nunca código**.

### 4.4 Validador

Ejecuta cada herramienta propuesta con entradas de ejemplo (las de la exploración sirven), comprueba que la respuesta tiene sentido (estado 2xx, cuerpo no vacío, sin página de error) y descarta las que fallan. Para la demo, muestra algo como «14 herramientas propuestas, 11 validadas».

### 4.5 Runtime MCP genérico

**No generamos código del servidor con el LLM.** Hay un único servidor genérico que lee el manifiesto.

- Python, con la **API de bajo nivel del SDK de MCP** (`mcp.server.lowlevel.Server`), no FastMCP, porque FastMCP deduce los esquemas de funciones escritas a mano y los nuestros vienen de un JSON.
- `list_tools`: lee `manifest.json` y devuelve `Tool(name, description, inputSchema)` tal cual.
- `call_tool(name, arguments)`: según `impl.kind`:
  - `http`: rellena la plantilla y hace la petición con `httpx`.
  - `browser`: reproduce los pasos con Playwright sustituyendo los parámetros.
  - Devuelve el resultado como texto, recortado si es largo.
- Un único navegador abierto mientras vive el servidor, para no lanzar Chromium en cada llamada.
- Tamaño estimado: unas 60 u 80 líneas.
- Extra opcional: vigilar el manifiesto y emitir `notifications/tools/list_changed` para que las herramientas nuevas aparezcan sin reconectar.

**El encadenamiento lo resuelve el consumidor.** El servidor no tiene que orquestar el flujo del carrito. Expone `create_cart()`, `add_to_cart(cart_id, product_id, qty)` y `checkout(cart_id)` con buenas descripciones, y el agente consumidor encadena solo.

### 4.6 Uso desde un cliente MCP

El servidor se registra en el cliente MCP como proceso local por stdio (bloque `mcpServers` con el comando
`python server.py`).

- El cliente muestra el estado del servidor y sus herramientas (`search_books`, etc.).
- Las herramientas se cargan al conectar: tras regenerar el manifiesto, reconectar el servidor desde el cliente.
- Aprobar los permisos de antemano para que la demo no se corte.

## 5. Guion de la demo

1. Mostrar una web y decir que no tiene API.
2. Lanzar la exploración **en directo** sobre la web más fiable, con el panel en vivo: el navegador moviéndose, las peticiones capturadas y las herramientas apareciendo.
3. Validador: «N propuestas, M validadas».
4. Reconectar el cliente MCP y enseñar que las herramientas nuevas están ahí.
5. Pedir una tarea que cruce webs, por ejemplo: *«Busca libros de Asimov en Open Library, añade dos libros de ciencia ficción a un carrito en la tienda, haz el checkout y resérvame mesa para cuatro el viernes.»*
6. Cierre: diferencial (autónomo de extremo a extremo) y respuesta preparada sobre la parte legal.

**Plan B:** tener en caché una exploración buena de cada web y un vídeo grabado de la demo completa. Los bucles de agentes son impredecibles.

## 6. Reparto y calendario

| Persona | Responsabilidad |
|---|---|
| 1 | Explorador: Playwright, observación compacta, captura de red, atribución, centinelas |
| 2 | Sintetizador: prompts de traza a manifiesto, deduplicación, nombres y descripciones |
| 3 | Runtime MCP genérico y validador |
| 4 | Webs propias (con ayuda de IA, rápido), panel en vivo, integración con el cliente MCP y pitch |

| Tiempo | Qué |
|---|---|
| 0:00–0:30 | Todos: cerrar `manifest.json`, stack, webs objetivo y guion de la demo |
| 0:30–2:30 | Piezas en paralelo, cada una contra un manifiesto o traza de prueba escritos a mano |
| 2:30–3:30 | Integración de extremo a extremo con las webs propias |
| 3:30–4:15 | Web real (Open Library) y pulido del panel |
| 4:15–5:00 | Congelar, grabar el vídeo de respaldo y ensayar el pitch dos veces |

## 7. Reglas de recorte

- No prometer que funcione en cualquier web: solo en las tres elegidas.
- Nada de webs con login, pagos reales, captchas o anti-bots.
- Si algo se atasca más de 20 minutos, simplificar o escribir a mano esa parte del manifiesto y seguir.
- La autorreparación y `list_changed` son extras: solo si sobra tiempo.

## 8. Primeros pasos sugeridos

1. Crear la estructura del repo: `sites/shop`, `sites/restaurant`, `explorer/`, `synthesizer/`, `runtime/`, `validator/`, `ui/`.
2. Escribir `manifest.example.json` con 3 o 4 herramientas a mano (una `http` de Open Library, las del carrito y una `browser` del restaurante).
3. Implementar el runtime MCP genérico contra ese manifiesto y probarlo registrándolo en un cliente MCP.
4. Construir las dos webs propias.
5. Explorador: primero la observación compacta y la captura de red, después el bucle con el LLM, después la atribución y los centinelas.
6. Sintetizador y validador.
7. Panel en vivo.

---

# Anexo B: especificación original del portal (íntegra)

> Documento original. El «contexto.txt» que menciona es este mismo documento (secciones 1, 2 y 6 del cuerpo). La
> tecnología ya está decidida en el cuerpo: Next.js + React, desplegado en Vercel (sección 8).

Desarrolla MCPortal, la capa de aplicación de nuestro proyecto de creación y distribución de MCPs.

Antes de empezar, lee contexto.txt para comprender qué es nuestro software, cómo funciona y qué problema resuelve. Utiliza esa información para diseñar una interfaz coherente con el producto.

1. Contexto del proyecto

El proyecto consta de dos componentes diferenciados:

* Core del software: herramienta capaz de explorar una página web, comprender su estructura y generar automáticamente un MCP para interactuar con ella. Su funcionamiento se explica en contexto.txt.
* MCPortal: plataforma web que permite descubrir, descargar, crear y publicar MCPs generados por nuestro software.

Tu tarea consiste exclusivamente en desarrollar la interfaz de MCPortal. No implementes el funcionamiento interno del generador, las integraciones con MCP ni la lógica de publicación o descarga.

2. Objetivo del producto

MCPortal debe funcionar como un punto de encuentro entre quienes necesitan MCPs y quienes los crean.

Un usuario debe poder:

* Explorar un catálogo de MCPs publicados por la comunidad.
* Buscar MCPs por nombre, servicio, categoría o palabras clave.
* Consultar la información de cada MCP, incluyendo su descripción, la web para la que está diseñado y sus herramientas disponibles.
* Acceder a una interfaz para crear un MCP a partir de una página web.
* Revisar el MCP generado y acceder a las opciones de publicación.
* Gestionar visualmente sus MCPs creados, publicados o guardados como borradores.

Estas funcionalidades deben estar representadas mediante interfaces y datos de ejemplo. No es necesario que ejecuten operaciones reales.

3. Branding y dirección visual

El branding es una prioridad. No quiero una interfaz genérica de dashboard generada por IA, sino un producto con identidad visual propia, reconocible y cuidado hasta el último detalle.

Diseña MCPortal como una herramienta moderna para desarrolladores, con una estética profesional, tecnológica y minimalista.

Principios visuales:

* Jerarquía visual clara y excelente legibilidad.
* Tipografía cuidadosamente seleccionada.
* Paleta cromática coherente con la identidad del producto.
* Espaciado consistente, alineaciones precisas y composición equilibrada.
* Componentes visuales reutilizables y estados de interacción bien definidos.
* Iconografía consistente y funcional.
* Microinteracciones y transiciones sutiles cuando aporten valor.
* Diseño responsive para escritorio, tablet y móvil.

Evita los degradados decorativos gratuitos, las tarjetas innecesarias, los efectos de cristal, los elementos flotantes sin propósito y cualquier recurso visual que haga que el producto parezca una plantilla genérica de SaaS.

La interfaz debe transmitir que MCPortal es una herramienta real, útil y fiable para el ecosistema de desarrolladores.

Toma decisiones de diseño propias. No te limites a aplicar un tema predeterminado.

4. Pantallas principales

Desarrolla las siguientes vistas, manteniendo una identidad visual consistente en toda la aplicación.

A. Página principal y explorador

Será el núcleo de MCPortal.

Debe incluir:

* Navegación principal con el logotipo de MCPortal.
* Una propuesta de valor clara que explique el producto en pocos segundos.
* Un buscador destacado.
* Acceso directo a la creación de nuevos MCPs.
* Un catálogo visual de MCPs publicados.
* Filtros por categoría y otros criterios relevantes.
* Información resumida de cada MCP: nombre, servicio asociado, descripción, herramientas disponibles y autor.
* Indicadores visuales de popularidad, actividad o calidad cuando resulte apropiado.

El catálogo debe parecer real y estar poblado con datos de ejemplo variados y creíbles.

B. Detalle de un MCP

Diseña una vista dedicada a cada MCP que incluya:

* Nombre, descripción y servicio asociado.
* Información del autor.
* Herramientas o capacidades que ofrece.
* Información técnica relevante.
* Botones de descarga o instalación, representados visualmente.
* Elementos para explorar otros MCPs relacionados.

Prioriza la claridad de la información técnica sin renunciar a una buena presentación visual.

C. Crear un MCP

Diseña un flujo de creación sencillo e intuitivo.

Debe contemplar:

1. Introducir la URL de la página web que se quiere explorar.
2. Mostrar un estado visual de preparación o generación.
3. Presentar una vista previa del MCP generado.
4. Permitir revisar su nombre, descripción y herramientas.
5. Mostrar las opciones para publicarlo o guardarlo como borrador.

Todos los pasos deben ser navegables dentro de la interfaz, aunque la generación sea simulada.

D. Biblioteca personal

Diseña una sección donde el usuario pueda consultar sus propios MCPs.

Organiza visualmente los MCPs según su estado:

* Publicados.
* Borradores.
* En preparación, si resulta relevante para el flujo de diseño.

Incluye acciones visuales para abrir, editar o gestionar cada elemento.

E. Perfil y navegación

Incorpora las vistas y componentes adicionales necesarios para que la experiencia resulte completa, incluyendo el perfil del usuario y los estados vacíos pertinentes.

No añadas pantallas por añadir: cada vista debe responder a una necesidad concreta.

5. Alcance técnico

Implementa únicamente la capa de presentación.

Esto significa:

* No desarrolles el motor que explora páginas web.
* No implementes la generación real de MCPs.
* No conectes servicios externos ni APIs.
* No implementes una base de datos ni un sistema real de autenticación.
* No implementes descargas o publicaciones reales.
* No desarrolles lógica de negocio compleja.

Puedes utilizar datos mock y estado local para simular las interacciones necesarias.

Sin embargo, la interfaz no debe ser una colección de pantallas estáticas. Los botones, filtros, buscadores, menús, formularios y flujos principales deben responder de forma coherente cuando el usuario interactúe con ellos.

Si una operación no está implementada, simula su resultado de manera convincente.

Respeta la arquitectura y las tecnologías que ya existan en el proyecto. Antes de modificar archivos, inspecciona la estructura y reutiliza los componentes y dependencias disponibles siempre que tenga sentido.

6. Criterios de calidad

El resultado debe cumplir estas prioridades, por orden:

1. Identidad de marca: MCPortal debe tener una personalidad visual reconocible.
2. Calidad estética: el resultado debe parecer un producto terminado, no un prototipo improvisado.
3. Experiencia de usuario: navegar, descubrir y crear MCPs debe resultar intuitivo.
4. Coherencia: todas las pantallas deben compartir un mismo sistema de diseño.
5. Interactividad: los flujos principales deben funcionar mediante simulaciones locales.
6. Responsive: la aplicación debe adaptarse correctamente a diferentes tamaños de pantalla.
7. Calidad técnica: código organizado, componentes reutilizables y ausencia de errores evidentes.

7. Instrucciones de ejecución

1. Inspecciona el proyecto y lee contexto.txt.
2. Identifica las tecnologías, dependencias y convenciones existentes.
3. Define una dirección visual coherente para MCPortal.
4. Implementa las pantallas y los componentes necesarios.
5. Añade datos de ejemplo realistas y las interacciones locales.
6. Ejecuta la aplicación y comprueba visualmente las principales vistas.
7. Corrige los problemas de diseño, navegación, responsive y funcionamiento que detectes.

No te limites a describir lo que harías ni entregues un plan: implementa directamente la aplicación.

El objetivo final es conseguir una primera versión visualmente sólida y navegable de MCPortal, lista para conectar con el software real en una fase posterior.
