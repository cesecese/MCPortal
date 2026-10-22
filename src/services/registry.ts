import type { Manifest } from '../types/contract';
import type { Author, Mcp, McpFilters, McpOrder, McpPage } from '../types/portal';
import { mockService } from './mock';
import type { ReadService } from './types';

const BASE = (process.env.NEXT_PUBLIC_REGISTRY_URL ?? 'http://localhost:8010').replace(/\/$/, '');
const TIMEOUT_MS = 4000;

let warned = false;
function fallback<T>(reason: unknown, alternate: () => Promise<T>): Promise<T> {
  if (!warned) {
    warned = true;
    console.warn('[mcportal] registro no disponible, se usan los datos de ejemplo:', reason);
  }
  return alternate();
}

async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function isMcp(value: unknown): value is Mcp {
  const v = value as Partial<Mcp> | null;
  return Boolean(v && typeof v.slug === 'string' && Array.isArray(v.tools) && v.manifest);
}

function normalizePage(raw: unknown, page: number): McpPage {
  const data = raw as { items?: unknown[]; total?: number; page?: number; pageSize?: number } | unknown[];
  const list = Array.isArray(data) ? data : (data?.items ?? []);
  const items = list.filter(isMcp);
  return {
    items,
    total: Array.isArray(data) ? items.length : (data?.total ?? items.length),
    page: Array.isArray(data) ? page : (data?.page ?? page),
    pageSize: Array.isArray(data) ? items.length : (data?.pageSize ?? items.length),
  };
}

/**
 * Implementación de la fase 3 contra el registro FastAPI (puerto 8010).
 * Se activa con `NEXT_PUBLIC_DATA_SOURCE=registry`. Si el registro no responde,
 * el portal sigue funcionando con los datos de ejemplo.
 */
export const registryService: ReadService = {
  source: 'registry',

  async listMcps(filters: McpFilters = {}, order: McpOrder = 'popular', page = 1): Promise<McpPage> {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.impl) params.set('impl', filters.impl);
    if (filters.mode) params.set('mode', filters.mode);
    if (filters.verified) params.set('verified', '1');
    params.set('order', order);
    params.set('page', String(page));
    try {
      return normalizePage(await getJson(`/mcps?${params.toString()}`), page);
    } catch (error) {
      return fallback(error, () => mockService.listMcps(filters, order, page));
    }
  },

  async getMcp(slug: string): Promise<Mcp | null> {
    try {
      const raw = await getJson(`/mcps/${encodeURIComponent(slug)}`);
      return isMcp(raw) ? raw : null;
    } catch (error) {
      return fallback(error, () => mockService.getMcp(slug));
    }
  },

  async getManifest(slug: string): Promise<Manifest | null> {
    try {
      const raw = (await getJson(`/mcps/${encodeURIComponent(slug)}/manifest`)) as Manifest;
      return Array.isArray(raw?.tools) ? raw : null;
    } catch (error) {
      return fallback(error, () => mockService.getManifest(slug));
    }
  },

  async getRelated(slug: string, limit = 3): Promise<Mcp[]> {
    try {
      const mcp = await registryService.getMcp(slug);
      if (!mcp) return [];
      const page = await registryService.listMcps({ category: mcp.category }, 'popular', 1);
      const items = page.items.filter((m) => m.slug !== slug).slice(0, limit);
      if (items.length >= limit) return items;
      const rest = (await registryService.listMcps({}, 'popular', 1)).items.filter(
        (m) => m.slug !== slug && !items.some((i) => i.slug === m.slug),
      );
      return [...items, ...rest].slice(0, limit);
    } catch (error) {
      return fallback(error, () => mockService.getRelated(slug, limit));
    }
  },

  async getUser(handle: string): Promise<Author | null> {
    try {
      return (await getJson(`/u/${encodeURIComponent(handle)}`)) as Author;
    } catch {
      return mockService.getUser(handle);
    }
  },

  async getCurrentUser(): Promise<Author> {
    try {
      return (await getJson('/me')) as Author;
    } catch {
      return mockService.getCurrentUser();
    }
  },
};
