# MASTER PROMPT POR EQUIPO: MCPortal entre 4 personas

Este documento reparte el trabajo de `MASTER_PROMPT.md` entre cuatro personas. **No lo sustituye:** el master prompt
tiene la especificación completa (contratos, prompts, código de referencia, errores conocidos) y cada persona debe
leerlo entero antes de empezar. Aquí está quién hace qué, en qué orden, qué entrega a quién y cómo trabajar en
paralelo sin bloquearse.

Los dos archivos van en la raíz del repositorio nuevo.

---

## 1. Reparto

| Persona | Rol | Se centra en | Carpetas propias |
|---|---|---|---|
| **1** | Core: explorador | Agente que navega, observación, captura de red, atribución, análisis determinista, webs de demo | `sites/`, `core/mcportal_core/explorer/` |
| **2** | Core: síntesis y servicio | Sintetizador, validador, ejecutor, runtime MCP, pipeline, panel en vivo, integración con clientes MCP y, en la fase 3, el registro | `core/mcportal_core/{common,synthesizer,validator,runtime}/`, `core/mcportal_core/pipeline.py`, `core/panel/`, `core/tests/`, `registry/`, `manifest.example.json`, `fixtures/`, `start.sh` |
| **3** | Portal: marca y descubrimiento (Next.js + React) | Identidad visual, sistema de diseño, inicio y explorador, detalle de MCP, perfil, navegación, despliegue en Vercel | configuración de `portal/` (Next.js), `portal/src/{styles,components}/`, `portal/src/app/` (layout raíz, `page.tsx`, `mcp/`, `u/`, `styleguide/`, `not-found.tsx`) |
| **4** | Portal: flujos y datos (Next.js + React) | Tipos del contrato, capa de servicios (mock y después registro), datos de ejemplo, flujo «Crear», biblioteca, estado local | `portal/src/{types,services,data,state}/`, `portal/src/app/{crear,biblioteca}/` |

**Tecnología:** el portal es **Next.js + React con despliegue en Vercel**. El backend se queda tal cual, en Python
(core, panel, runtime y registro en FastAPI), y no va a Vercel.

Si el equipo prefiere otro equilibrio, lo más fácil de mover es el **panel en vivo** (de la persona 2 a la 1) y la
**página de perfil** (de la persona 3 a la 4).

---

## 2. Reglas de colaboración

- **Dueños por carpeta.** Cada persona solo modifica sus carpetas. Si necesitas un cambio en la de otro, pídeselo (o
  propón el cambio y que lo apruebe).
- **El contrato es sagrado.** La sección 6 del master prompt (manifiesto, traza, candidato, eventos) y
  `portal/src/types/contract.ts` solo cambian con el acuerdo de las personas afectadas: 1 y 2 para la traza; 2, 3 y
  4 para el manifiesto y los eventos. Cualquier cambio se anuncia al equipo.
- **Nadie espera a nadie.** Cada uno trabaja contra los datos de prueba de `fixtures/` y `portal/src/data/` desde el
  minuto 30. Cuando llega la pieza real, se sustituye el dato de prueba.
- **Git:** una rama por persona (`p1-explorer`, `p2-core`, `p3-portal-ui`, `p4-portal-flows`), commits pequeños y
  merge a `main` en cada hito. Antes de cada merge, las pruebas de tu parte deben pasar.
- **Definición de «hecho»:** el criterio de aceptación de la tarea se ha comprobado ejecutando algo (comando y
  resultado), no leyendo el código.
- **Avisos obligatorios al equipo:** cuando publicas algo que otro consume (interfaces, fixtures, componentes), cuando
  cambias un puerto o un nombre, y cuando algo te va a retrasar más de 20 minutos.
- **Webs reales y API del LLM:** las exploraciones contra webs de terceros las lanza solo la persona 1 (o quien se
  acuerde), pocas veces y en solo lectura; gastan crédito y pueden activar anti-bots.

---

## 3. Mapa de dependencias (quién entrega qué a quién)

```
Persona 1 ──sites/ (tienda :8001, restaurante :8002)────────────► todos (pruebas y demo)
Persona 1 ──runs/<sitio>/trace.json (contrato 6.2 / 6.3)────────► Persona 2 (sintetizador)
Persona 2 ──common/events.py + common/llm.py────────────────────► Persona 1 (los usa el explorador)
Persona 2 ──manifests/*.json (contrato 6.1)─────────────────────► runtime, cliente MCP y registro
Persona 2 ──registry/ API + SSE de eventos (fase 3)─────────────► Persona 4
Persona 4 ──types/contract.ts + services/ (interfaz y mock)─────► Persona 3 (sus páginas consumen datos)
Persona 3 ──sistema de diseño (tokens + componentes)────────────► Persona 4 (sus páginas lo usan)
```

