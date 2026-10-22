/**
 * Generación simulada del portal.
 *
 * Emite exactamente los eventos de §6.4 (en orden y con tiempos crecientes) y,
 * al final, un borrador con manifiesto §6.1. Cuando el registro de la fase 3
 * esté listo, este módulo se sustituye por la generación real por SSE sin tocar
 * las pantallas: mismo `GeneratedRun`.
 */
import type { PipelineEvent, PipelineEventType } from '../types/contract';
import type { CategoryId, GeneratedRun, GenerationOptions, McpMode, Mcp, SceneFrame } from '../types/portal';
import type { ToolSpec } from '../data/build';
import { defineMcp, faviconFor } from '../data/build';
import { CURRENT_USER_HANDLE } from '../data/people';
import { slugify } from '../lib/format';

/** Ritmo con el que la UI reproduce los eventos. */
export const EVENT_DELAY: Record<PipelineEventType, number> = {
  run_started: 280,
  explore_started: 240,
  mode: 260,
  warning: 520,
  thought: 620,
  step: 700,
  request: 340,
  blocked: 520,
  finish: 380,
  candidate: 240,
  explore_done: 360,
  tool_proposed: 260,
  candidate_discarded: 420,
  synth_done: 420,
  validate_retry: 620,
  validated: 320,
  validate_done: 340,
  done: 420,
};

interface ScenarioRequest {
  method: string;
  path: string;
  status: number;
  kind?: string;
}

interface ScenarioStep {
  action: string;
  path: string;
  observation: string[];
  requests: ScenarioRequest[];
  thought?: string;
}

interface ScenarioCandidate {
  id: string;
  method: string;
  url: string;
  params: string[];
  csrf: string[];
  browser: boolean;
}

interface Scenario {
  key: string;
  name: string;
  description: string;
  category: CategoryId;
  tags: string[];
  mode: McpMode;
  tools: ToolSpec[];
  steps: ScenarioStep[];
  candidates: ScenarioCandidate[];
  discarded: { candidate_id: string; reason: string }[];
  retry?: { name: string; reason: string };
  finish: string;
}

const t = (text: string) => text;

/* ------------------------------------------------------------ escenarios */

