import type { Manifest } from '../types/contract';
import type { Author, Mcp, McpFilters, McpOrder, McpPage } from '../types/portal';

export type DataSource = 'mock' | 'registry';

/**
 * Lectura del catálogo. Debe funcionar en servidor y en cliente: no toca
 * `window` ni `localStorage`. Lo que crea el usuario se superpone en `state/`.
 */
export interface ReadService {
  readonly source: DataSource;
  listMcps(filters?: McpFilters, order?: McpOrder, page?: number): Promise<McpPage>;
  getMcp(slug: string): Promise<Mcp | null>;
  getManifest(slug: string): Promise<Manifest | null>;
  getRelated(slug: string, limit?: number): Promise<Mcp[]>;
  getUser(handle: string): Promise<Author | null>;
  getCurrentUser(): Promise<Author>;
}
