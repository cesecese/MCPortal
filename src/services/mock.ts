import type { Manifest } from '../types/contract';
import type { Author, Mcp, McpFilters, McpOrder, McpPage } from '../types/portal';
import { AUTHORS } from '../data/authors';
import { CURRENT_USER_HANDLE, PUBLIC_MCPS, SEED_MCPS } from '../data/mcps';
import { implMix } from '../lib/format';
import { matchesMcp } from './search';
import type { ReadService } from './types';

const PAGE_SIZE = 12;

const bySlug = new Map(SEED_MCPS.map((mcp) => [mcp.slug, mcp]));

function applyFilters(mcps: Mcp[], filters: McpFilters = {}): Mcp[] {
  return mcps.filter((mcp) => {
    if (filters.q && !matchesMcp(mcp, filters.q)) return false;
    if (filters.category && mcp.category !== filters.category) return false;
    if (filters.mode && mcp.mode !== filters.mode) return false;
    if (filters.verified && !mcp.verified) return false;
    if (filters.impl) {
      const kind = implMix(mcp.tools.filter((t) => t.validated));
      if (filters.impl !== kind) return false;
    }
    return true;
  });
}

function sortMcps(mcps: Mcp[], order: McpOrder = 'popular'): Mcp[] {
  const copy = [...mcps];
  if (order === 'recent') return copy.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (order === 'validated') {
    return copy.sort((a, b) => {
      const av = a.validation.proposed ? a.validation.validated / a.validation.proposed : 0;
      const bv = b.validation.proposed ? b.validation.validated / b.validation.proposed : 0;
      return bv - av || b.installs - a.installs;
    });
  }
  return copy.sort((a, b) => b.installs - a.installs);
}

/** Implementación con los datos de ejemplo: sin red, válida en servidor. */
export const mockService: ReadService = {
  source: 'mock',

  async listMcps(filters = {}, order = 'popular', page = 1): Promise<McpPage> {
    const items = sortMcps(applyFilters(PUBLIC_MCPS, filters), order);
    const start = (Math.max(1, page) - 1) * PAGE_SIZE;
    return {
      items: items.slice(start, start + PAGE_SIZE),
      total: items.length,
      page: Math.max(1, page),
      pageSize: PAGE_SIZE,
    };
  },

  async getMcp(slug: string): Promise<Mcp | null> {
    return bySlug.get(slug) ?? null;
  },

  async getManifest(slug: string): Promise<Manifest | null> {
    return bySlug.get(slug)?.manifest ?? null;
  },

  async getRelated(slug: string, limit = 3): Promise<Mcp[]> {
    const mcp = bySlug.get(slug);
    if (!mcp) return [];
    const others = PUBLIC_MCPS.filter((m) => m.slug !== slug);
    const same = others.filter((m) => m.category === mcp.category).sort((a, b) => b.installs - a.installs);
    const rest = others.filter((m) => m.category !== mcp.category).sort((a, b) => b.installs - a.installs);
    return [...same, ...rest].slice(0, limit);
  },

  async getUser(handle: string): Promise<Author | null> {
    return AUTHORS[handle] ?? null;
  },

  async getCurrentUser(): Promise<Author> {
    return AUTHORS[CURRENT_USER_HANDLE];
  },
};