const storeScenario: Scenario = {
  key: 'store',
  name: 'Tienda online',
  description: 'Búsqueda de productos, carrito encadenado y checkout simulado.',
  category: 'comercio',
  tags: ['tienda', 'carrito', 'checkout'],
  mode: 'read_write',
  tools: [
    {
      name: 'search_products',
      method: 'GET',
      path: '/api/search?q={query}',
      description: 'Busca productos por texto. Devuelve id, nombre, precio y stock.',
      params: { query: { type: 'string', description: 'Texto libre de búsqueda.', example: 'lampara' } },
    },
    {
      name: 'list_categories',
      method: 'GET',
      path: '/api/categories',
      description: 'Categorías disponibles con su id y nombre.',
      params: {},
    },
    {
      name: 'create_cart',
      method: 'POST',
      path: '/api/cart',
      description: 'Crea un carrito vacío y devuelve cart_id. Llámala antes de añadir artículos.',
      params: {},
    },
    {
      name: 'add_to_cart',
      method: 'POST',
      path: '/api/cart/{cart_id}/items',
      description: 'Añade un producto al carrito. Requiere cart_id de create_cart y product_id de search_products.',
      params: {
        cart_id: { type: 'string', description: 'Carrito.', dependsOn: { tool: 'create_cart', path: 'cart_id' } },
        product_id: { type: 'string', description: 'Producto.', dependsOn: { tool: 'search_products', path: 'results[0].id' } },
        qty: { type: 'integer', description: 'Unidades.', required: false, default: 1, example: 1 },
      },
      body: { product_id: '{product_id}', qty: '{qty}' },
      bodyType: 'json',
    },
    {
      name: 'checkout',
      method: 'POST',
      path: '/api/cart/{cart_id}/checkout',
      description: 'Cierra el pedido y devuelve order_id. Requiere cart_id con artículos.',
      params: {
        cart_id: { type: 'string', description: 'Carrito.', dependsOn: { tool: 'create_cart', path: 'cart_id' } },
        name: { type: 'string', description: 'Nombre del cliente.', example: 'Ada Lovelace' },
        email: { type: 'string', description: 'Correo de contacto.', example: 'ada@example.com' },
      },
      body: { name: '{name}', email: '{email}' },
      bodyType: 'json',
    },
    {
      name: 'list_new_arrivals',
      startPath: '/novedades',
      steps: [{ action: 'click', selector: 'a[href="/novedades"]' }, { action: 'wait', value: '400' }],
      description: 'Novedades de la semana.',
      params: {},
      failure: 'La página devolvió 0 elementos',
    },
  ],
  steps: [
    {
      action: 'Cargar la portada',
      path: '/',
      observation: ['[2] input "Buscar productos" name=q', '[3] button "Buscar"', '[8] link "Ciencia ficción"', '[14] button "Añadir al carrito" (×13 similares)'],
      requests: [
        { method: 'GET', path: '/', status: 200, kind: 'document' },
        { method: 'GET', path: '/api/categories', status: 200 },
        { method: 'GET', path: '/api/search?q=', status: 200 },
      ],
      thought: 'La portada ya carga categorías y un listado. Voy a probar el buscador con un valor centinela.',
    },
    {
      action: 'fill [2] ← zxq_lampara + click [3]',
      path: '/?q=zxq_lampara',
      observation: ['[2] input "Buscar productos" valor="zxq_lampara"', '[3] button "Buscar"', 'Texto: 0 resultados para zxq_lampara'],
      requests: [{ method: 'GET', path: '/api/search?q=zxq_lampara', status: 200 }],
    },
    {
      action: 'click [8] "Ciencia ficción"',
      path: '/?category=scifi',
      observation: ['[8] link "Ciencia ficción"', '[14] button "Añadir al carrito" (×6 similares)'],
      requests: [{ method: 'GET', path: '/api/search?category=scifi', status: 200 }],
      thought: 'El filtro de categoría usa el mismo endpoint con el parámetro category. Y el listado trae ids de producto.',
    },
    {
      action: 'click [14] "Añadir al carrito"',
      path: '/?category=scifi',
      observation: ['[1] button "Ver carrito (1)"', 'Texto: Yo, robot añadido al carrito'],
      requests: [
        { method: 'POST', path: '/api/cart', status: 201 },
        { method: 'POST', path: '/api/cart/cart_8f2c1a/items', status: 200 },
      ],
      thought: 'El primer añadido crea el carrito y después añade el artículo: hay una dependencia entre las dos respuestas.',
    },
    {
      action: 'click [1] "Ver carrito (1)"',
      path: '/carrito',
      observation: ['[4] input "Cantidad" valor="1"', '[7] button "Finalizar compra"', 'Texto: Yo, robot · 12,50 € · Total 12,50 €'],
      requests: [{ method: 'GET', path: '/api/cart/cart_8f2c1a', status: 200 }],
    },
    {
      action: 'fill [5] ← zxq_ada · fill [6] ← zxq@example.com + click [7]',
      path: '/carrito',
      observation: ['[5] input "Nombre" valor="zxq_ada"', '[6] input "Correo" valor="zxq@example.com"', 'Texto: Pedido confirmado'],
      requests: [{ method: 'POST', path: '/api/cart/cart_8f2c1a/checkout', status: 200 }],
      thought: 'He completado el flujo entero: búsqueda, filtro, carrito y pago simulado. Con esto hay material para cinco herramientas.',
    },
  ],
  candidates: [
    { id: 'c1', method: 'GET', url: '/api/search?q={query}', params: ['query'], csrf: [], browser: false },
    { id: 'c2', method: 'GET', url: '/api/categories', params: [], csrf: [], browser: false },
    { id: 'c3', method: 'POST', url: '/api/cart', params: [], csrf: [], browser: false },
    { id: 'c4', method: 'POST', url: '/api/cart/{cart_id}/items', params: ['cart_id', 'product_id', 'qty'], csrf: [], browser: false },
    { id: 'c5', method: 'GET', url: '/api/cart/{cart_id}', params: ['cart_id'], csrf: [], browser: false },
    { id: 'c6', method: 'POST', url: '/api/cart/{cart_id}/checkout', params: ['cart_id', 'name', 'email'], csrf: [], browser: false },
    { id: 'c7', method: 'GET', url: '/api/search?category={category}', params: ['category'], csrf: [], browser: false },
  ],
  discarded: [{ candidate_id: 'c7', reason: 'Duplicado de la búsqueda: el mismo endpoint con category ya está cubierto.' }],
  finish: 'Seis flujos distintos probados; no aparecen endpoints nuevos.',
};

