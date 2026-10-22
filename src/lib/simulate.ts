/**
 * Generación simulada. Aquí se conectará el core real (explorador → sintetizador
 * → validador). De momento produce una traza y un borrador creíbles según la URL.
 */
import type { CategoryId, Mcp, Param, Tool } from '../data/types';
import { slugify } from './format';

export type Phase = 'explore' | 'synth' | 'validate';

export interface TraceEvent {
  phase: Phase;
  type: 'obs' | 'act' | 'req' | 'tool' | 'pass' | 'fail' | 'info';
  text: string;
  meta?: string;
  /** Página visible en el navegador simulado */
  path?: string;
}

interface Template {
  category: CategoryId;
  description: (host: string) => string;
  tags: string[];
  tools: Tool[];
  pages: { path: string; obs: string[] }[];
  acts: { text: string; path: string; reqs: [string, string][] }[];
}

const p = (name: string, type: Param['type'] = 'string', required = true): Param => ({ name, type, required });

const TEMPLATES: Record<'shop' | 'booking' | 'books' | 'generic', Template> = {
  shop: {
    category: 'comercio',
    description: (h) => `Búsqueda de productos, carrito y checkout en ${h}.`,
    tags: ['tienda', 'carrito', 'checkout'],
    pages: [
      { path: '/', obs: ['[3] input "Buscar productos"', '[4] button "Buscar"', '[7] link "Novedades"', '[12] button "Añadir al carrito" (×20 similares)'] },
      { path: '/cart', obs: ['[2] input "Cantidad"', '[5] button "Finalizar compra"', '[6] link "Seguir comprando"'] },
    ],
    acts: [
      { text: 'fill [3] ← zxq_lampara + click [4]', path: '/', reqs: [['GET /api/search?q=zxq_lampara', '200']] },
      { text: 'click [12] "Añadir al carrito"', path: '/', reqs: [['POST /api/cart', '201'], ['POST /api/cart/c_8f2a/items', '200']] },
      { text: 'goto /cart', path: '/cart', reqs: [['GET /api/cart/c_8f2a', '200']] },
      { text: 'fill [2] ← zxq_3', path: '/cart', reqs: [['PUT /api/cart/c_8f2a/items/p_114', '200']] },
      { text: 'click [5] "Finalizar compra"', path: '/cart', reqs: [['POST /api/cart/c_8f2a/checkout', '200']] },
    ],
    tools: [
      { name: 'search_products', kind: 'http', method: 'GET', endpoint: '/api/search?q={query}', description: 'Busca productos por texto. Devuelve id, nombre, precio y stock.', params: [p('query')], validated: true },
      { name: 'create_cart', kind: 'http', method: 'POST', endpoint: '/api/cart', description: 'Crea un carrito vacío y devuelve cart_id.', params: [], validated: true },
      { name: 'add_to_cart', kind: 'http', method: 'POST', endpoint: '/api/cart/{cart_id}/items', description: 'Añade un producto al carrito. Requiere cart_id de create_cart.', params: [p('cart_id'), p('product_id'), p('qty', 'integer')], dependsOn: 'create_cart', validated: true },
      { name: 'update_quantity', kind: 'http', method: 'PUT', endpoint: '/api/cart/{cart_id}/items/{product_id}', description: 'Cambia la cantidad de un producto del carrito.', params: [p('cart_id'), p('product_id'), p('qty', 'integer')], dependsOn: 'create_cart', validated: true },
      { name: 'checkout', kind: 'http', method: 'POST', endpoint: '/api/cart/{cart_id}/checkout', description: 'Confirma el pedido y devuelve el número de pedido.', params: [p('cart_id'), p('email')], dependsOn: 'create_cart', validated: true },
      { name: 'list_new_arrivals', kind: 'browser', steps: ['goto /novedades', 'extract .grid'], description: 'Productos marcados como novedad.', params: [], validated: false, failure: 'La página devolvió 0 elementos' },
    ],
  },
  booking: {
    category: 'reservas',
    description: (h) => `Disponibilidad y reservas en ${h}, mediante los formularios de la propia web.`,
    tags: ['reservas', 'formularios'],
    pages: [
      { path: '/reservar', obs: ['[2] input "Fecha" (date)', '[3] input "Personas"', '[4] select "Hora"', '[6] button "Ver disponibilidad"', 'input[hidden] csrf_token'] },
      { path: '/reservar/confirmar', obs: ['[2] input "Nombre"', '[3] input "Teléfono"', '[5] button "Confirmar reserva"'] },
    ],
    acts: [
      { text: 'fill [2] ← 2026-10-24 · fill [3] ← zxq_4', path: '/reservar', reqs: [] },
      { text: 'click [6] "Ver disponibilidad"', path: '/reservar', reqs: [['POST /reservar (form · csrf)', '200']] },
      { text: 'csrf_token cambia en cada carga → usar navegador', path: '/reservar', reqs: [] },
      { text: 'fill [2] ← zxq_ana · fill [3] ← zxq_600', path: '/reservar/confirmar', reqs: [] },
      { text: 'click [5] "Confirmar reserva"', path: '/reservar/confirmar', reqs: [['POST /reservar/confirmar (form · csrf)', '302']] },
    ],
    tools: [
      { name: 'check_availability', kind: 'browser', steps: ['goto /reservar', 'fill input[name=date] ← {date}', 'fill input[name=people] ← {people}', 'click button "Ver disponibilidad"', 'extract .slots'], description: 'Horarios libres para una fecha y número de personas.', params: [p('date', 'date'), p('people', 'integer')], validated: true },
      { name: 'make_booking', kind: 'browser', steps: ['goto /reservar', 'fill input[name=date] ← {date}', 'select select[name=time] ← {time}', 'fill input[name=people] ← {people}', 'click button "Ver disponibilidad"', 'fill input[name=name] ← {name}', 'fill input[name=phone] ← {phone}', 'click button "Confirmar reserva"', 'extract main'], description: 'Hace una reserva y devuelve el código de confirmación.', params: [p('date', 'date'), p('time'), p('people', 'integer'), p('name'), p('phone')], validated: true },
      { name: 'cancel_booking', kind: 'browser', steps: ['goto /cancelar', 'fill input[name=code] ← {code}', 'click button "Cancelar"'], description: 'Cancela una reserva con su código.', params: [p('code')], dependsOn: 'make_booking', validated: false, failure: 'El código de ejemplo no existía (404)' },
      { name: 'opening_hours', kind: 'browser', steps: ['goto /', 'extract footer .horario'], description: 'Horario de apertura publicado en la web.', params: [], validated: true },
    ],
  },
  books: {
    category: 'libros',
    description: (h) => `Búsqueda en el catálogo de ${h} y ficha de cada título.`,
    tags: ['libros', 'catálogo'],
    pages: [
      { path: '/', obs: ['[3] input "Título, autor o ISBN"', '[4] button "Buscar"', '[9] link "Ciencia ficción"', '[14] link (×24 similares)'] },
      { path: '/libro/{id}', obs: ['[2] link "Autor"', '[5] select "Edición"', '[7] link "Más del autor"'] },
    ],
    acts: [
      { text: 'fill [3] ← zxq_asimov + click [4]', path: '/', reqs: [['GET /api/buscar?q=zxq_asimov', '200']] },
      { text: 'click [14] primer resultado', path: '/libro/{id}', reqs: [['GET /api/libros/8841', '200']] },
      { text: 'click [2] "Autor"', path: '/libro/{id}', reqs: [['GET /api/autores/312/obras', '200']] },
      { text: 'click [9] "Ciencia ficción"', path: '/', reqs: [['GET /api/materias/ciencia-ficcion', '200']] },
    ],
    tools: [
      { name: 'search_books', kind: 'http', method: 'GET', endpoint: '/api/buscar?q={query}', description: 'Busca por título, autor o ISBN.', params: [p('query')], validated: true },
      { name: 'get_book', kind: 'http', method: 'GET', endpoint: '/api/libros/{book_id}', description: 'Ficha de un libro con ediciones y precio.', params: [p('book_id')], validated: true },
      { name: 'author_works', kind: 'http', method: 'GET', endpoint: '/api/autores/{author_id}/obras', description: 'Obras de un autor. Requiere author_id de get_book.', params: [p('author_id')], dependsOn: 'get_book', validated: true },
      { name: 'browse_subject', kind: 'http', method: 'GET', endpoint: '/api/materias/{subject}', description: 'Títulos de una materia.', params: [p('subject'), p('page', 'integer', false)], validated: true },
      { name: 'reserve_copy', kind: 'browser', steps: ['goto /libro/{book_id}', 'click button "Reservar"'], description: 'Reserva un ejemplar.', params: [p('book_id')], validated: false, failure: 'Redirige a /login' },
    ],
  },
  generic: {
    category: 'datos',
    description: (h) => `Búsqueda y consulta de contenidos de ${h}.`,
    tags: ['búsqueda'],
    pages: [
      { path: '/', obs: ['[2] input "Buscar"', '[3] button (icono lupa)', '[6] link "Secciones"', '[11] link (×18 similares)', '[20] form "Contacto"'] },
      { path: '/seccion/{id}', obs: ['[4] select "Ordenar por"', '[8] link "Siguiente"'] },
    ],
    acts: [
      { text: 'fill [2] ← zxq_prueba + click [3]', path: '/', reqs: [['GET /buscar?q=zxq_prueba', '200']] },
      { text: 'click [6] "Secciones"', path: '/seccion/{id}', reqs: [['GET /api/secciones', '200']] },
      { text: 'select [4] ← "fecha"', path: '/seccion/{id}', reqs: [['GET /api/secciones/12?orden=fecha', '200']] },
      { text: 'fill [20] ← zxq_hola + submit', path: '/', reqs: [['POST /contacto (form)', '403']] },
    ],
    tools: [
      { name: 'search_site', kind: 'http', method: 'GET', endpoint: '/buscar?q={query}', description: 'Busca contenido en toda la web.', params: [p('query')], validated: true },
      { name: 'list_sections', kind: 'http', method: 'GET', endpoint: '/api/secciones', description: 'Secciones principales con su id.', params: [], validated: true },
      { name: 'get_section', kind: 'http', method: 'GET', endpoint: '/api/secciones/{section_id}?orden={order}', description: 'Contenidos de una sección, con orden opcional.', params: [p('section_id'), p('order', 'string', false)], dependsOn: 'list_sections', validated: true },
      { name: 'read_page', kind: 'browser', steps: ['goto {path}', 'extract main'], description: 'Texto principal de una página de la web.', params: [p('path')], validated: true },
      { name: 'send_contact_form', kind: 'browser', steps: ['goto /', 'fill form#contacto textarea ← {message}', 'click button "Enviar"'], description: 'Envía el formulario de contacto.', params: [p('message')], validated: false, failure: '403: el formulario tiene captcha' },
    ],
  },
};

