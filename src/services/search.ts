import type { Mcp } from '../types/portal';
import { categoryOf } from '../data/categories';

export const fold = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/** Búsqueda del catálogo: nombre, sitio, descripción, categoría, etiquetas y herramientas. */
export function matchesMcp(mcp: Mcp, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  const hay = fold(
    [
      mcp.name,
      mcp.slug,
      mcp.site,
      mcp.description,
      categoryOf(mcp.category).label,
      ...mcp.tags,
      ...mcp.tools.flatMap((t) => [t.name, t.description]),
    ].join(' '),
  );
  return fold(q)
    .split(/\s+/)
    .every((word) => hay.includes(word));
}