const restaurantScenario: Scenario = {
  key: 'restaurant',
  name: 'Reservas de restaurante',
  description: 'Disponibilidad y reservas con formularios HTML y token CSRF.',
  category: 'reservas',
  tags: ['reservas', 'mesas', 'csrf'],
  mode: 'read_write',
  tools: [
    {
      name: 'check_availability',
      startPath: '/disponibilidad',
      steps: [
        { action: 'fill', selector: 'input[name=date]', value: '{date}' },
        { action: 'fill', selector: 'input[name=people]', value: '{people}' },
        { action: 'click', selector: 'button[type=submit]' },
      ],
      description: 'Horas con mesa libre para una fecha y número de comensales.',
      params: {
        date: { type: 'date', description: 'Día de la reserva (YYYY-MM-DD).' },
        people: { type: 'integer', description: 'Comensales.', example: 4 },
      },
      extract: 'main',
    },
    {
      name: 'book_table',
      startPath: '/reservar',
      steps: [
        { action: 'fill', selector: 'input[name=name]', value: '{name}' },
        { action: 'fill', selector: 'input[name=phone]', value: '{phone}' },
        { action: 'fill', selector: 'input[name=date]', value: '{date}' },
        { action: 'select', selector: 'select[name=time]', value: '{time}' },
        { action: 'fill', selector: 'input[name=people]', value: '{people}' },
        { action: 'click', selector: 'button[type=submit]' },
      ],
      description: 'Reserva una mesa y devuelve el código de reserva.',
      params: {
        date: { type: 'date', description: 'Día de la reserva (YYYY-MM-DD).' },
        time: { type: 'string', description: 'Hora.', example: '21:00', enum: ['13:00', '13:30', '14:00', '20:00', '20:30', '21:00', '21:30', '22:00'] },
        people: { type: 'integer', description: 'Comensales.', example: 4 },
        name: { type: 'string', description: 'Nombre de la reserva.', example: 'Ada Lovelace' },
        phone: { type: 'string', description: 'Teléfono de contacto.', example: '600123456' },
      },
      extract: 'main',
    },
    {
      name: 'get_booking',
      method: 'GET',
      path: '/reserva?code={code}',
      description: 'Consulta una reserva por su código.',
      params: { code: { type: 'string', description: 'Código R-XXXXXX.', dependsOn: { tool: 'book_table', path: 'code' } } },
    },
    {
      name: 'get_menu',
      startPath: '/menu',
      steps: [{ action: 'wait', value: '300' }],
      description: 'Carta del día con precios y alérgenos.',
      params: {},
      extract: 'main',
    },
  ],
  steps: [
    {
      action: 'Cargar la portada',
      path: '/',
      observation: ['[2] link "Disponibilidad"', '[4] link "Reservar"', '[6] link "Carta"'],
      requests: [{ method: 'GET', path: '/', status: 200, kind: 'document' }],
      thought: 'Web renderizada en servidor, sin JSON. Voy a probar el formulario de disponibilidad.',
    },
    {
      action: 'fill [2] ← 2026-10-30 · fill [3] ← 4 + click [5] "Ver horarios"',
      path: '/disponibilidad?date=2026-10-30&people=4',
      observation: ['[7] link "21:00"', '[8] link "21:30"', '[9] link "22:00"', 'Texto: Mesas libres para 4 comensales'],
      requests: [{ method: 'GET', path: '/disponibilidad?date=2026-10-30&people=4', status: 200, kind: 'document' }],
    },
    {
      action: 'click [7] "21:00"',
      path: '/reservar?date=2026-10-30&time=21%3A00&people=4',
      observation: ['[2] input "Nombre"', '[3] input "Teléfono"', '[6] select "Hora" opciones: 13:00, 20:00, 21:00…', 'input[hidden] csrf_token'],
      requests: [{ method: 'GET', path: '/reservar?date=2026-10-30&time=21%3A00&people=4', status: 200, kind: 'document' }],
      thought: 'El formulario lleva un token CSRF oculto y una cookie de sesión. Un POST directo dará 403; habrá que usar navegador.',
    },
    {
      action: 'fill [2] ← zxq_ada · fill [3] ← 600123456 · select [6] ← 21:00 + click [7]',
      path: '/reservar',
      observation: ['Texto: Reserva confirmada · código R-7F3K2A'],
      requests: [{ method: 'POST', path: '/reservar', status: 403, kind: 'document' }],
      thought: 'Confirmado: el envío directo sin el token de la sesión devuelve 403. La herramienta tiene que ser de navegador.',
    },
  ],
  candidates: [
    { id: 'c1', method: 'GET', url: '/disponibilidad?date={date}&people={people}', params: ['date', 'people'], csrf: [], browser: true },
    { id: 'c2', method: 'POST', url: '/reservar', params: ['name', 'phone', 'date', 'time', 'people'], csrf: ['csrf_token'], browser: true },
    { id: 'c3', method: 'GET', url: '/reserva?code={code}', params: ['code'], csrf: [], browser: false },
    { id: 'c4', method: 'GET', url: '/menu', params: [], csrf: [], browser: false },
  ],
  discarded: [],
  retry: { name: 'book_table', reason: 'http falló (estado 403); funciona con navegador' },
  finish: 'Disponibilidad, reserva y consulta probadas. La reserva exige navegador por el CSRF.',
};