---

## 4. Paso 0: todo el equipo junto (30 minutos)

Antes de separarse:

1. **Estructura del repo** (la de la sección 5 del master prompt), `.gitignore` y un README mínimo. Lo hace la
   persona 2 y lo sube a `main`.
2. **Acordar y apuntar en el README:** puertos (tienda 8001, restaurante 8002, panel 8000, registro 8010, portal
   5180), nombre del servidor MCP (`mcportal`), prefijo de variables (`MCPORTAL_*`), ramas.
3. **Datos de prueba compartidos** (persona 2, con revisión de la 1):
   - `manifest.example.json` según la sección 6.1.
   - `fixtures/trace.example.json`: una traza escrita a mano de la tienda con al menos estos candidatos: búsqueda
     (`q` como entrada), crear carrito, añadir artículo (`cart_id` depende de crear carrito y `product_id` de
     `results[0].id` de la búsqueda) y checkout (`cart_id` como dependencia, `name` y `email` como entradas); más la
     reserva del restaurante con `csrf_fields: ["csrf_token"]` y su receta de navegador.
   - `fixtures/events.example.jsonl`: una ejecución completa con todos los tipos de evento de la sección 6.4, en
     orden y con tiempos realistas.
4. **Esqueleto del portal** (persona 3):
   - Next.js (App Router) + React + TypeScript en `portal/` con la carpeta `src/`, CSS Modules, tokens vacíos,
     `next/font` y las rutas vacías de la sección 8 del master prompt.
   - Organizado según la sección 1 de este documento.
   - En local: `next dev -p 5180`.
5. **Tipos del contrato** (persona 4): `portal/src/types/contract.ts` traducido de la sección 6 del master prompt
   (manifiesto, herramienta, `impl` http y browser, eventos), más los tipos propios del portal (autor, estadísticas,
   estado borrador/publicado/en preparación).

---

## 5. Hitos

Tiempos orientativos para un hackathon de 5 horas. Fuera del hackathon, se mantiene el mismo orden.

| Hito | Persona 1 | Persona 2 | Persona 3 | Persona 4 |
|---|---|---|---|---|
| **H0** 0:00–0:30 | Paso 0 | Paso 0 | Paso 0 | Paso 0 |
| **H1** 0:30–1:30 | Webs de demo listas; sesión con captura y observación | `common/`; ejecutor y runtime funcionando en un cliente MCP con `manifest.example.json` | Tokens, tipografía, logo, componentes base; navegación | Servicios mock con la interfaz completa; datos de ejemplo; «Crear» pasos 1 y 2 |
| **H2** 1:30–2:45 | Heurística y análisis: trazas reales de la tienda y el restaurante | Sintetizador y validador; **primera ejecución de URL a herramientas en un cliente MCP** | Inicio y explorador completos; detalle | «Crear» pasos 3 y 4; biblioteca |
| **H3** 2:45–3:45 | Agente LLM con la API; solo lectura y regla de `goto`; una web real | Panel en vivo; pruebas; caché; (fase 3) registro mínimo | Perfil, 404, paleta de comandos, revisión de responsive; vista previa en Vercel | Persistencia, trabajo «en preparación», estados vacíos; (fase 3) servicio contra el registro |
| **H4** 3:45–4:30 | Integración y ensayo de la demo del core | Integración y ensayo de la demo del core | Pulido visual y ensayo del recorrido del portal | Pulido de flujos y ensayo del recorrido del portal |
| **H5** 4:30–5:00 | Congelar, vídeo de respaldo y pitch dos veces | Ídem | Ídem | Ídem |

**Puntos de integración obligatorios:**
- **Fin de H2:** la traza real de la persona 1 pasa por el sintetizador y el validador de la persona 2 y las
  herramientas se usan desde un cliente MCP. El portal tiene todas sus pantallas navegables con datos mock.
- **Fin de H3:** demo del core completa (panel + cliente MCP) y recorrido completo del portal sin errores.

**Reparto del pitch:** la persona 1 explica la exploración (panel), la 2 la validación y el uso desde un cliente MCP, la
3 presenta el portal y la 4 hace el cierre (valor, legal y hoja de ruta).

---