function pickTemplate(host: string): keyof typeof TEMPLATES {
  if (/shop|tienda|store|market|compra/.test(host)) return 'shop';
  if (/reserv|restaur|mesa|padel|club|booking|cita/.test(host)) return 'booking';
  if (/libr|book|biblio|lectura/.test(host)) return 'books';
  return 'generic';
}

const FAVICON_COLORS = ['#B5462B', '#1E8C5A', '#2D63C8', '#7A1730', '#0E5AA7', '#C27C0E', '#5A45D4', '#12705A', '#D7192D'];

/** Favicon "capturado" por el explorador: inicial sobre un color estable para cada dominio. */
export function faviconFor(host: string): string {
  const hash = [...host].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const color = FAVICON_COLORS[hash % FAVICON_COLORS.length];
  const parts = host.split('.');
  const letter = (parts.length > 2 ? parts[parts.length - 2] : parts[0]).charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function normalizeUrl(raw: string): { ok: true; url: URL } | { ok: false; error: string } {
  const value = raw.trim();
  if (!value) return { ok: false, error: 'Escribe la dirección de la web.' };
  try {
    const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
    if (!/\.[a-z]{2,}$/i.test(url.hostname) && url.hostname !== 'localhost') {
      return { ok: false, error: 'No parece un dominio válido. Ejemplo: openlibrary.org' };
    }
    return { ok: true, url };
  } catch {
    return { ok: false, error: 'No parece una URL válida. Ejemplo: https://openlibrary.org' };
  }
}

export function generate(url: URL, hint: string): { draft: Mcp; trace: TraceEvent[] } {
  const host = url.hostname.replace(/^www\./, '');
  const key = pickTemplate(`${host} ${hint.toLowerCase()}`);
  const t = TEMPLATES[key];
  const parts = host.split('.');
  const slug = slugify(parts.length > 2 ? parts[parts.length - 2] : parts[0]);

  const trace: TraceEvent[] = [{ phase: 'explore', type: 'info', text: `Chromium abierto · ${url.origin}`, path: t.pages[0].path }];
  t.pages[0].obs.forEach((o) => trace.push({ phase: 'explore', type: 'obs', text: o, path: t.pages[0].path }));
  t.acts.forEach((a, i) => {
    if (i === 2 && t.pages[1]) t.pages[1].obs.forEach((o) => trace.push({ phase: 'explore', type: 'obs', text: o, path: t.pages[1].path }));
    trace.push({ phase: 'explore', type: 'act', text: a.text, path: a.path });
    a.reqs.forEach(([r, s]) => trace.push({ phase: 'explore', type: 'req', text: r, meta: s, path: a.path }));
  });
  trace.push({ phase: 'synth', type: 'info', text: 'Emparejando centinelas con parámetros' });
  trace.push({ phase: 'synth', type: 'info', text: 'Resolviendo dependencias entre peticiones' });
  t.tools.forEach((tool) => trace.push({ phase: 'synth', type: 'tool', text: tool.name, meta: tool.kind }));
  t.tools.forEach((tool) =>
    trace.push({
      phase: 'validate',
      type: tool.validated ? 'pass' : 'fail',
      text: tool.name,
      meta: tool.validated ? '2xx' : tool.failure,
    }),
  );

  const requests = t.acts.reduce((n, a) => n + a.reqs.length, 0) * 3 + 4;
  const draft: Mcp = {
    id: `m-${Date.now().toString(36)}`,
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' '),
    site: host,
    icon: faviconFor(host),
    description: t.description(host),
    category: t.category,
    tags: [...t.tags],
    author: '',
    tools: t.tools.map((x) => ({ ...x, params: x.params.map((pp) => ({ ...pp })) })),
    installs: 0,
    weeklyInstalls: [],
    version: '0.1.0',
    license: 'MIT',
    updatedAt: new Date().toISOString(),
    status: 'draft',
    visibility: 'public',
    exploration: { steps: t.acts.length * 3 + 2, requests, proposed: t.tools.length, durationSec: 60 + requests * 3 },
  };
  return { draft, trace };
}