const toolshopScenario: Scenario = {
  key: 'toolshop',
  name: 'Toolshop',
  description: 'Catálogo de herramientas con filtros por categoría y marca. La API usa el método QUERY.',
  category: 'comercio',
  tags: ['herramientas', 'filtros', 'cloudflare'],
  mode: 'read_only',
  tools: [
    {
      name: 'search_products',
      method: 'QUERY',
      path: '/products/search?q={query}',
      description: 'Busca productos por texto.',
      params: { query: { type: 'string', description: 'Texto libre.', example: 'hammer' } },
    },
    {
      name: 'list_products',
      method: 'GET',
      path: '/products?page={page}&between=price,{min_price},{max_price}',
      description: 'Lista paginada con filtro de precio.',
      params: {
        page: { type: 'integer', description: 'Página.', required: false, default: 1 },
        min_price: { type: 'number', description: 'Precio mínimo.', required: false },
        max_price: { type: 'number', description: 'Precio máximo.', required: false },
      },
    },
    {
      name: 'list_categories',
      method: 'GET',
      path: '/categories',
      description: 'Categorías disponibles.',
      params: {},
    },
    {
      name: 'list_brands',
      method: 'GET',
      path: '/brands',
      description: 'Marcas disponibles.',
      params: {},
    },
    {
      name: 'get_product',
      method: 'GET',
      path: '/products/{product_id}',
      description: 'Ficha de un producto.',
      params: { product_id: { type: 'string', description: 'Producto.', dependsOn: { tool: 'search_products', path: 'data[0].id' } } },
    },
  ],
  steps: [
    {
      action: 'Cargar la portada',
      path: '/',
      observation: ['[3] input "Search" name=search', '[4] button "Search"', '[7] select "Category"', '[9] select "Brand"', '[12] link (×9 similares)'],
      requests: [{ method: 'GET', path: '/', status: 200, kind: 'document' }],
      thought: 'El listado llega por API. Voy a escribir en el buscador y después probar los filtros.',
    },
    {
      action: 'fill [3] ← zxq_hammer + click [4]',
      path: '/search?q=zxq_hammer',
      observation: ['[12] link "Claw Hammer"', 'Texto: 1 producto'],
      requests: [{ method: 'QUERY', path: '/products/search?q=zxq_hammer', status: 200 }],
    },
    {
      action: 'select [7] ← "Hand Tools"',
      path: '/category/hand-tools',
      observation: ['[7] select "Category" valor="Hand Tools"', '[9] select "Brand"', '[12] link (×6 similares)'],
      requests: [{ method: 'GET', path: '/products?category=hand-tools', status: 200 }],
      thought: 'La categoría va por query y devuelve categorías y marcas en la misma carga. El método QUERY es nuevo: hay que conservarlo.',
    },
    {
      action: 'click [12] "Claw Hammer"',
      path: '/product/claw-hammer',
      observation: ['[5] button "Add to cart"', 'Texto: Claw Hammer · 12,99 € · 8 en stock'],
      requests: [{ method: 'GET', path: '/products/01H8X', status: 200 }],
    },
  ],
  candidates: [
    { id: 'c1', method: 'QUERY', url: '/products/search?q={query}', params: ['query'], csrf: [], browser: false },
    { id: 'c2', method: 'GET', url: '/products?page={page}', params: ['page'], csrf: [], browser: false },
    { id: 'c3', method: 'GET', url: '/categories', params: [], csrf: [], browser: false },
    { id: 'c4', method: 'GET', url: '/brands', params: [], csrf: [], browser: false },
    { id: 'c5', method: 'GET', url: '/products/{product_id}', params: ['product_id'], csrf: [], browser: false },
  ],
  discarded: [],
  finish: 'Cinco endpoints validados. Cloudflare responde lento pero no bloquea.',
};

