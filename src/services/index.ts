import { mockService } from './mock';
import { registryService } from './registry';
import type { DataSource, ReadService } from './types';

export type { DataSource, ReadService } from './types';

/**
 * `NEXT_PUBLIC_DATA_SOURCE=mock|registry` elige la implementación sin tocar
 * pantallas (§8 y §9 del master prompt).
 */
export function dataSource(): DataSource {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === 'registry' ? 'registry' : 'mock';
}

let current: ReadService | null = null;

export function getReadService(): ReadService {
  if (!current) current = dataSource() === 'registry' ? registryService : mockService;
  return current;
}

export const services = {
  listMcps: (...args: Parameters<ReadService['listMcps']>) => getReadService().listMcps(...args),
  getMcp: (slug: string) => getReadService().getMcp(slug),
  getManifest: (slug: string) => getReadService().getManifest(slug),
  getRelated: (slug: string, limit?: number) => getReadService().getRelated(slug, limit),
  getUser: (handle: string) => getReadService().getUser(handle),
  getCurrentUser: () => getReadService().getCurrentUser(),
};
