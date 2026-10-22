/**
 * Catálogo de ejemplo del portal.
 *
 * Cada entrada es una declaración compacta que `defineMcp` convierte en:
 * manifiesto §6.1 completo, herramientas para la UI e informe de validación.
 * Los datos son ficticios salvo las webs públicas citadas (crates.io, Toolshop,
 * MusicBrainz…), que se usan en solo lectura y con User-Agent identificable.
 */
import type { BrowserStep, HttpMethod, JsonObject } from '../types/contract';
import type { ParamSpec, ToolSpec, HttpToolSpec, BrowserToolSpec } from './build';
import { defineMcp, weeklySeries } from './build';

/* --------------------------------------------------------------- atajos */

type Dict = Record<string, ParamSpec>;

const S = (description: string, example?: string, extra: Partial<ParamSpec> = {}): ParamSpec => ({
  type: 'string',
  description,
  ...(example !== undefined ? { example } : {}),
  ...extra,
});
const I = (description: string, extra: Partial<ParamSpec> = {}): ParamSpec => ({ type: 'integer', description, ...extra });
const N = (description: string): ParamSpec => ({ type: 'number', description });
const D = (description: string, extra: Partial<ParamSpec> = {}): ParamSpec => ({ type: 'date', description, ...extra });
const O = (spec: ParamSpec): ParamSpec => ({ ...spec, required: false });
const Dep = (description: string, tool: string, path: string): ParamSpec => ({
  type: 'string',
  description,
  dependsOn: { tool, path },
});

function http(
  name: string,
  method: HttpMethod,
  path: string,
  description: string,
  params: Dict = {},
  extra: Partial<HttpToolSpec> = {},
): ToolSpec {
  return { name, method, path, description, params, ...extra };
}

function browser(
  name: string,
  startPath: string,
  steps: BrowserStep[],
  description: string,
  params: Dict = {},
  extra: Partial<BrowserToolSpec> = {},
): ToolSpec {
  return { name, startPath, steps, description, params, ...extra };
}

const jsonBody = (body: JsonObject): Partial<HttpToolSpec> => ({ body, bodyType: 'json' });

/* --------------------------------------------------------------- datos */