const cratesScenario: Scenario = {
  key: 'crates',
  name: 'crates.io',
  description: 'Búsqueda de crates de Rust con la API interna de la web.',
  category: 'desarrollo',
  tags: ['rust', 'crates', 'paquetes'],
  mode: 'read_only',
  tools: [
    {
      name: 'search_crates',
      method: 'GET',
      path: 'https://crates.io/api/v1/crates?q={query}&per_page={per_page}',
      description: 'Busca crates por texto. Devuelve nombre, descripción y descargas.',
      params: {
        query: { type: 'string', description: 'Qué buscar.', example: 'serde' },
        per_page: { type: 'integer', description: 'Resultados por página.', required: false, default: 10 },
      },
      headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
    },
    {
      name: 'get_crate',
      method: 'GET',
      path: 'https://crates.io/api/v1/crates/{crate_name}',
      description: 'Ficha de un crate: última versión, licencia y repositorio.',
      params: { crate_name: { type: 'string', description: 'Crate.', dependsOn: { tool: 'search_crates', path: 'crates[0].name' } } },
      headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
    },
    {
      name: 'list_versions',
      method: 'GET',
      path: 'https://crates.io/api/v1/crates/{crate_name}/versions',
      description: 'Versiones publicadas de un crate.',
      params: { crate_name: { type: 'string', description: 'Crate.', dependsOn: { tool: 'search_crates', path: 'crates[0].name' } } },
      headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
    },
  ],
  steps: [
    {
      action: 'Cargar la portada',
      path: '/',
      observation: ['[3] input "Search crates"', '[4] button "Search"'],
      requests: [{ method: 'GET', path: '/', status: 200, kind: 'document' }],
      thought: 'Web real en solo lectura. Escribo un término con resultados probables, no un centinela.',
    },
    {
      action: 'fill [3] ← serde + click [4]',
      path: '/search?q=serde',
      observation: ['[9] link "serde"', '[10] link "serde_json"', 'Texto: 1.284 crates'],
      requests: [{ method: 'GET', path: '/api/v1/crates?q=serde&per_page=10', status: 200 }],
    },
    {
      action: 'click [9] "serde"',
      path: '/crates/serde',
      observation: ['Texto: serde · 1.0.210 · 412 M descargas', '[6] link "Repository"'],
      requests: [
        { method: 'GET', path: '/api/v1/crates/serde', status: 200 },
        { method: 'GET', path: '/api/v1/crates/serde/versions', status: 200 },
      ],
    },
  ],
  candidates: [
    { id: 'c1', method: 'GET', url: '/api/v1/crates?q={query}', params: ['query', 'per_page'], csrf: [], browser: false },
    { id: 'c2', method: 'GET', url: '/api/v1/crates/{crate_name}', params: ['crate_name'], csrf: [], browser: false },
    { id: 'c3', method: 'GET', url: '/api/v1/crates/{crate_name}/versions', params: ['crate_name'], csrf: [], browser: false },
  ],
  discarded: [],
  finish: 'Web real: tres herramientas y ninguna escritura, como exige el modo solo lectura.',
};

const internalScenario: Scenario = {
  key: 'internal',
  name: 'Panel interno',
  description: 'Panel de gestión sin API: formularios clásicos con sesión y token CSRF.',
  category: 'internas',
  tags: ['panel', 'formularios', 'csrf'],
  mode: 'read_write',
  tools: [
    {
      name: 'search_records',
      startPath: '/listado',
      steps: [
        { action: 'fill', selector: 'input[name=q]', value: '{query}' },
        { action: 'click', selector: 'button[type=submit]' },
      ],
      description: 'Busca registros por texto.',
      params: { query: { type: 'string', description: 'Texto libre.', example: 'acme' } },
      extract: 'table',
    },
    {
      name: 'get_record',
      method: 'GET',
      path: '/registro/{record_id}',
      description: 'Ficha completa de un registro.',
      params: { record_id: { type: 'string', description: 'Registro.', dependsOn: { tool: 'search_records', path: 'results[0].id' } } },
    },
    {
      name: 'add_note',
      startPath: '/registro/nota',
      steps: [
        { action: 'fill', selector: 'textarea[name=nota]', value: '{note}' },
        { action: 'click', selector: 'button[type=submit]' },
      ],
      description: 'Añade una nota a un registro.',
      params: { note: { type: 'string', description: 'Texto de la nota.', example: 'Llamada el 21/10.' } },
      extract: 'main',
    },
    {
      name: 'export_csv',
      startPath: '/exportar',
      steps: [{ action: 'click', selector: 'button[data-accion="csv"]' }],
      description: 'Exporta el listado a CSV.',
      params: {},
      failure: '403: requiere rol de administrador',
    },
  ],
  steps: [
    {
      action: 'Cargar el panel',
      path: '/',
      observation: ['[2] input "Buscar" name=q', '[3] button "Buscar"', '[7] link "Registros"', 'input[hidden] csrf_token'],
      requests: [{ method: 'GET', path: '/', status: 200, kind: 'document' }],
      thought: 'Herramienta interna con sesión iniciada. El formulario lleva token CSRF: las escrituras irán por navegador.',
    },
    {
      action: 'fill [2] ← zxq_acme + click [3]',
      path: '/listado?q=zxq_acme',
      observation: ['[9] link "ACME S.L."', 'Texto: 1 resultado'],
      requests: [{ method: 'GET', path: '/listado?q=zxq_acme', status: 200, kind: 'document' }],
    },
    {
      action: 'click [9] "ACME S.L."',
      path: '/registro/4412',
      observation: ['[4] textarea "Nota"', '[5] button "Guardar nota"', 'Texto: ACME S.L. · Cliente desde 2019'],
      requests: [{ method: 'GET', path: '/registro/4412', status: 200, kind: 'document' }],
    },
    {
      action: 'fill [4] ← zxq_llamada + click [5]',
      path: '/registro/4412',
      observation: ['Texto: Nota guardada'],
      requests: [{ method: 'POST', path: '/registro/4412/nota', status: 200, kind: 'document' }],
    },
    {
      action: 'click [8] "Exportar CSV"',
      path: '/exportar',
      observation: ['Texto: No tienes permisos para exportar'],
      requests: [{ method: 'POST', path: '/exportar', status: 403, kind: 'document' }],
    },
  ],
  candidates: [
    { id: 'c1', method: 'GET', url: '/listado?q={query}', params: ['query'], csrf: [], browser: true },
    { id: 'c2', method: 'GET', url: '/registro/{record_id}', params: ['record_id'], csrf: [], browser: false },
    { id: 'c3', method: 'POST', url: '/registro/{record_id}/nota', params: ['record_id', 'note'], csrf: ['csrf_token'], browser: true },
    { id: 'c4', method: 'POST', url: '/exportar', params: [], csrf: ['csrf_token'], browser: true },
  ],
  discarded: [{ candidate_id: 'c4', reason: 'El validador recibió 403: la exportación requiere un rol que la sesión no tiene.' }],
  finish: 'Búsqueda, ficha y nota probadas. La exportación queda fuera por permisos.',
};