## 6. Persona 1: core, explorador y webs de demo

**Prompt para pegar en tu asistente de IA:**

```text
Soy la persona 1 del equipo de MCPortal (core: explorador y webs de demo). Lee MASTER_PROMPT.md completo y, en
MASTER_PROMPT_EQUIPO.md, las secciones 1 a 5 y la «Persona 1». Trabaja solo en mis carpetas (sites/ y
core/mcportal_core/explorer/), sigue mi orden de tareas y comprueba cada entregable con su criterio de aceptación
ejecutando algo. Avísame cuando haya algo que el equipo necesite (webs listas, trazas reales) y pregúntame antes de
cambiar el contrato, tocar carpetas de otros o lanzar exploraciones contra webs reales.
```

**Lee con atención** del master prompt: 6.2, 6.3, 6.4, 7.1, 7.4, 7.5, 7.10 (parámetros del agente) y 7.13.

**Tareas, en orden:**
1. **Webs de demo** (sección 7.1), primero la tienda y después el restaurante. Las necesita todo el equipo:
   anúncialas en cuanto respondan. Comprueba a mano los casos clave: el carrito encadenado, el 403 por CSRF, el
   409 sin mesa y que la consulta de una reserva inexistente devuelve 200.
2. **Sesión de navegador** (`browser.py`): captura en el contexto, espera de red propia (`wait_idle`), atribución de
   peticiones a cada acción, ventanas emergentes y diálogos, dominio base con subdominios.
3. **Observación** (`observe.js` tal cual el código de referencia, más `render_observation`). Prueba: en la tienda,
   «Añadir al carrito» aparece como `(×13 similares)` y el clic provoca `POST /api/cart` y
   `POST /api/cart/{id}/items`.
4. **Heurística** (sin LLM) y **CLI** `explore.py`. Hasta que la persona 2 publique `common/events.py`, usa un stub
   con la misma firma: `Events(run_dir).emit(type, **data)`.
5. **Análisis determinista** (`analyze.py`, sección 7.5). Es la parte más delicada: sigue el algoritmo punto por
   punto.
6. **Entrega a la persona 2** las trazas reales de la tienda y el restaurante (`runs/<sitio>/trace.json`); a partir
   de ahí sustituyen al fixture.
7. **Agente LLM** con `common/llm.py` de la persona 2, el prompt de sistema exacto, varias acciones por turno, las
   paradas y la vuelta a la heurística si falla la API.
8. **Seguridad:** modo solo lectura en la red y regla de `goto` (sección 7.4).
9. **Una web real** en solo lectura (crates.io recomendada, sección 7.13), con su traza guardada en `cache/`.

**Criterios de aceptación:**
- [ ] Heurística en la tienda: candidatos de categorías, búsqueda (`category` y `q`), ficha (`product_id` depende de
  la búsqueda), crear carrito, añadir (`cart_id` y `product_id` como dependencias), ver carrito y checkout (`cart_id`,
  `name`, `email`).
- [ ] Heurística en el restaurante: disponibilidad (`date` con formato date, `people` entero), reserva con
  `csrf_fields` y receta de navegador completa (con el `enum` de horas), y consulta por código.
- [ ] Con solo lectura forzado en la tienda, el `POST /api/cart` aparece como bloqueado y no se captura.
- [ ] El agente LLM explora la tienda y llega al checkout; un `goto` con query inventada se rechaza.
- [ ] Una web real produce al menos un candidato útil y queda en `cache/`.

**Errores que ya conocemos** (no los repitas): `networkidle` no espera a los fetch tras un clic; id de petición
duplicado si hay un `await` antes de guardarla; shadow DOM; límite de elementos que deja fuera el buscador;
`:has-text` en inputs; el agente inventando URLs; `category` dependiendo de la propia búsqueda; formularios JS sin
`action` confundidos entre sí.

---

## 7. Persona 2: core, síntesis, validación, runtime y servicio

**Prompt para pegar en tu asistente de IA:**

```text
Soy la persona 2 del equipo de MCPortal (core: sintetizador, validador, runtime MCP, pipeline, panel, integración con clientes MCP y,
en la fase 3, el registro). Lee MASTER_PROMPT.md completo y, en MASTER_PROMPT_EQUIPO.md, las secciones 1 a 5 y la
«Persona 2». Trabaja solo en mis carpetas, sigue mi orden de tareas y comprueba cada entregable con su criterio de
aceptación ejecutando algo. Avísame cuando haya algo que el equipo necesite (common/, manifiestos, API del registro)
y pregúntame antes de cambiar el contrato o tocar carpetas de otros.
```