export const SEED_MCPS = [
  /* ---------------------------------------------------------- demo: tienda */
  defineMcp({
    slug: 'tienda-demo',
    name: 'Librería Zeta',
    site: 'localhost:8001',
    scheme: 'http',
    description:
      'La tienda de demostración del explorador: búsqueda, ficha, carrito con cart_id encadenado y checkout simulado.',
    category: 'comercio',
    tags: ['carrito', 'checkout', 'demo', 'encadenado'],
    author: 'linen',
    official: true,
    verified: true,
    mode: 'read_write',
    version: '0.9.2',
    installs: 4310,
    stars: 214,
    weekly: { base: 310, trend: 1.1, seed: 5 },
    updatedAt: '2026-10-21T16:40:00Z',
    exploration: { steps: 14, requests: 38, proposed: 8, durationSec: 98 },
    tools: [
      http('search_products', 'GET', '/api/search?q={query}&category={category}', 'Busca libros por título o autor y filtra por categoría. Devuelve id, título, autor, precio y stock.', {
        query: S('Texto libre: título o autor.', 'asimov'),
        category: O(S('id de categoría obtenido con list_categories.', 'scifi')),
      }),
      http('list_categories', 'GET', '/api/categories', 'Categorías disponibles con su id y nombre.', {}),
      http('get_product', 'GET', '/api/products/{product_id}', 'Ficha de un libro: descripción, stock y precio. Requiere product_id de search_products.', {
        product_id: Dep('id del libro.', 'search_products', 'results[0].id'),
      }),
      http('create_cart', 'POST', '/api/cart', 'Crea un carrito vacío y devuelve su cart_id. Llámala antes de añadir artículos.', {}),
      http(
        'add_to_cart',
        'POST',
        '/api/cart/{cart_id}/items',
        'Añade un libro al carrito. Requiere cart_id de create_cart y product_id de search_products.',
        { cart_id: Dep('Carrito donde añadir.', 'create_cart', 'cart_id'), product_id: Dep('Libro a añadir.', 'search_products', 'results[0].id'), qty: O(I('Unidades (1 por defecto).', { default: 1, example: 1 })) },
        jsonBody({ product_id: '{product_id}', qty: '{qty}' }),
      ),
      http('get_cart', 'GET', '/api/cart/{cart_id}', 'Contenido, subtotales y total del carrito.', { cart_id: Dep('Carrito a consultar.', 'create_cart', 'cart_id') }),
      http(
        'checkout',
        'POST',
        '/api/cart/{cart_id}/checkout',
        'Cierra el pedido y devuelve order_id. Requiere cart_id con artículos.',
        { cart_id: Dep('Carrito a pagar.', 'create_cart', 'cart_id'), name: S('Nombre del cliente.', 'Ada Lovelace'), email: S('Correo de contacto.', 'ada@example.com') },
        jsonBody({ name: '{name}', email: '{email}' }),
      ),
      browser('list_new_arrivals', '/novedades', [{ action: 'click', selector: 'a[href="/novedades"]' }, { action: 'wait', value: '500' }], 'Novedades de la semana en la portada.', {}, { failure: 'La página devolvió 0 elementos' }),
    ],
  }),

  /* ------------------------------------------------------ demo: restaurante */
  defineMcp({
    slug: 'casa-zeta',
    name: 'Casa Zeta',
    site: 'localhost:8002',
    scheme: 'http',
    description:
      'Disponibilidad y reservas del restaurante de demostración. Formularios HTML con token CSRF: todo se ejecuta en navegador.',
    category: 'reservas',
    tags: ['restaurante', 'mesas', 'csrf', 'formularios'],
    author: 'linen',
    official: true,
    verified: true,
    mode: 'read_write',
    version: '0.8.0',
    installs: 2870,
    stars: 168,
    weekly: { base: 240, trend: 0.8, seed: 8 },
    updatedAt: '2026-10-22T09:10:00Z',
    exploration: { steps: 17, requests: 22, proposed: 4, durationSec: 131 },
    tools: [
      browser(
        'check_availability',
        '/disponibilidad',
        [
          { action: 'fill', selector: 'input[name=date]', value: '{date}' },
          { action: 'fill', selector: 'input[name=people]', value: '{people}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Horas con mesa libre para una fecha y número de comensales.',
        { date: D('Día de la reserva (YYYY-MM-DD).'), people: I('Comensales, 1–12.', { example: 4 }) },
        { extract: 'main' },
      ),
      browser(
        'book_table',
        '/reservar',
        [
          { action: 'fill', selector: 'input[name=date]', value: '{date}' },
          { action: 'select', selector: 'select[name=time]', value: '{time}' },
          { action: 'fill', selector: 'input[name=people]', value: '{people}' },
          { action: 'fill', selector: 'input[name=name]', value: '{name}' },
          { action: 'fill', selector: 'input[name=phone]', value: '{phone}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Reserva una mesa y devuelve el código R-XXXXXX. Requiere una hora libre de check_availability.',
        {
          date: D('Día de la reserva (YYYY-MM-DD).'),
          time: S('Hora de la reserva.', '21:00', { enum: ['13:00', '13:30', '14:00', '14:30', '20:00', '20:30', '21:00', '21:30', '22:00'] }),
          people: I('Comensales, 1–12.', { example: 4 }),
          name: S('Nombre a nombre de quién se reserva.', 'Ada Lovelace'),
          phone: S('Teléfono de contacto.', '600123456'),
        },
        { extract: 'main' },
      ),
      browser(
        'get_booking',
        '/reserva',
        [
          { action: 'fill', selector: 'input[name=code]', value: '{code}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Consulta una reserva por su código. Devuelve fecha, hora y comensales.',
        { code: Dep('Código devuelto por book_table.', 'book_table', 'code') },
        { extract: 'main' },
      ),
      browser('get_menu', '/menu', [{ action: 'wait', value: '300' }], 'Carta del día con precios y alérgenos.', {}, { extract: 'main' }),
    ],
  }),

  /* ----------------------------------------------------------- openlibrary */
  defineMcp({
    slug: 'openlibrary',
    name: 'Open Library',
    site: 'openlibrary.org',
    description:
      'Busca libros, autores y ediciones en Open Library: fichas bibliográficas, portadas y materias.',
    category: 'libros',
    tags: ['libros', 'isbn', 'autores', 'catálogo'],
    author: 'linen',
    official: true,
    verified: true,
    version: '1.4.0',
    installs: 12840,
    stars: 512,
    weekly: { base: 820, trend: 0.6, seed: 3 },
    updatedAt: '2026-10-19T10:12:00Z',
    tools: [
      http('search_books', 'GET', '/search.json?q={query}&page={page}', 'Busca libros por título, autor o ISBN. Devuelve work_id, autores y año.', {
        query: S('Título, autor o ISBN.', 'foundation asimov'),
        page: O(I('Página de resultados (1 por defecto).', { default: 1 })),
      }),
      http('get_work', 'GET', '/works/{work_id}.json', 'Detalle de una obra: descripción, temas y portada. Requiere work_id de search_books.', {
        work_id: Dep('Clave de la obra.', 'search_books', 'docs[0].key'),
      }),
      http('list_editions', 'GET', '/works/{work_id}/editions.json?limit={limit}', 'Ediciones disponibles con ISBN y editorial.', {
        work_id: Dep('Clave de la obra.', 'search_books', 'docs[0].key'),
        limit: O(I('Máximo de ediciones (20 por defecto).', { default: 20 })),
      }),
      http('search_authors', 'GET', '/search/authors.json?q={name}', 'Busca autores por nombre y devuelve su author_id.', { name: S('Nombre del autor.', 'Isaac Asimov') }),
      http('get_author_works', 'GET', '/authors/{author_id}/works.json?limit={limit}', 'Obras de un autor. Requiere author_id de search_authors.', {
        author_id: Dep('Clave del autor.', 'search_authors', 'docs[0].key'),
        limit: O(I('Máximo de obras (50 por defecto).', { default: 50 })),
      }),
      http('browse_subject', 'GET', '/subjects/{subject}.json', 'Lista obras de una materia, por ejemplo science_fiction.', { subject: S('Materia en minúsculas y guiones bajos.', 'science_fiction') }),
    ],
  }),

  /* -------------------------------------------------------------- la tasca */
  defineMcp({
    slug: 'la-tasca',
    name: 'La Tasca de Lavapiés',
    site: 'reservas.latascalavapies.es',
    icon: '/favicons/reservas.latascalavapies.es.svg',
    description:
      'Disponibilidad y reservas de mesa en La Tasca de Lavapiés. Formularios HTML con token CSRF, ejecutados en navegador.',
    category: 'reservas',
    tags: ['restaurante', 'mesas', 'csrf', 'formularios'],
    author: 'lucia',
    verified: true,
    mode: 'read_write',
    version: '1.1.0',
    installs: 2118,
    stars: 143,
    weekly: { base: 160, trend: 0.4, seed: 11 },
    updatedAt: '2026-10-14T09:00:00Z',
    exploration: { steps: 17, requests: 22, proposed: 6, durationSec: 204 },
    tools: [
      browser(
        'check_availability',
        '/reservar',
        [
          { action: 'fill', selector: '.slots input[name=date]', value: '{date}' },
          { action: 'fill', selector: '.slots input[name=people]', value: '{people}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Horarios libres para una fecha y número de comensales.',
        { date: D('Día de la reserva (YYYY-MM-DD).'), people: I('Comensales, 1–10.', { example: 2 }) },
        { extract: 'main' },
      ),
      browser(
        'book_table',
        '/reservar',
        [
          { action: 'fill', selector: 'form[action="/reservar"] input[name=name]', value: '{name}' },
          { action: 'fill', selector: 'form[action="/reservar"] input[name=phone]', value: '{phone}' },
          { action: 'fill', selector: 'form[action="/reservar"] input[name=date]', value: '{date}' },
          { action: 'select', selector: 'form[action="/reservar"] select[name=time]', value: '{time}' },
          { action: 'fill', selector: 'form[action="/reservar"] input[name=people]', value: '{people}' },
          { action: 'click', selector: 'form[action="/reservar"] button[type=submit]' },
        ],
        'Reserva una mesa. Devuelve el código de reserva R-XXXXXX.',
        {
          date: D('Día de la reserva (YYYY-MM-DD).'),
          time: S('Hora de la reserva.', '21:00', { enum: ['13:00', '13:30', '14:00', '20:00', '20:30', '21:00', '21:30', '22:00'] }),
          people: I('Comensales.', { example: 4 }),
          name: S('Nombre de la reserva.', 'Ada Lovelace'),
          phone: S('Teléfono de contacto.', '600123456'),
        },
        { extract: 'main' },
      ),
      browser(
        'cancel_booking',
        '/cancelar',
        [
          { action: 'fill', selector: 'input[name=code]', value: '{booking_code}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Cancela una reserva existente con su código.',
        { booking_code: Dep('Código de la reserva.', 'book_table', 'code') },
        { extract: '.alert' },
      ),
      browser('get_menu', '/carta', [{ action: 'wait', value: '300' }], 'Carta del día con precios y alérgenos.', {}, { extract: 'main' }),
    ],
  }),

  /* ------------------------------------------------------------------ BOE */
  defineMcp({
    slug: 'boe-sumarios',
    name: 'BOE',
    site: 'boe.es',
    icon: '/favicons/boe.es.png',
    description:
      'Sumarios diarios y búsqueda de disposiciones del Boletín Oficial del Estado, con enlace al PDF de cada documento.',
    category: 'administracion',
    tags: ['boe', 'legislación', 'boletines', 'administración'],
    author: 'nadia',
    verified: true,
    version: '2.0.1',
    installs: 6025,
    stars: 288,
    weekly: { base: 410, trend: 0.3, seed: 2 },
    updatedAt: '2026-10-20T07:30:00Z',
    tools: [
      http('daily_summary', 'GET', '/diario_boe/xml.php?id=BOE-S-{date}', 'Sumario del BOE de un día, agrupado por sección y departamento.', {
        date: D('Fecha del boletín (YYYY-MM-DD).'),
      }),
      http('search_documents', 'GET', '/buscar/legislacion.php?q={query}&desde={from}', 'Busca disposiciones por texto y fecha mínima.', {
        query: S('Texto a buscar.', 'protección de datos'),
        from: O(D('Fecha mínima de publicación.')),
      }),
      http('get_document', 'GET', '/diario_boe/txt.php?id={document_id}', 'Texto íntegro y metadatos de una disposición (BOE-A-…).', {
        document_id: Dep('Identificador del documento.', 'search_documents', 'results[0].id'),
      }),
      http('list_departments', 'GET', '/buscar/legislacion.php?campo=departamento', 'Departamentos emisores disponibles para filtrar.', {}),
    ],
  }),

  /* ----------------------------------------------------------- hackernews */
  defineMcp({
    slug: 'hackernews',
    name: 'Hacker News',
    site: 'news.ycombinator.com',
    icon: '/favicons/news.ycombinator.com.png',
    description: 'Portada, búsqueda y comentarios de Hacker News tal y como los ve un lector, sin la API oficial.',
    category: 'desarrollo',
    tags: ['noticias', 'tecnología', 'comentarios'],
    author: 'marcos',
    verified: true,
    version: '1.2.3',
    installs: 8890,
    stars: 356,
    weekly: { base: 640, trend: -0.1, seed: 7 },
    updatedAt: '2026-10-02T18:20:00Z',
    tools: [
      http('front_page', 'GET', '/news?p={page}', 'Historias de la portada con puntos, autor y número de comentarios.', { page: O(I('Página de la portada.', { default: 1 })) }),
      http('search_stories', 'GET', 'https://hn.algolia.com/api/v1/search?query={query}', 'Busca historias por texto (el buscador que usa la propia web).', { query: S('Texto a buscar.', 'sqlite') }),
      http('get_item', 'GET', '/item?id={item_id}', 'Una historia con su árbol de comentarios, en texto.', { item_id: Dep('id de la historia.', 'search_stories', 'hits[0].objectID') }),
      http('user_profile', 'GET', '/user?id={username}', 'Karma, antigüedad y descripción de un usuario.', { username: S('Usuario de HN.', 'pg') }),
    ],
  }),

  /* ---------------------------------------------------------------- arXiv */
  defineMcp({
    slug: 'arxiv-listings',
    name: 'arXiv',
    site: 'arxiv.org',
    icon: '/favicons/arxiv.org.png',
    description: 'Novedades por categoría, búsqueda y resúmenes de artículos de arXiv.',
    category: 'ciencia',
    tags: ['papers', 'preprints', 'investigación'],
    author: 'nadia',
    verified: true,
    version: '1.0.4',
    installs: 3702,
    stars: 197,
    weekly: { base: 260, trend: 0.5, seed: 13 },
    updatedAt: '2026-10-11T12:00:00Z',
    tools: [
      http('list_new', 'GET', '/list/{category}/new', 'Envíos nuevos de una categoría (por ejemplo cs.AI).', { category: S('Categoría de arXiv.', 'cs.AI') }),
      http('search_papers', 'GET', '/a/search?query={query}&size={max}', 'Busca artículos por título, autor o resumen.', {
        query: S('Texto a buscar.', 'retrieval augmented generation'),
        max: O(I('Resultados por página (25 por defecto).', { default: 25 })),
      }),
      http('get_abstract', 'GET', '/abs/{arxiv_id}', 'Título, autores, resumen y versiones de un artículo.', { arxiv_id: Dep('Identificador del artículo.', 'search_papers', 'results[0].id') }),
    ],
  }),

  /* ------------------------------------------------------------- gutenberg */
  defineMcp({
    slug: 'gutenberg',
    name: 'Project Gutenberg',
    site: 'gutenberg.org',
    icon: '/favicons/gutenberg.org.png',
    description: 'Más de 70.000 libros de dominio público: búsqueda, estanterías temáticas y formatos de descarga.',
    category: 'libros',
    tags: ['dominio público', 'ebooks', 'epub'],
    author: 'pere',
    verified: true,
    version: '1.0.0',
    installs: 2944,
    stars: 172,
    weekly: { base: 180, trend: 0.2, seed: 17 },
    updatedAt: '2026-09-27T08:45:00Z',
    tools: [
      http('search_ebooks', 'GET', '/ebooks/search/?query={query}', 'Busca libros por título o autor.', { query: S('Título o autor.', 'shelley') }),
      http('get_book', 'GET', '/ebooks/{book_id}', 'Ficha bibliográfica de un libro con formatos de descarga.', { book_id: Dep('id del libro.', 'search_ebooks', 'results[0].id') }),
      http('list_bookshelf', 'GET', '/ebooks/bookshelf/{shelf_id}', 'Libros de una estantería temática.', { shelf_id: S('id de la estantería.', '64') }),
    ],
  }),

  /* ------------------------------------------------------------ pádel norte */
  defineMcp({
    slug: 'padel-norte',
    name: 'Club Pádel Norte',
    site: 'reservas.clubpadelnorte.es',
    icon: '/favicons/reservas.clubpadelnorte.es.svg',
    description: 'Pistas libres y reservas en el Club Pádel Norte. El formulario usa CSRF, así que todo va por navegador.',
    category: 'reservas',
    tags: ['deporte', 'pistas', 'csrf'],
    author: 'marcos',
    verified: true,
    mode: 'read_write',
    version: '0.3.0',
    installs: 812,
    stars: 61,
    weekly: { base: 70, trend: 0.9, seed: 19 },
    updatedAt: '2026-10-17T20:10:00Z',
    tools: [
      browser('list_courts', '/pistas', [{ action: 'fill', selector: 'input[name=fecha]', value: '{date}' }, { action: 'click', selector: 'button[type=submit]' }], 'Pistas y franjas libres en una fecha.', { date: D('Fecha a consultar (YYYY-MM-DD).') }, { extract: 'table.disponibilidad' }),
      browser('book_court', '/pistas', [
        { action: 'click', selector: 'td[data-pista="{court_id}"][data-hora="{slot}"]' },
        { action: 'fill', selector: 'input[name=nombre]', value: '{name}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Reserva una franja de una pista concreta.', {
        court_id: Dep('id de la pista.', 'list_courts', 'courts[0].id'),
        slot: Dep('Franja horaria libre.', 'list_courts', 'courts[0].free[0]'),
        name: S('Nombre del socio.', 'Ada Lovelace'),
      }, { extract: '.confirmacion' }),
      browser('club_rates', '/tarifas', [{ action: 'wait', value: '300' }], 'Tarifas por franja horaria y para socios.', {}, { extract: 'main' }),
    ],
  }),

  /* --------------------------------------------------------------- buses */
  defineMcp({
    slug: 'buses-interurbanos',
    name: 'Autobuses interurbanos',
    site: 'horarios.autobusesinterurbanos.es',
    icon: '/favicons/horarios.autobusesinterurbanos.es.svg',
    description: 'Rutas, horarios por línea y próximas salidas de los autobuses interurbanos.',
    category: 'transporte',
    tags: ['autobús', 'horarios', 'rutas'],
    author: 'marcos',
    verified: true,
    version: '1.0.1',
    installs: 1530,
    stars: 98,
    weekly: { base: 120, trend: 0.7, seed: 23 },
    updatedAt: '2026-10-08T06:15:00Z',
    tools: [
      http('search_routes', 'GET', '/api/rutas?origen={origin}&destino={destination}&fecha={date}', 'Combinaciones entre dos paradas para una fecha.', {
        origin: S('Parada de origen.', 'Moncloa'),
        destination: S('Parada de destino.', 'Alcalá de Henares'),
        date: D('Fecha del viaje (YYYY-MM-DD).'),
      }),
      http('get_timetable', 'GET', '/api/lineas/{line_id}/horario', 'Horario completo de una línea en ambos sentidos.', { line_id: Dep('id de la línea.', 'search_routes', 'routes[0].line_id') }),
      http('next_departures', 'GET', '/api/paradas/{stop_id}/proximas', 'Próximas salidas desde una parada.', { stop_id: Dep('id de la parada.', 'find_stop', 'stops[0].id') }),
      http('find_stop', 'GET', '/api/paradas?q={query}', 'Busca paradas por nombre y devuelve stop_id.', { query: S('Nombre de la parada.', 'Moncloa') }),
    ],
  }),

  /* ------------------------------------------------------- agenda cultural */
  defineMcp({
    slug: 'agenda-cultural',
    name: 'Agenda cultural de Madrid',
    site: 'agenda.madridcultura.es',
    icon: '/favicons/agenda.madridcultura.es.svg',
    description: 'Conciertos, exposiciones y teatro de la agenda cultural municipal, con filtros por fecha y espacio.',
    category: 'cultura',
    tags: ['cultura', 'conciertos', 'agenda'],
    author: 'lucia',
    verified: true,
    version: '0.5.0',
    installs: 1206,
    stars: 84,
    weekly: { base: 95, trend: 0.2, seed: 29 },
    updatedAt: '2026-10-12T11:30:00Z',
    tools: [
      http('search_events', 'GET', '/api/eventos?q={query}&desde={date_from}', 'Busca eventos por texto y fecha de inicio.', {
        query: O(S('Texto libre: título, compañía o espacio.', 'jazz')),
        date_from: O(D('Fecha mínima (YYYY-MM-DD).')),
      }),
      http('event_detail', 'GET', '/api/eventos/{event_id}', 'Horario, precio, espacio y enlace de entradas.', { event_id: Dep('id del evento.', 'search_events', 'events[0].id') }),
      http('list_venues', 'GET', '/api/espacios', 'Espacios culturales con dirección y aforo.', {}),
    ],
  }),

  /* -------------------------------------------------------------- cines van */
  defineMcp({
    slug: 'cines-van',
    name: 'Cines Van',
    site: 'entradas.cinesvan.es',
    icon: '/favicons/entradas.cinesvan.es.svg',
    description: 'Cartelera, sesiones y mapa de butacas de Cines Van. La compra queda fuera a propósito.',
    category: 'cultura',
    tags: ['cine', 'cartelera', 'sesiones'],
    author: 'nadia',
    verified: true,
    version: '1.0.0',
    installs: 974,
    stars: 57,
    weekly: { base: 66, trend: 0.35, seed: 31 },
    updatedAt: '2026-10-05T19:00:00Z',
    tools: [
      http('list_showtimes', 'GET', '/api/sesiones?fecha={date}', 'Películas y sesiones de un día.', { date: D('Día de la cartelera (YYYY-MM-DD).') }),
      http('get_movie', 'GET', '/api/peliculas/{movie_id}', 'Sinopsis, duración y calificación por edades.', { movie_id: Dep('id de la película.', 'list_showtimes', 'movies[0].id') }),
      http('seat_map', 'GET', '/api/sesiones/{session_id}/butacas', 'Butacas libres y ocupadas de una sesión.', { session_id: Dep('id de la sesión.', 'list_showtimes', 'movies[0].sessions[0].id') }),
    ],
  }),

  /* ---------------------------------------------------------------- empleo */
  defineMcp({
    slug: 'empleo-valencia',
    name: 'Empleo Valencia',
    site: 'empleo.ayto-valencia.es',
    icon: '/favicons/empleo.ayto-valencia.es.svg',
    description: 'Ofertas del portal municipal de empleo: búsqueda por texto y distrito, y detalle de cada oferta.',
    category: 'empleo',
    tags: ['ofertas', 'empleo público', 'ayuntamiento'],
    author: 'lucia',
    verified: true,
    version: '0.2.1',
    installs: 688,
    stars: 43,
    weekly: { base: 48, trend: 0.15, seed: 37 },
    updatedAt: '2026-09-30T10:00:00Z',
    tools: [
      browser('search_offers', '/ofertas', [
        { action: 'fill', selector: 'input[name=q]', value: '{query}' },
        { action: 'select', selector: 'select[name=distrito]', value: '{district}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Ofertas por texto y distrito.', { query: O(S('Puesto o palabra clave.', 'administrativo')), district: O(S('Distrito municipal.', 'extramurs')) }, { extract: 'main' }),
      http('get_offer', 'GET', '/ofertas/{offer_id}', 'Requisitos, salario y plazo de una oferta.', { offer_id: Dep('id de la oferta.', 'search_offers', 'results[0].id') }),
      browser('list_categories', '/ofertas', [{ action: 'wait', value: '300' }], 'Sectores profesionales disponibles.', {}, { extract: 'select[name=sector]' }),
    ],
  }),

  /* ------------------------------------------------------------ bibliotecas */
  defineMcp({
    slug: 'bibliotecas-getafe',
    name: 'Bibliotecas de Getafe',
    site: 'catalogo.bibliotecasgetafe.es',
    icon: '/favicons/catalogo.bibliotecasgetafe.es.svg',
    description: 'Catálogo de la red de bibliotecas: búsqueda, ejemplares disponibles por sede y reserva de salas de estudio.',
    category: 'libros',
    tags: ['biblioteca', 'opac', 'salas'],
    author: 'pere',
    verified: true,
    mode: 'read_write',
    version: '0.4.0',
    installs: 431,
    stars: 29,
    weekly: { base: 30, trend: 0.5, seed: 41 },
    updatedAt: '2026-10-16T13:00:00Z',
    tools: [
      http('search_catalog', 'GET', '/opac/buscar?q={query}&tipo={type}', 'Busca en el catálogo por título, autor o materia.', { query: S('Título, autor o materia.', 'cortázar'), type: O(S('Tipo de material.', 'libro')) }),
      http('check_copies', 'GET', '/opac/registro/{record_id}/ejemplares', 'Ejemplares por sede y si están prestados.', { record_id: Dep('id del registro.', 'search_catalog', 'results[0].id') }),
      browser('reserve_study_room', '/salas', [
        { action: 'fill', selector: 'input[name=fecha]', value: '{date}' },
        { action: 'click', selector: 'button[data-franja="{slot}"]' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Reserva una sala de estudio en una franja.', { date: D('Día de la reserva (YYYY-MM-DD).'), slot: S('Franja horaria.', '10:00') }, { extract: '.resumen' }),
    ],
  }),

  /* ---------------------------------------------------------- rastro market */
  defineMcp({
    slug: 'rastro-market',
    name: 'Rastro Market',
    site: 'rastro.market',
    icon: '/favicons/rastro.market.svg',
    description: 'Anuncios de segunda mano: búsqueda con precio máximo y contacto por formulario.',
    category: 'comercio',
    tags: ['segunda mano', 'anuncios'],
    author: 'nadia',
    verified: true,
    version: '1.3.0',
    installs: 1752,
    stars: 121,
    weekly: { base: 140, trend: 0.25, seed: 43 },
    updatedAt: '2026-10-09T15:00:00Z',
    tools: [
      http('search_listings', 'GET', '/api/anuncios?q={query}&max={max_price}', 'Anuncios por texto con precio máximo opcional.', {
        query: S('Qué buscas.', 'bicicleta'),
        max_price: O(N('Precio máximo en euros.')),
      }),
      http('get_listing', 'GET', '/api/anuncios/{listing_id}', 'Fotos, precio, estado y zona de un anuncio.', { listing_id: Dep('id del anuncio.', 'search_listings', 'listings[0].id') }),
      http('contact_seller', 'POST', '/anuncio/{listing_id}/mensaje', 'Envía un mensaje al vendedor desde el formulario público.', { listing_id: Dep('id del anuncio.', 'search_listings', 'listings[0].id'), message: S('Mensaje para el vendedor.', '¿Sigue disponible?') }, {
        body: { mensaje: '{message}' },
        bodyType: 'form',
      }),
    ],
  }),

  /* ---------------------------------------------------------------- caniuse */
  defineMcp({
    slug: 'caniuse',
    name: 'Can I use',
    site: 'caniuse.com',
    icon: '/favicons/caniuse.com.png',
    description: 'Compatibilidad de funcionalidades web por navegador y versión, directamente desde las tablas de caniuse.',
    category: 'desarrollo',
    tags: ['css', 'javascript', 'navegadores'],
    author: 'linen',
    verified: true,
    version: '1.0.2',
    installs: 3390,
    stars: 203,
    weekly: { base: 290, trend: 0.8, seed: 47 },
    updatedAt: '2026-10-18T22:05:00Z',
    tools: [
      http('search_features', 'GET', '/process/query.php?search={query}', 'Busca funcionalidades por nombre (por ejemplo "container queries").', { query: S('Funcionalidad web.', 'container queries') }),
      http('feature_support', 'GET', '/process/get_feat_data.php?type=support-data&feats={feature_id}', 'Soporte por navegador y versión de una funcionalidad.', { feature_id: Dep('id de la funcionalidad.', 'search_features', 'results[0].id') }),
    ],
  }),

  /* ----------------------------------------------------------- tabla mareas */
  defineMcp({
    slug: 'tabla-mareas',
    name: 'Tabla de mareas',
    site: 'tablademareas.com',
    icon: '/favicons/tablademareas.com.png',
    description: 'Pleamares, bajamares y coeficientes por puerto y día.',
    category: 'datos',
    tags: ['mar', 'mareas', 'puertos'],
    author: 'linen',
    version: '0.2.0',
    installs: 512,
    stars: 34,
    weekly: { base: 40, trend: 0.4, seed: 53 },
    updatedAt: '2026-10-10T09:20:00Z',
    tools: [
      browser('find_port', '/', [{ action: 'fill', selector: 'input#buscador', value: '{query}' }, { action: 'click', selector: 'button[type=submit]' }], 'Busca un puerto y devuelve su ruta.', { query: S('Nombre del puerto.', 'A Coruña') }, { extract: '.resultados' }),
      http('get_tides', 'GET', '/mareas/{port_path}?fecha={date}', 'Mareas de un puerto en una fecha.', { port_path: Dep('Ruta del puerto.', 'find_port', 'results[0].href'), date: D('Fecha (YYYY-MM-DD).') }),
    ],
  }),

  /* ------------------------------------------------------- farmacias guardia */
  defineMcp({
    slug: 'farmacias-guardia',
    name: 'Farmacias de guardia',
    site: 'farmaciasdeguardia.cofm.es',
    icon: '/favicons/farmaciasdeguardia.cofm.es.svg',
    description: 'Farmacias de guardia por municipio y fecha, con dirección y teléfono de cada una.',
    category: 'datos',
    tags: ['salud', 'farmacias', 'guardias'],
    author: 'nadia',
    verified: true,
    version: '1.0.0',
    installs: 2387,
    stars: 156,
    weekly: { base: 190, trend: 0.45, seed: 59 },
    updatedAt: '2026-10-21T08:10:00Z',
    tools: [
      browser('on_duty', '/guardias', [
        { action: 'select', selector: 'select[name=municipio]', value: '{town}' },
        { action: 'fill', selector: 'input[name=fecha]', value: '{date}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Farmacias de guardia en un municipio y día.', { town: S('Municipio.', 'Getafe'), date: D('Día a consultar (YYYY-MM-DD).') }, { extract: '.listado' }),
      browser('list_towns', '/guardias', [{ action: 'wait', value: '300' }], 'Municipios disponibles.', {}, { extract: 'select[name=municipio]' }),
      http('pharmacy_detail', 'GET', '/farmacia/{pharmacy_id}', 'Dirección, teléfono y horario de una farmacia.', { pharmacy_id: Dep('id de la farmacia.', 'on_duty', 'results[0].id') }),
    ],
  }),

  /* ------------------------------------------------------------ teatro circo */
  defineMcp({
    slug: 'teatro-circo',
    name: 'Teatro Circo',
    site: 'agenda.teatrocirco.es',
    icon: '/favicons/agenda.teatrocirco.es.svg',
    description: 'Programación, funciones y butacas libres del Teatro Circo. La compra se queda fuera.',
    category: 'cultura',
    tags: ['teatro', 'funciones', 'butacas'],
    author: 'lucia',
    verified: true,
    version: '0.6.0',
    installs: 1094,
    stars: 73,
    weekly: { base: 85, trend: 0.6, seed: 61 },
    updatedAt: '2026-10-15T17:40:00Z',
    tools: [
      http('list_shows', 'GET', '/api/programacion?mes={month}', 'Espectáculos del mes con fechas y precios.', { month: O(S('Mes en formato YYYY-MM.', '2026-11')) }),
      http('show_detail', 'GET', '/api/espectaculos/{show_id}', 'Sinopsis, duración, reparto y funciones.', { show_id: Dep('id del espectáculo.', 'list_shows', 'shows[0].id') }),
      http('free_seats', 'GET', '/api/funciones/{performance_id}/butacas', 'Butacas libres por zona en una función.', { performance_id: Dep('id de la función.', 'show_detail', 'performances[0].id') }),
      browser('accessibility_info', '/accesibilidad', [{ action: 'wait', value: '300' }], 'Accesos, bucle magnético y plazas reservadas.', {}, { extract: 'main' }),
    ],
  }),

  /* ------------------------------------------------------------- crates.io */
  defineMcp({
    slug: 'crates-io',
    name: 'crates.io',
    site: 'crates.io',
    description: 'Busca crates de Rust, consulta sus versiones y descarga estadísticas desde la API que usa la propia web.',
    category: 'desarrollo',
    tags: ['rust', 'crates', 'paquetes'],
    author: 'marcos',
    verified: true,
    version: '1.0.0',
    installs: 5210,
    stars: 264,
    weekly: { base: 430, trend: 0.9, seed: 67 },
    updatedAt: '2026-10-22T11:20:00Z',
    exploration: { steps: 9, requests: 14, proposed: 4, durationSec: 72 },
    tools: [
      http('search_crates', 'GET', 'https://crates.io/api/v1/crates?q={query}&per_page={per_page}', 'Busca crates por texto. Devuelve nombre, descripción y descargas.', {
        query: S('Qué buscar.', 'serde'),
        per_page: O(I('Resultados por página (10 por defecto).', { default: 10 })),
      }, { headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' } }),
      http('get_crate', 'GET', 'https://crates.io/api/v1/crates/{crate_name}', 'Ficha de un crate: última versión, licencia y repositorio.', { crate_name: Dep('Nombre del crate.', 'search_crates', 'crates[0].name') }, {
        headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
      }),
      http('list_versions', 'GET', 'https://crates.io/api/v1/crates/{crate_name}/versions', 'Versiones publicadas de un crate, con fecha y número de descargas.', { crate_name: Dep('Nombre del crate.', 'search_crates', 'crates[0].name') }, {
        headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
      }),
      http('crate_owners', 'GET', 'https://crates.io/api/v1/crates/{crate_name}/owners', 'Personas y equipos que mantienen el crate.', { crate_name: Dep('Nombre del crate.', 'search_crates', 'crates[0].name') }, {
        headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' },
      }),
    ],
  }),

  /* -------------------------------------------------------------- toolshop */
  defineMcp({
    slug: 'toolshop',
    name: 'Toolshop',
    site: 'practicesoftwaretesting.com',
    description: 'Catálogo de herramientas de la demo Toolshop: búsqueda, filtros por categoría y marca, y ficha de producto.',
    category: 'comercio',
    tags: ['herramientas', 'filtros', 'cloudflare', 'demo'],
    author: 'marcos',
    verified: true,
    version: '1.1.0',
    installs: 1960,
    stars: 118,
    weekly: { base: 150, trend: 0.7, seed: 71 },
    updatedAt: '2026-10-20T16:05:00Z',
    exploration: { steps: 14, requests: 46, proposed: 6, durationSec: 238 },
    tools: [
      http('search_products', 'QUERY', 'https://api.practicesoftwaretesting.com/products/search?q={query}', 'Busca productos por texto. Devuelve id, nombre, precio y stock.', { query: S('Texto libre.', 'hammer') }),
      http('list_products', 'GET', 'https://api.practicesoftwaretesting.com/products?page={page}&between=price,{min_price},{max_price}', 'Lista paginada con filtro de precio.', {
        page: O(I('Página (1 por defecto).', { default: 1 })),
        min_price: O(N('Precio mínimo en euros.')),
        max_price: O(N('Precio máximo en euros.')),
      }),
      http('get_product', 'GET', 'https://api.practicesoftwaretesting.com/products/{product_id}', 'Ficha de un producto con especificaciones y stock.', { product_id: Dep('id del producto.', 'search_products', 'data[0].id') }),
      http('list_categories', 'GET', 'https://api.practicesoftwaretesting.com/categories', 'Categorías con su id y nombre.', {}),
      http('list_brands', 'GET', 'https://api.practicesoftwaretesting.com/brands', 'Marcas disponibles para filtrar.', {}),
    ],
  }),

  /* ----------------------------------------------------------- musicbrainz */
  defineMcp({
    slug: 'musicbrainz',
    name: 'MusicBrainz',
    site: 'musicbrainz.org',
    description: 'Busca artistas, grupos y grabaciones en MusicBrainz, con discografía y fechas de publicación.',
    category: 'cultura',
    tags: ['música', 'artistas', 'discografía'],
    author: 'sofia',
    verified: true,
    version: '1.0.1',
    installs: 1440,
    stars: 96,
    weekly: { base: 110, trend: 0.5, seed: 73 },
    updatedAt: '2026-10-13T14:00:00Z',
    tools: [
      http('search_artists', 'GET', 'https://musicbrainz.org/ws/2/artist?query={query}&fmt=json', 'Busca artistas por nombre y devuelve su id de MusicBrainz.', {
        query: S('Nombre del artista o grupo.', 'Radiohead'),
      }, { headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' } }),
      http('artist_releases', 'GET', 'https://musicbrainz.org/ws/2/artist/{artist_id}?inc=releases&fmt=json', 'Discografía de un artista con títulos y fechas.', {
        artist_id: Dep('id del artista.', 'search_artists', 'artists[0].id'),
      }, { headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' } }),
      http('search_recordings', 'GET', 'https://musicbrainz.org/ws/2/recording?query={query}&fmt=json', 'Busca grabaciones y devuelve duración y artista.', {
        query: S('Canción o tema.', 'paranoid android'),
      }, { headers: { 'User-Agent': 'mcportal/0.1 (hackathon; contact@mcportal.dev)' } }),
    ],
  }),

  /* --------------------------------------------------------------- internas */
  defineMcp({
    slug: 'facturas-panel',
    name: 'Panel de facturas',
    site: 'facturas.acme-internal.example',
    description: 'Panel interno de facturas de proveedor: búsqueda por estado, detalle, proveedores y descarga del PDF.',
    category: 'internas',
    tags: ['facturas', 'proveedores', 'erp', 'interno'],
    author: 'davidpargaa',
    verified: true,
    mode: 'read_write',
    version: '1.2.0',
    installs: 342,
    stars: 27,
    weekly: { base: 34, trend: 0.6, seed: 79 },
    updatedAt: '2026-10-22T08:35:00Z',
    exploration: { steps: 16, requests: 52, proposed: 6, durationSec: 176 },
    tools: [
      http('search_invoices', 'GET', '/api/facturas?q={query}&estado={status}', 'Busca facturas por texto y estado (pendiente, pagada, vencida).', {
        query: O(S('Número, proveedor o concepto.', 'ACME')),
        status: O(S('Estado de la factura.', 'pendiente', { enum: ['pendiente', 'pagada', 'vencida'] })),
      }),
      http('get_invoice', 'GET', '/api/facturas/{invoice_id}', 'Líneas, IVA, vencimiento y proveedor de una factura.', { invoice_id: Dep('id de la factura.', 'search_invoices', 'items[0].id') }),
      http('list_suppliers', 'GET', '/api/proveedores', 'Proveedores con CIF y forma de pago.', {}),
      http('invoice_totals', 'GET', '/api/facturas/resumen?desde={from}&hasta={to}', 'Totales por estado en un rango de fechas.', { from: D('Fecha inicial (YYYY-MM-DD).'), to: D('Fecha final (YYYY-MM-DD).') }),
      http('download_invoice_pdf', 'GET', '/api/facturas/{invoice_id}/pdf', 'Descarga el PDF de una factura.', { invoice_id: Dep('id de la factura.', 'search_invoices', 'items[0].id') }),
    ],
  }),

  defineMcp({
    slug: 'vacaciones-intranet',
    name: 'Intranet de vacaciones',
    site: 'rrhh.acme-internal.example',
    description: 'Intranet de RRHH: consulta de días disponibles, solicitud de vacaciones con CSRF y calendario del equipo.',
    category: 'internas',
    tags: ['rrhh', 'vacaciones', 'csrf', 'interno'],
    author: 'davidpargaa',
    verified: true,
    mode: 'read_write',
    version: '0.9.0',
    installs: 208,
    stars: 18,
    weekly: { base: 22, trend: 0.4, seed: 83 },
    updatedAt: '2026-10-19T12:15:00Z',
    tools: [
      browser('check_balance', '/vacaciones', [{ action: 'wait', value: '300' }], 'Días de vacaciones disponibles y consumidos este año.', {}, { extract: 'main' }),
      browser('request_days', '/vacaciones/solicitar', [
        { action: 'fill', selector: 'input[name=desde]', value: '{from}' },
        { action: 'fill', selector: 'input[name=hasta]', value: '{to}' },
        { action: 'fill', selector: 'textarea[name=motivo]', value: '{reason}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Solicita vacaciones en un rango de fechas y devuelve el número de solicitud.', {
        from: D('Primer día (YYYY-MM-DD).'),
        to: D('Último día (YYYY-MM-DD).'),
        reason: O(S('Motivo o comentario.')),
      }, { extract: 'main' }),
      browser('list_requests', '/vacaciones/solicitudes', [{ action: 'wait', value: '300' }], 'Solicitudes propias con su estado.', {}, { extract: 'table' }),
      browser('team_calendar', '/equipo/calendario', [{ action: 'select', selector: 'select[name=mes]', value: '{month}' }], 'Vacaciones del equipo en un mes.', { month: S('Mes en formato YYYY-MM.', '2026-11') }, { extract: 'main' }),
    ],
  }),

  defineMcp({
    slug: 'crm-antiguo',
    name: 'CRM antiguo',
    site: 'crm.acme-internal.example',
    description: 'CRM heredado sin API: contactos, oportunidades y notas. Todo pasa por formularios clásicos con sesión.',
    category: 'internas',
    tags: ['crm', 'contactos', 'oportunidades', 'interno'],
    author: 'davidpargaa',
    mode: 'read_write',
    version: '0.4.0',
    installs: 0,
    stars: 0,
    weekly: { base: 0, trend: 0, seed: 89 },
    status: 'draft',
    updatedAt: '2026-10-21T18:45:00Z',
    exploration: { steps: 15, requests: 31, proposed: 5, durationSec: 149 },
    tools: [
      browser('search_contacts', '/contactos', [
        { action: 'fill', selector: 'input[name=q]', value: '{query}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Busca contactos por nombre, empresa o email.', { query: S('Texto libre.', 'acme') }, { extract: 'table' }),
      http('get_contact', 'GET', '/contactos/{contact_id}', 'Ficha de un contacto con teléfono y empresa.', { contact_id: Dep('id del contacto.', 'search_contacts', 'results[0].id') }),
      browser('list_deals', '/oportunidades', [{ action: 'select', selector: 'select[name=estado]', value: '{status}' }], 'Oportunidades abiertas por estado.', { status: O(S('Estado de la oportunidad.', 'abierta')) }, { extract: 'table' }),
      http('add_note', 'POST', '/contactos/{contact_id}/notas', 'Añade una nota a un contacto.', { contact_id: Dep('id del contacto.', 'search_contacts', 'results[0].id'), note: S('Texto de la nota.', 'Llamada el 21/10: pide propuesta.') }, {
        body: { nota: '{note}' },
        bodyType: 'form',
      }),
      browser('export_contacts', '/contactos/exportar', [{ action: 'click', selector: 'button[data-accion="csv"]' }], 'Exporta todos los contactos a CSV.', {}, { failure: '403: requiere rol de administrador' }),
    ],
  }),

  /* ----------------------------------------------------------------- viajes */
  defineMcp({
    slug: 'vuelos-canarias',
    name: 'Vuelos a Canarias',
    site: 'vuelos.islascanarias.example',
    description: 'Buscador de vuelos a las islas: tarifas por fecha, equipaje incluido y aeropuertos de origen.',
    category: 'viajes',
    tags: ['vuelos', 'tarifas', 'islas'],
    author: 'sofia',
    verified: true,
    version: '0.7.0',
    installs: 1310,
    stars: 88,
    weekly: { base: 100, trend: 0.9, seed: 97 },
    updatedAt: '2026-10-18T09:25:00Z',
    tools: [
      browser('search_flights', '/buscar', [
        { action: 'select', selector: 'select[name=origen]', value: '{origin}' },
        { action: 'select', selector: 'select[name=destino]', value: '{destination}' },
        { action: 'fill', selector: 'input[name=fecha]', value: '{date}' },
        { action: 'fill', selector: 'input[name=pasajeros]', value: '{passengers}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Vuelos disponibles con precio y equipaje incluido.', {
        origin: S('Aeropuerto de origen.', 'MAD'),
        destination: S('Aeropuerto de destino.', 'TFS'),
        date: D('Fecha del vuelo (YYYY-MM-DD).'),
        passengers: I('Número de pasajeros.', { example: 1 }),
      }, { extract: 'main' }),
      http('get_fare', 'GET', '/vuelo/{fare_id}', 'Condiciones de una tarifa: equipaje, cambios y cancelación.', { fare_id: Dep('id de la tarifa.', 'search_flights', 'fares[0].id') }),
      browser('list_airports', '/aeropuertos', [{ action: 'wait', value: '300' }], 'Aeropuertos de origen y destino con su código IATA.', {}, { extract: 'table' }),
    ],
  }),

  /* ------------------------------------------------------- sede electrónica */
  defineMcp({
    slug: 'sede-administracion',
    name: 'Sede electrónica',
    site: 'sede.administracion.example',
    description: 'Trámites de la sede electrónica: búsqueda de procedimientos, requisitos, oficinas y cita previa.',
    category: 'administracion',
    tags: ['trámites', 'cita previa', 'sede'],
    author: 'nadia',
    verified: true,
    mode: 'read_write',
    version: '1.3.0',
    installs: 2450,
    stars: 134,
    weekly: { base: 180, trend: 0.35, seed: 101 },
    updatedAt: '2026-10-17T10:40:00Z',
    tools: [
      http('search_procedures', 'GET', '/api/tramites?q={query}', 'Busca trámites por texto y devuelve su id.', { query: S('Nombre del trámite.', 'certificado de residencia') }),
      http('get_procedure', 'GET', '/api/tramites/{procedure_id}', 'Requisitos, tasas y documentación de un trámite.', { procedure_id: Dep('id del trámite.', 'search_procedures', 'results[0].id') }),
      http('list_offices', 'GET', '/api/oficinas?provincia={province}', 'Oficinas de atención con dirección y horario.', { province: O(S('Provincia.', 'Madrid')) }),
      browser('book_appointment', '/cita', [
        { action: 'select', selector: 'select[name=tramite]', value: '{procedure_id}' },
        { action: 'select', selector: 'select[name=oficina]', value: '{office_id}' },
        { action: 'fill', selector: 'input[name=fecha]', value: '{date}' },
        { action: 'click', selector: 'button[type=submit]' },
      ], 'Pide cita previa y devuelve el justificante.', {
        procedure_id: Dep('id del trámite.', 'search_procedures', 'results[0].id'),
        office_id: Dep('id de la oficina.', 'list_offices', 'offices[0].id'),
        date: D('Día preferido (YYYY-MM-DD).'),
      }, { extract: 'main' }),
    ],
  }),

  /* ------------------------------------------- variantes de la comunidad */
  defineMcp({
    slug: 'openlibrary-lite',
    name: 'Open Library Lite',
    site: 'openlibrary.org',
    description:
      'Primera implementación de Open Library, reducida a búsqueda y ficha de obra. No se actualiza desde marzo y la web ya cambió dos formularios.',
    category: 'libros',
    tags: ['libros', 'minimalista', 'comunidad'],
    author: 'pere',
    version: '0.9.2',
    installs: 184,
    stars: 12,
    weekly: { base: 6, trend: -0.5, seed: 73 },
    updatedAt: '2026-03-08T11:20:00Z',
    sourceUpdatedAt: '2026-10-20T08:30:00Z',
    status: 'published',
    visibility: 'public',
    exploration: { steps: 8, requests: 14, proposed: 3, durationSec: 64 },
    rating: { average: 2.9, count: 31, distribution: [3, 5, 7, 9, 7] },
    reports: [
      {
        id: 'rep-ol-lite-1',
        kind: 'outdated',
        detail: 'El buscador redirige a una página nueva y search_books devuelve vacío desde el cambio de la web.',
        author: 'Diego M.',
        createdAt: '2026-10-11T18:20:00Z',
        status: 'open',
      },
      {
        id: 'rep-ol-lite-2',
        kind: 'tool',
        detail: 'get_work falla cuando la obra no tiene portada; el error no se captura.',
        author: 'Marta R.',
        createdAt: '2026-10-16T09:45:00Z',
        status: 'open',
      },
    ],
    tools: [
      http('search_books', 'GET', '/search.json?q={query}', 'Busca libros por título o autor.', { query: S('Título o autor.', 'dune') }),
      http('get_work', 'GET', '/works/{work_id}.json', 'Ficha básica de una obra.', { work_id: Dep('Clave de la obra.', 'search_books', 'docs[0].key') }),
    ],
  }),

  defineMcp({
    slug: 'openlibrary-labs',
    name: 'Open Library Labs',
    site: 'openlibrary.org',
    description:
      'Implementación comunitaria de Open Library centrada en búsqueda avanzada, ISBN y listas de lectura. Más reciente que la versión oficial.',
    category: 'libros',
    tags: ['libros', 'isbn', 'búsqueda avanzada', 'comunidad'],
    author: 'nadia',
    version: '2.0.0',
    installs: 486,
    stars: 41,
    weekly: { base: 62, trend: 1.7, seed: 71 },
    updatedAt: '2026-10-21T21:10:00Z',
    sourceUpdatedAt: '2026-10-21T12:00:00Z',
    exploration: { steps: 22, requests: 84, proposed: 11, durationSec: 232 },
    rating: { average: 4.3, count: 48, distribution: [24, 15, 6, 2, 1] },
    tools: [
      http('search_books', 'GET', '/search.json?q={query}&mode=everything', 'Búsqueda amplia por título, autor, ISBN o materia.', {
        query: S('Texto libre.', 'asimov'),
        page: O(I('Página de resultados.', { default: 1 })),
      }),
      http('search_by_isbn', 'GET', '/isbn/{isbn}.json', 'Ficha de una edición a partir de su ISBN.', { isbn: S('ISBN de la edición.', '9780553293357') }),
      http('get_work', 'GET', '/works/{work_id}.json', 'Detalle de una obra con temas, portada y descripción.', { work_id: Dep('Clave de la obra.', 'search_books', 'docs[0].key') }),
      http('list_editions', 'GET', '/works/{work_id}/editions.json', 'Ediciones disponibles con editorial e ISBN.', { work_id: Dep('Clave de la obra.', 'search_books', 'docs[0].key') }),
      http('search_authors', 'GET', '/search/authors.json?q={name}', 'Busca autores por nombre y devuelve su author_id.', { name: S('Nombre del autor.', 'Isaac Asimov') }),
      http('get_author_works', 'GET', '/authors/{author_id}/works.json', 'Obras de un autor. Requiere author_id de search_authors.', {
        author_id: Dep('Clave del autor.', 'search_authors', 'docs[0].key'),
      }),
      http('browse_subject', 'GET', '/subjects/{subject}.json?limit={limit}', 'Obras de una materia con paginación.', {
        subject: S('Materia.', 'science_fiction'),
        limit: O(I('Máximo de obras.', { default: 20 })),
      }),
      http('recent_editions', 'GET', '/recentchanges.json?limit={limit}', 'Últimas ediciones añadidas al catálogo.', { limit: O(I('Cuántas ediciones.', { default: 10 })) }),
    ],
  }),

  defineMcp({
    slug: 'la-tasca-reservas-rapidas',
    name: 'La Tasca · reservas rápidas',
    site: 'reservas.latascalavapies.es',
    icon: '/favicons/reservas.latascalavapies.es.svg',
    description:
      'Alternativa centrada solo en disponibilidad y reserva, sin carta ni cancelación. Acumula un informe abierto por errores en el selector de horas.',
    category: 'reservas',
    tags: ['restaurante', 'mesas', 'comunidad'],
    author: 'marcos',
    mode: 'read_write',
    version: '0.8.0',
    installs: 312,
    stars: 19,
    weekly: { base: 18, trend: -0.2, seed: 83 },
    updatedAt: '2026-08-22T10:05:00Z',
    sourceUpdatedAt: '2026-10-16T18:40:00Z',
    exploration: { steps: 12, requests: 15, proposed: 4, durationSec: 118 },
    rating: { average: 3.7, count: 26, distribution: [8, 7, 6, 3, 2] },
    reports: [
      {
        id: 'rep-lt-rapida-1',
        kind: 'tool',
        detail: 'Al reservar para más de cuatro personas el selector de horas viene vacío y el paso click falla.',
        author: 'Nadia B.',
        createdAt: '2026-10-13T13:10:00Z',
        status: 'open',
      },
    ],
    tools: [
      browser(
        'check_availability',
        '/reservar',
        [
          { action: 'fill', selector: 'input[name=date]', value: '{date}' },
          { action: 'fill', selector: 'input[name=people]', value: '{people}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Horarios libres para una fecha y número de comensales.',
        { date: D('Día (YYYY-MM-DD).'), people: I('Comensales.', { example: 2 }) },
        { extract: '.slots' },
      ),
      browser(
        'book_table',
        '/reservar',
        [
          { action: 'fill', selector: 'input[name=date]', value: '{date}' },
          { action: 'select', selector: 'select[name=time]', value: '{time}' },
          { action: 'fill', selector: 'input[name=people]', value: '{people}' },
          { action: 'fill', selector: 'input[name=name]', value: '{name}' },
          { action: 'fill', selector: 'input[name=phone]', value: '{phone}' },
          { action: 'click', selector: 'button[type=submit]' },
        ],
        'Reserva una mesa y devuelve el código de reserva.',
        {
          date: D('Día (YYYY-MM-DD).'),
          time: S('Hora.', '21:00', { enum: ['13:00', '13:30', '14:00', '20:00', '20:30', '21:00', '21:30', '22:00'] }),
          people: I('Comensales.', { example: 2 }),
          name: S('Nombre de la reserva.', 'Ada Lovelace'),
          phone: S('Teléfono.', '600123456'),
        },
        { extract: 'main' },
      ),
    ],
  }),

  defineMcp({
    slug: 'tienda-demo-checkout',
    name: 'Librería Zeta · checkout',
    site: 'localhost:8001',
    scheme: 'http',
    description:
      'Variante comunitaria de la tienda demo con un checkout más tolerante a errores, carrito reutilizable y limpieza de líneas agotadas.',
    category: 'comercio',
    tags: ['carrito', 'checkout', 'comunidad', 'reintentos'],
    author: 'lucia',
    mode: 'read_write',
    version: '1.0.0',
    installs: 632,
    stars: 48,
    weekly: { base: 88, trend: 1.4, seed: 79 },
    updatedAt: '2026-10-18T14:25:00Z',
    sourceUpdatedAt: '2026-10-22T09:15:00Z',
    exploration: { steps: 18, requests: 47, proposed: 9, durationSec: 144 },
    rating: { average: 4.5, count: 89, distribution: [57, 21, 7, 3, 1] },
    tools: [
      http('search_products', 'GET', '/api/search?q={query}', 'Busca libros por título o autor.', { query: S('Texto libre.', 'asimov') }),
      http('create_cart', 'POST', '/api/cart', 'Crea un carrito reutilizable y devuelve cart_id.', {}),
      http(
        'add_to_cart',
        'POST',
        '/api/cart/{cart_id}/items',
        'Añade un libro al carrito. Requiere cart_id de create_cart.',
        {
          cart_id: Dep('Carrito.', 'create_cart', 'cart_id'),
          product_id: Dep('Libro.', 'search_products', 'results[0].id'),
          qty: O(I('Unidades.', { default: 1, example: 1 })),
        },
        jsonBody({ product_id: '{product_id}', qty: '{qty}' }),
      ),
      http(
        'remove_from_cart',
        'DELETE',
        '/api/cart/{cart_id}/items/{product_id}',
        'Quita una línea del carrito antes del checkout.',
        { cart_id: Dep('Carrito.', 'create_cart', 'cart_id'), product_id: Dep('Libro.', 'search_products', 'results[0].id') },
      ),
      http(
        'checkout',
        'POST',
        '/api/cart/{cart_id}/checkout',
        'Confirma el pedido con reintentos y devuelve order_id.',
        { cart_id: Dep('Carrito.', 'create_cart', 'cart_id'), name: S('Cliente.', 'Ada Lovelace'), email: S('Correo.', 'ada@example.com') },
        jsonBody({ name: '{name}', email: '{email}' }),
      ),
    ],
  }),

];

/** MCPs visibles en el catálogo público. */
export const PUBLIC_MCPS = SEED_MCPS.filter((m) => m.status === 'published' && m.visibility === 'public');

export { CURRENT_USER_HANDLE } from './people';

/** Serie semanal reutilizable por la generación simulada. */
export { weeklySeries };