const genericScenario: Scenario = {
  key: 'generic',
  name: 'Sitio web',
  description: 'Búsqueda y consulta de contenidos por la interfaz de la web.',
  category: 'datos',
  tags: ['búsqueda', 'contenidos'],
  mode: 'read_only',
  tools: [
    {
      name: 'search_site',
      method: 'GET',
      path: '/buscar?q={query}',
      description: 'Busca contenido en toda la web.',
      params: { query: { type: 'string', description: 'Texto libre.', example: 'presupuestos' } },
    },
    {
      name: 'list_sections',
      method: 'GET',
      path: '/api/secciones',
      description: 'Secciones principales con su id.',
      params: {},
    },
    {
      name: 'get_section',
      method: 'GET',
      path: '/api/secciones/{section_id}?orden={order}',
      description: 'Contenidos de una sección, con orden opcional.',
      params: {
        section_id: { type: 'string', description: 'Sección.', dependsOn: { tool: 'list_sections', path: 'sections[0].id' } },
        order: { type: 'string', description: 'Criterio de orden.', required: false },
      },
    },
    {
      name: 'read_page',
      startPath: '/',
      steps: [{ action: 'wait', value: '300' }],
      description: 'Texto principal de una página de la web.',
      params: {},
      extract: 'main',
    },
    {
      name: 'send_contact_form',
      startPath: '/contacto',
      steps: [
        { action: 'fill', selector: 'textarea[name=mensaje]', value: '{message}' },
        { action: 'click', selector: 'button[type=submit]' },
      ],
      description: 'Envía el formulario de contacto.',
      params: { message: { type: 'string', description: 'Mensaje.', example: 'Hola, quería consultar…' } },
      failure: '403: el formulario tiene captcha',
    },
  ],
  steps: [
    {
      action: 'Cargar la portada',
      path: '/',
      observation: ['[2] input "Buscar"', '[3] button (icono lupa)', '[6] link "Secciones"', '[11] link (×18 similares)', '[20] form "Contacto"'],
      requests: [{ method: 'GET', path: '/', status: 200, kind: 'document' }],
      thought: 'Sin pistas del dominio. Empiezo por el buscador y sigo con las secciones.',
    },
    {
      action: 'fill [2] ← zxq_presupuesto + click [3]',
      path: '/buscar?q=zxq_presupuesto',
      observation: ['Texto: 0 resultados para zxq_presupuesto', '[6] link "Secciones"'],
      requests: [{ method: 'GET', path: '/buscar?q=zxq_presupuesto', status: 200, kind: 'document' }],
    },
    {
      action: 'click [6] "Secciones"',
      path: '/secciones',
      observation: ['[4] select "Ordenar por"', '[8] link "Siguiente"', '[12] link (×8 similares)'],
      requests: [{ method: 'GET', path: '/api/secciones', status: 200 }],
    },
    {
      action: 'fill [20] ← zxq_hola + submit',
      path: '/contacto',
      observation: ['Texto: Verificación anti-bots'],
      requests: [{ method: 'POST', path: '/contacto', status: 403, kind: 'document' }],
    },
  ],
  candidates: [
    { id: 'c1', method: 'GET', url: '/buscar?q={query}', params: ['query'], csrf: [], browser: false },
    { id: 'c2', method: 'GET', url: '/api/secciones', params: [], csrf: [], browser: false },
    { id: 'c3', method: 'GET', url: '/api/secciones/{section_id}?orden={order}', params: ['section_id', 'order'], csrf: [], browser: false },
    { id: 'c4', method: 'POST', url: '/contacto', params: [], csrf: ['csrf_token'], browser: true },
  ],
  discarded: [{ candidate_id: 'c4', reason: '403: el formulario de contacto tiene captcha.' }],
  finish: 'La web no ofrece más acciones sin iniciar sesión.',
};