**Lee con atención** del master prompt: 3, 6 (entero), 7.2, 7.3, 7.6 a 7.12 y 9.

**Tareas, en orden:**
1. **Paso 0:** estructura del repo, `manifest.example.json`, `fixtures/trace.example.json` y
   `fixtures/events.example.jsonl` (sección 4 de este documento).
2. **`common/`:** `events.py` (eventos JSONL, `slug_for`) y `llm.py` (sección 7.10). Publícalos pronto: la persona 1
   los necesita.
3. **Ejecutor y runtime MCP** (7.2, 7.3) contra `manifest.example.json`. Regístralo en un cliente MCP (7.12) y comprueba
   desde ahí que las herramientas aparecen y funcionan. Así se valida el contrato en la primera hora.
4. **Sintetizador** (7.6): primero el modo determinista con el fixture; después el LLM con salida estructurada y el
   prompt exacto.
5. **Validador** (7.7): orden por dependencias, juicio, cambio a navegador con la regla de «mismos parámetros».
6. **Pipeline** (7.8) con caché y repetición desde traza. **Primera ejecución completa con la traza real de la
   persona 1.**
7. **Pruebas** (7.11): `mcp_smoke.py`, `generated_smoke.py` y `fake_llm.py`.
8. **Panel en vivo** (7.9) y `start.sh`.
9. **Fase 3, si da tiempo o después del hackathon:** `registry/` (sección 9) con `GET /mcps`, `GET /mcps/{slug}`,
   `GET /mcps/{slug}/manifest`, `POST /generate`, `GET /jobs/{id}/events` (SSE) y `POST /mcps`. Acuerda con la
   persona 4 el formato exacto de cada respuesta antes de implementarlo. Activa CORS para el dominio de Vercel del
   portal y para `localhost:5180`. El registro no se despliega en Vercel.

**Criterios de aceptación:**
- [ ] Desde un cliente MCP, con `manifest.example.json`: carrito encadenado y reserva por navegador funcionando.
- [ ] Tienda y restaurante en modo determinista: 7/7 y 3/3 validadas; la reserva pasa de http (403) a navegador.
- [ ] El sintetizador LLM renombra parámetros, convierte literales útiles en parámetros, describe las dependencias y
  descarta lo que no aporta (con motivo).
- [ ] Las tres pruebas pasan.
- [ ] El panel muestra una ejecución en vivo y otra desde caché.
- [ ] (Fase 3) El registro sirve el catálogo y emite por SSE los eventos de una generación real.

**Errores que ya conocemos:** API de `mcp` 2.x sin decoradores; algunos modelos rechazan que se
fuerce una herramienta concreta; la salida estructurada estricta no admite un JSON Schema libre (por eso los parámetros van como lista);
`enum` que llegan como texto en parámetros enteros; literales del body que pierden su tipo; respuestas JSON que se
cortan antes de la paginación (recorta textos largos); menús que llenan las respuestas HTML; falso positivo de una
receta de navegador que ignora parámetros.

---

## 8. Persona 3: portal, marca y descubrimiento

**Prompt para pegar en tu asistente de IA:**

```text
Soy la persona 3 del equipo de MCPortal (portal en Next.js + React: identidad visual, sistema de diseño, inicio y
explorador, detalle de MCP, perfil, navegación y despliegue en Vercel). Lee MASTER_PROMPT.md completo (sobre todo
las secciones 1, 3, 6.1, 8 y el anexo B) y, en
MASTER_PROMPT_EQUIPO.md, las secciones 1 a 5 y la «Persona 3». Trabaja solo en mis carpetas de portal/, consume los
datos a través de src/services/ (de la persona 4) y comprueba cada vista con capturas a 1440, 834 y 390 px. Avísame
cuando el sistema de diseño esté listo para que la persona 4 lo use, y pregúntame antes de cambiar tipos del
contrato o carpetas de otros.
```

**Lee con atención:** sección 8 y anexo B del master prompt (el branding es la prioridad número uno), 6.1 y 6.4.

**Tareas, en orden:**
1. **Paso 0:** esqueleto de `portal/` (Next.js con App Router, React, TypeScript, carpeta `src/`, CSS Modules,
   fuentes con `next/font`, iconos de un solo set). Comprueba la versión mayor de Next.js antes de usar su API.
2. **Identidad:** dirección visual (sección 8 del master prompt), tokens (color, tipografía, espaciado, radios,
   sombras mínimas, movimiento) y logotipo. Decide y deja escrita la dirección en `portal/DESIGN.md` en 10 líneas,
   para que la persona 4 la siga.
3. **Sistema de diseño** reutilizable, con todos sus estados (reposo, hover, foco visible, activo, deshabilitado,
   cargando): botón, campo, select, textarea, checkbox e interruptor, insignias de estado, pestañas, menú
   desplegable, diálogo, aviso (toast), monograma del servicio, avatar, firma de herramienta, bloque terminal con
   copiar, sparkline, estado vacío y paginación. Una ruta `/styleguide` que los muestre todos, solo en desarrollo
   (en Next.js las carpetas que empiezan por `_` no generan ruta). **Avisa a la persona 4 cuando esté.**
   - Marca como componente de cliente (`"use client"`) solo lo que tenga interacción o estado. El resto, de
     servidor.
4. **Estructura:** layout raíz con fuentes y tokens, navegación con logo (y versión móvil), pie, `not-found.tsx` con
   identidad.
5. **A. Inicio y explorador** (renderizado en servidor, con buscador y filtros como componentes de cliente) con los
   datos de `services/`: propuesta de valor con un ejemplo vivo «URL →
   herramientas», buscador destacado (`/` lo enfoca), acceso a «Crear», catálogo como índice con líneas, filtros
   (categoría, implementación, modo, verificados), orden y estado vacío de búsqueda.
6. **B. Detalle** (`mcp/[slug]`): renderizado en servidor con `generateMetadata` (título y descripción de cada MCP).
   Si el slug no existe en servidor, se resuelve en cliente para los MCPs creados por el usuario (coordina con la
   persona 4). Contenido: instalación con pestañas y copiar, pestañas Herramientas, Manifiesto, Validación y
   Versiones, ficha técnica, autor y relacionados.
7. **E. Perfil** (`u/[handle]`) propio y de otros autores, edición de perfil y menú de usuario; **paleta de
   comandos** con ⌘K.
8. **Revisión de responsive** de todas las vistas (incluidas las de la persona 4, en coordinación con ella).
9. **Despliegue en Vercel:** conecta el repo (pregunta antes al equipo), configura la raíz del proyecto en
   `portal/` y las variables `NEXT_PUBLIC_*`, y comprueba que cada rama genera su vista previa.

**Criterios de aceptación:**
- [ ] Una persona ajena al proyecto reconoce la marca sin ver el logo (paleta, tipografía y composición propias). Sin
  degradados decorativos, cristal ni rejillas de tarjetas genéricas.
- [ ] Buscar, filtrar y ordenar cambian los resultados; el estado vacío aparece; copiar el comando de instalación
  avisa.
- [ ] Inicio, detalle, perfil y 404 sin errores de consola ni de hidratación, con capturas correctas a 1440, 834 y
  390 px.
- [ ] `next build` sin errores de tipos.
- [ ] La vista previa de Vercel funciona (si el equipo ha conectado el proyecto) y el detalle de un MCP muestra su
  título y descripción al compartir el enlace.

---

## 9. Persona 4: portal, flujos y datos

**Prompt para pegar en tu asistente de IA:**

```text
Soy la persona 4 del equipo de MCPortal (portal en Next.js + React: tipos del contrato, capa de servicios mock y
después registro, datos de ejemplo, flujo «Crear», biblioteca y estado local). Lee MASTER_PROMPT.md completo (sobre
todo las secciones 1, 6,
8, 9 y el anexo B) y, en MASTER_PROMPT_EQUIPO.md, las secciones 1 a 5 y la «Persona 4». Trabaja solo en mis carpetas
de portal/, usa el sistema de diseño de la persona 3 (no crees componentes visuales paralelos: pídeselos) y comprueba
cada flujo recorriéndolo de principio a fin. Avísame cuando la interfaz de servicios esté lista para la persona 3, y
pregúntame antes de cambiar tipos del contrato o carpetas de otros.
```

**Lee con atención:** secciones 6 (los tipos del portal deben coincidir con el contrato), 8, 9 y anexo B.