/* ------------------------------------------------------- selección y montaje */

function pickScenario(host: string, hint: string): Scenario {
  const hay = `${host} ${hint}`.toLowerCase();
  if (/localhost:8001|tienda|shop|store|market|compra|librer/.test(hay)) return storeScenario;
  if (/localhost:8002|restaur|reserv|mesa|booking|cita/.test(hay)) return restaurantScenario;
  if (/practicesoftwaretesting|toolshop/.test(hay)) return toolshopScenario;
  if (/crates\.io|crates|rust/.test(hay)) return cratesScenario;
  if (/factur|intranet|rrhh|vacacion|crm|erp|interno|panel|acme/.test(hay)) return internalScenario;
  return genericScenario;
}

/** Prefijo de sitio: el dominio sin TLD, o el nombre del escenario en localhost. */
function sitePrefix(host: string, scenario: Scenario): string {
  if (scenario.key === 'store') return 'libreria_zeta';
  if (scenario.key === 'restaurant') return 'casa_zeta';
  const parts = host.replace(/^www\./, '').split('.');
  const label = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  return slugify(label).replace(/-/g, '_') || 'site';
}

function prefixTools(tools: ToolSpec[], prefix: string): ToolSpec[] {
  const names = new Set(tools.map((tool) => tool.name));
  return tools.map((tool) => {
    const renamed = { ...tool, name: `${prefix}_${tool.name}` };
    if (renamed.params) {
      renamed.params = Object.fromEntries(
        Object.entries(renamed.params).map(([name, spec]) => {
          const next = { ...spec };
          if (next.dependsOn && names.has(next.dependsOn.tool)) {
            next.dependsOn = { ...next.dependsOn, tool: `${prefix}_${next.dependsOn.tool}` };
          }
          return [name, next];
        }),
      );
    }
    return renamed;
  });
}

const WRITE_ACTION = /submit|confirm|guardar|reservar|enviar|publicar|añadir|anadir|add|pay|pagar/i;

/** ¿La herramienta modifica datos? En solo lectura no se puede descubrir. */
function isWriteTool(tool: ToolSpec): boolean {
  if ('steps' in tool) {
    return tool.steps.some((step) => step.action === 'click' && WRITE_ACTION.test(step.selector ?? ''));
  }
  return !['GET', 'HEAD', 'OPTIONS'].includes(tool.method.toUpperCase());
}

function siteSlug(url: URL, scenario: Scenario): string {
  if (scenario.key === 'store') return 'libreria-zeta';
  if (scenario.key === 'restaurant') return 'casa-zeta';
  return slugify(url.hostname.replace(/^www\./, '')) || 'sitio';
}

function titleFromHost(host: string): string {
  const parts = host.replace(/^www\./, '').split('.');
  const label = parts.length > 1 ? parts[parts.length - 2] : parts[0];
  return label.charAt(0).toUpperCase() + label.slice(1).replace(/-/g, ' ');
}

/**
 * Construye la ejecución simulada: eventos §6.4, escena para el navegador de la
 * UI y el borrador que se materializa al terminar.
 */
export function buildGeneration(url: URL, options: GenerationOptions): GeneratedRun {
  const host = url.host;
  const scenario = pickScenario(host, options.hint ?? '');
  const prefix = sitePrefix(host, scenario);
  const tools = scenario.tools;
  const prefixed = prefixTools(tools, prefix);
  const readOnly = options.mode === 'read_only';
  const dropped = readOnly ? prefixed.filter(isWriteTool) : [];
  const effective = readOnly ? prefixed.filter((tool) => !isWriteTool(tool)) : prefixed;
  const slug = siteSlug(url, scenario);
  const now = Date.now();

  const draft: Mcp = defineMcp({
    id: `m-${now.toString(36)}`,
    slug,
    name: scenario === genericScenario ? titleFromHost(host) : scenario.name,
    site: host,
    scheme: url.protocol === 'http:' ? 'http' : 'https',
    description: scenario.description,
    category: scenario.category,
    tags: [...scenario.tags],
    author: CURRENT_USER_HANDLE,
    mode: options.mode,
    version: '0.1.0',
    license: 'MIT',
    verified: false,
    installs: 0,
    stars: 0,
    status: 'draft',
    visibility: 'public',
    updatedAt: new Date(now).toISOString(),
    createdAt: new Date(now).toISOString(),
    exploration: {
      steps: scenario.steps.length,
      requests: scenario.steps.reduce((n, s) => n + s.requests.length, 0),
      proposed: tools.length,
      durationSec: Math.round(
        (scenario.steps.length * 0.7 + scenario.steps.reduce((n, s) => n + s.requests.length, 0) * 0.34 + 4) * 10,
      ),
    },
    tools: effective,
  });

  const events: PipelineEvent[] = [];
  const scene: SceneFrame[] = [];
  let clock = now / 1000;
  const push = (event: PipelineEvent) => {
    events.push(event);
    clock += 0.6 + (EVENT_DELAY[event.type] ?? 300) / 1000;
  };

  push({ t: clock, type: 'run_started', url: url.href, cached: false });
  push({ t: clock, type: 'explore_started', url: url.href, policy: options.policy ?? 'llm', max_steps: options.maxSteps ?? 20 });
  push({ t: clock, type: 'mode', read_only: options.mode === 'read_only', site: host });
  if (options.mode === 'read_only') {
    push({ t: clock, type: 'warning', text: 'Web de terceros: solo lectura impuesta en la red. Los envíos que modifican datos se bloquean.' });
  }

  let requestId = 0;
  scenario.steps.forEach((step, i) => {
    push({ t: clock, type: 'thought', text: step.thought ?? t(`Paso ${i + 1}: ${step.action}.`) });
    const ids: number[] = [];
    const blocked =
      options.mode === 'read_only'
        ? step.requests.find((r) => !['GET', 'HEAD', 'OPTIONS'].includes(r.method.toUpperCase()))
        : undefined;
    if (!blocked) {
      for (const request of step.requests) {
        requestId += 1;
        ids.push(requestId);
        const full = /^https?:\/\//.test(request.path) ? request.path : `${url.origin}${request.path}`;
        push({
          t: clock,
          type: 'request',
          id: requestId,
          step: i,
          method: request.method,
          url: full,
          status: request.status,
          kind: request.kind ?? (request.path.startsWith('/api/') ? 'fetch' : 'document'),
        });
      }
    } else {
      push({ t: clock, type: 'blocked', step: i, method: blocked.method, url: `${url.origin}${blocked.path}` });
    }
    push({ t: clock, type: 'step', i, action: step.action, url: `${url.origin}${step.path}`, requests: ids, error: null });
    scene.push({ step: i, path: step.path, observation: step.observation });
  });

  push({ t: clock, type: 'finish', summary: scenario.finish });

  const blockedWrites = options.mode === 'read_only';
  const candidates = scenario.candidates.filter(
    (c) =>
      !(
        blockedWrites &&
        (!['GET', 'HEAD', 'OPTIONS'].includes(c.method.toUpperCase()) || c.csrf.length > 0)
      ),
  );
  for (const candidate of candidates) {
    push({
      t: clock,
      type: 'candidate',
      id: candidate.id,
      method: candidate.method,
      url: candidate.url,
      params: candidate.params,
      csrf: candidate.csrf,
      browser: candidate.browser,
    });
  }
  push({
    t: clock,
    type: 'explore_done',
    steps: scenario.steps.length,
    requests: scenario.steps.reduce((n, s) => n + s.requests.length, 0),
    candidates: candidates.length,
    dependencies: tools.reduce(
      (n, tool) => n + Object.values(tool.params ?? {}).filter((p) => p.dependsOn).length,
      0,
    ),
  });

  const manifestPath = `manifests/${slug}.json`;
  for (const tool of effective) {
    const isBrowser = 'steps' in tool;
    push({ t: clock, type: 'tool_proposed', name: tool.name, kind: isBrowser ? 'browser' : 'http', description: tool.description });
  }
  for (const discard of scenario.discarded) {
    push({ t: clock, type: 'candidate_discarded', candidate_id: discard.candidate_id, reason: discard.reason });
  }
  push({
    t: clock,
    type: 'synth_done',
    mode: 'llm',
    proposed: effective.length,
    discarded: scenario.discarded.length + dropped.length,
  });

  if (scenario.retry) {
    push({ t: clock, type: 'validate_retry', name: `${prefix}_${scenario.retry.name}`, reason: scenario.retry.reason, kind: 'browser' });
  }

  for (const tool of draft.tools) {
    push({
      t: clock,
      type: 'validated',
      name: tool.name,
      ok: tool.validated,
      kind: tool.kind,
      reason: tool.failure ?? null,
      swapped: Boolean(scenario.retry && tool.name.endsWith(`_${scenario.retry.name}`)),
      status: tool.validated ? 200 : null,
    });
  }
  push({ t: clock, type: 'validate_done', proposed: draft.tools.length, validated: draft.tools.filter((tool) => tool.validated).length });
  push({
    t: clock,
    type: 'done',
    proposed: draft.tools.length,
    validated: draft.tools.filter((tool) => tool.validated).length,
    manifest: manifestPath,
  });

  const durationMs = events.reduce((total, event) => total + (EVENT_DELAY[event.type] ?? 300) + 120, 0);
  return { events, scene, draft, durationMs };
}

export { faviconFor };