**Tareas, en orden:**
1. **Paso 0:** `src/types/contract.ts` (sección 4 de este documento).
2. **Interfaz de servicios** (`src/services/index.ts`) e **implementación mock** (`src/services/mock.ts`).
   - Elige la implementación con `NEXT_PUBLIC_DATA_SOURCE=mock|registry`, para cambiarla en la fase 3 sin tocar
     pantallas.
   - El mock de lectura no puede usar `window` ni `localStorage`, porque las páginas de servidor de la persona 3
     también lo llaman.
   - Lo que crea o guarda el usuario va en el estado local de cliente (`src/state/`), sobre `localStorage`; los
     servicios combinan ambos en cliente.

   Métodos mínimos:
   - `listMcps(filtros, orden, página)` y `getMcp(slug)`, `getManifest(slug)`, `getRelated(slug)`
   - `getUser(handle)` y `getCurrentUser()`, `updateProfile(datos)`
   - `listMyMcps(estado)`, `saveDraft(mcp)`, `publish(slug, opciones)`, `unpublish(slug)`, `duplicate(slug)`,
     `remove(slug)`, `toggleStar(slug)`
   - `startGeneration(url, opciones)`, que devuelve un trabajo al que suscribirse (eventos de la sección 6.4) y que
     se puede cancelar

   Publícala pronto con datos falsos mínimos: **la persona 3 la necesita para sus páginas.**
3. **Datos de ejemplo** (`src/data/`): al menos 24 MCPs creíbles y variados (sección 8 del master prompt), con
   manifiestos completos según el contrato, autores, estadísticas, historial de versiones e informes de validación.
4. **Simulación de generación:** emite los eventos de la sección 6.4 con tiempos realistas (como
   `fixtures/events.example.jsonl`); escenarios por dominio (tienda, restaurante, Toolshop, crates.io) y un
   generador genérico para cualquier otra URL.
5. **C. Crear** (cuatro pasos navegables, sección 8 del master prompt): URL con validación, pista y modo (lectura y
   escritura exige confirmar el permiso); generación en vivo con cancelar; revisión editable con vista previa del
   manifiesto; publicación con visibilidad, categoría, etiquetas, licencia y confirmación de permiso obligatoria;
   éxito con el comando de instalación; guardar borrador.
6. **D. Biblioteca:** Publicados, Borradores, En preparación (un trabajo simulado que avanza y acaba en borrador con
   aviso) y Guardados, con abrir, editar (vuelve a la revisión), duplicar, publicar o despublicar y eliminar con
   confirmación; estados vacíos.
7. **Estado local y persistencia** en `localStorage` (lo creado, publicado, guardado y el perfil editado). «Crear» y
   «Biblioteca» son componentes de cliente. Lee `localStorage` solo después de montar, para evitar errores de
   hidratación. Expón a la persona 3 cómo resolver en cliente el detalle de un MCP creado por el usuario.
8. **Fase 3:** `src/services/registry.ts` contra la API de la persona 2 (acordad antes el formato), con la
   generación real por SSE en el paso 2 de «Crear». Usa `NEXT_PUBLIC_REGISTRY_URL`; el registro debe tener CORS para
   el dominio de Vercel.

**Criterios de aceptación:**
- [ ] Crear un MCP de principio a fin, publicarlo y verlo en el catálogo, en la biblioteca y en su página de detalle;
  recargar la página y que siga ahí.
- [ ] Guardar borrador, editarlo, duplicarlo, publicarlo, despublicarlo y eliminarlo funcionan con avisos coherentes.
- [ ] La generación simulada emite exactamente los tipos de evento del contrato y se puede cancelar.
- [ ] «Crear» y «Biblioteca» sin errores de consola ni de hidratación (también al recargar en cada paso), con
  capturas correctas a 1440, 834 y 390 px.
- [ ] (Fase 3) Con `NEXT_PUBLIC_DATA_SOURCE=registry`, el portal muestra el catálogo real y una generación real en
  vivo.

---

## 10. Integración final y demo

1. **Core** (personas 1 y 2): ejecución en vivo desde el panel sobre la tienda, validación, uso desde un cliente MCP con
   la tarea cruzada de la sección 11 del master prompt, y una consulta a una web real en solo lectura. Plan B: las
   trazas de `cache/` y el vídeo.
2. **Portal** (personas 3 y 4), en su URL de Vercel si ya está desplegado: recorrido buscar → detalle → copiar
   instalación → crear un MCP de la tienda → publicarlo → verlo en la biblioteca. Si la fase 3 está lista, la
   generación del portal es la real del core (con el registro accesible desde el portal y CORS configurado).
3. **Ensayo:** dos pasadas completas con cronómetro (5 minutos) y reparto del pitch de la sección 5.
4. **Congelación:** a partir de H5 solo se corrigen errores que rompan la demo.
