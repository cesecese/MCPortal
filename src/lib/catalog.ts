import type { Mcp, McpReport, McpVersion, RatingSummary, ValidationReport } from '../data/types';
import { NOW } from './format';

const DAY = 86_400_000;

/** Normaliza la URL de origen para agrupar todas las implementaciones de una web. */
export function siteKey(site: string): string {
  return site
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export function siteUrl(site: string): string {
  return /^https?:\/\//i.test(site) ? site : `https://${site}`;
}

export function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function distributionFrom(average: number, count: number): RatingSummary['distribution'] {
  const weights = [5, 4, 3, 2, 1].map((star) => Math.max(0.4, 5 - Math.abs(star - average) * 2.4));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const raw = weights.map((weight) => (weight / total) * count);
  const buckets = raw.map((value) => Math.floor(value)) as RatingSummary['distribution'];
  let remainder = count - buckets.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction);
  let cursor = 0;
  while (remainder > 0) {
    buckets[order[cursor % order.length].index] += 1;
    remainder -= 1;
    cursor += 1;
  }
  return buckets;
}

/** Valoración estable para los datos de ejemplo; los MCPs nuevos también reciben una. */
export function ratingOf(mcp: Mcp): RatingSummary {
  if (mcp.rating) return mcp.rating;
  const seed = hashString(mcp.slug);
  const average = Number((4 + (seed % 10) / 10).toFixed(1));
  const count = Math.max(6, Math.round(mcp.installs / 46 + (seed % 17)));
  return { average, count, distribution: distributionFrom(average, count) };
}

function parseVersion(version: string): [number, number, number] {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return [major, minor, patch];
}

/** Historial completo: datos explícitos o una cronología verosímil para los ejemplos. */
export function versionsOf(mcp: Mcp): McpVersion[] {
  if (mcp.versions?.length) {
    return [...mcp.versions].sort((a, b) => +new Date(b.publishedAt) - +new Date(a.publishedAt));
  }

  const [major, minor, patch] = parseVersion(mcp.version);
  const previous =
    patch > 0
      ? `${major}.${minor}.${patch - 1}`
      : minor > 0
        ? `${major}.${minor - 1}.0`
        : major > 0
          ? `${major - 1}.9.0`
          : '0.1.0';
  const initial = major > 0 ? `${major}.0.0` : '0.1.0';
  const base = +new Date(mcp.updatedAt);
  const tools = mcp.tools.filter((tool) => tool.validated);
  const lastTool = tools[tools.length - 1]?.name;

  const history: McpVersion[] = [
    {
      version: mcp.version,
      publishedAt: new Date(base).toISOString(),
      author: mcp.author,
      changes: [
        `Revalidación contra ${mcp.site} y ajuste de los esquemas de entrada.`,
        `Se revisan las descripciones de las ${tools.length} herramientas publicadas.`,
      ],
      downloads: Math.max(18, Math.round(mcp.installs * 0.14)),
    },
    {
      version: previous,
      publishedAt: new Date(base - 38 * DAY).toISOString(),
      author: mcp.author,
      changes: [
        lastTool ? `Se añade la herramienta ${lastTool} y su validación.` : 'Se amplía la cobertura de acciones de la web.',
        'Se corrigen dependencias entre parámetros y se actualizan los ejemplos.',
      ],
      downloads: Math.max(10, Math.round(mcp.installs * 0.09)),
    },
  ];

  if (initial !== previous && initial !== mcp.version) {
    history.push({
      version: initial,
      publishedAt: new Date(base - 96 * DAY).toISOString(),
      author: mcp.author,
      changes: ['Primera publicación del MCP y validación de las herramientas principales.'],
      downloads: Math.max(6, Math.round(mcp.installs * 0.05)),
    });
  }

  return history;
}

export function reportsOf(mcp: Mcp): McpReport[] {
  return mcp.reports ?? [];
}

/**
 * Informe de validación. El registro lo entrega ya calculado; para los datos
 * antiguos se deriva de las herramientas y de la exploración.
 */
export function validationOf(mcp: Mcp): ValidationReport {
  if (mcp.validation) return mcp.validation;
  const results = mcp.tools.map((tool, index) => ({
    name: tool.name,
    kind: tool.kind,
    ok: tool.validated,
    reason: tool.failure ?? null,
    swapped: false,
    status: tool.validated ? 200 : null,
    seconds: Number((1.2 + index * 0.7).toFixed(1)),
  }));
  return {
    validatedAt: mcp.updatedAt,
    proposed: Math.max(mcp.exploration.proposed, results.length),
    validated: results.filter((result) => result.ok).length,
    results,
  };
}

export function openReportsOf(mcp: Mcp): McpReport[] {
  return reportsOf(mcp).filter((report) => report.status === 'open');
}

export interface Freshness {
  mcpAt: number;
  sourceAt: number | null;
  ageDays: number;
  sourceGapDays: number;
  outdated: boolean;
  reason: 'source' | 'age' | null;
}

const SOURCE_GAP_DAYS = 40;
const MAX_AGE_DAYS = 150;

/** Compara la última versión del MCP con la última actualización conocida de la web. */
export function freshnessOf(mcp: Mcp): Freshness {
  const mcpAt = +new Date(mcp.updatedAt);
  const sourceAt = mcp.sourceUpdatedAt ? +new Date(mcp.sourceUpdatedAt) : null;
  const ageDays = Math.max(0, Math.floor((NOW - mcpAt) / DAY));
  const sourceGapDays = sourceAt ? Math.max(0, Math.floor((sourceAt - mcpAt) / DAY)) : 0;
  const bySource = sourceGapDays >= SOURCE_GAP_DAYS;
  const byAge = ageDays >= MAX_AGE_DAYS;
  return {
    mcpAt,
    sourceAt,
    ageDays,
    sourceGapDays,
    outdated: bySource || byAge,
    reason: bySource ? 'source' : byAge ? 'age' : null,
  };
}

/** Todas las implementaciones publicadas para la misma web. */
export function siteVariants(mcp: Mcp, catalog: Mcp[]): Mcp[] {
  const key = siteKey(mcp.site);
  const variants = catalog.filter((item) => item.status === 'published' && siteKey(item.site) === key);
  return variants.some((item) => item.id === mcp.id) ? variants : [mcp, ...variants];
}

export function groupBySite(catalog: Mcp[]): Map<string, Mcp[]> {
  const groups = new Map<string, Mcp[]>();
  for (const mcp of catalog) {
    const key = siteKey(mcp.site);
    groups.set(key, [...(groups.get(key) ?? []), mcp]);
  }
  return groups;
}

export type McpMode = 'read_only' | 'read_write';

/** Modo derivado del contrato: una herramienta con efecto implica escritura. */
export function modeOf(mcp: Mcp): McpMode {
  const writes = mcp.tools.some(
    (tool) => tool.validated && (tool.kind === 'browser' || ['POST', 'PUT', 'DELETE'].includes(tool.method ?? '')),
  );
  return writes ? 'read_write' : 'read_only';
}

export function validationRatio(mcp: Mcp): number {
  const validated = mcp.tools.filter((tool) => tool.validated).length;
  return validated / Math.max(1, mcp.exploration.proposed);
}

export function recommendationScore(mcp: Mcp): number {
  const rating = ratingOf(mcp);
  const health = freshnessOf(mcp);
  const recency = Math.max(0, 1 - health.ageDays / 180);
  const reach = Math.min(1, Math.log10(mcp.installs + 10) / 5);
  const reportPenalty = Math.min(openReportsOf(mcp).length, 3) * 0.6;
  return (
    rating.average * 2 +
    recency * 1.5 +
    reach * 0.8 +
    (mcp.official ? 0.15 : 0) -
    reportPenalty -
    (health.outdated ? 2.5 : 0)
  );
}

export function recommendedOf(variants: Mcp[]): Mcp | undefined {
  return [...variants].sort((a, b) => recommendationScore(b) - recommendationScore(a))[0];
}

export function newestOf(variants: Mcp[]): Mcp | undefined {
  return [...variants].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))[0];
}

export function bestRatedOf(variants: Mcp[]): Mcp | undefined {
  return [...variants].sort((a, b) => {
    const ratingA = ratingOf(a);
    const ratingB = ratingOf(b);
    return ratingB.average - ratingA.average || ratingB.count - ratingA.count;
  })[0];
}

export type BadgeTone = 'ink' | 'ok' | 'warn' | 'danger' | 'outline';

export interface McpBadge {
  id: 'recommended' | 'newest' | 'best' | 'outdated' | 'reports';
  label: string;
  tone: BadgeTone;
}

export function badgesFor(mcp: Mcp, variants: Mcp[]): McpBadge[] {
  const badges: McpBadge[] = [];
  const comparable = variants.filter((item) => item.id !== mcp.id);

  if (comparable.length > 0) {
    if (recommendedOf(variants)?.id === mcp.id) badges.push({ id: 'recommended', label: 'Recomendado', tone: 'ink' });
    if (newestOf(variants)?.id === mcp.id) badges.push({ id: 'newest', label: 'Más reciente', tone: 'outline' });
    if (bestRatedOf(variants)?.id === mcp.id) badges.push({ id: 'best', label: 'Mejor valorado', tone: 'ok' });
  }

  const health = freshnessOf(mcp);
  if (health.outdated) badges.push({ id: 'outdated', label: 'Desactualizado', tone: 'warn' });

  const openReports = openReportsOf(mcp).length;
  if (openReports > 0) {
    badges.push({
      id: 'reports',
      label: openReports === 1 ? '1 incidencia' : `${openReports} incidencias`,
      tone: 'danger',
    });
  }

  return badges;
}

export type SortMode = 'recommended' | 'recent' | 'rating' | 'installs' | 'validation';

export function sortMcps(mcps: Mcp[], mode: SortMode): Mcp[] {
  return [...mcps].sort((a, b) => {
    if (mode === 'recent') return +new Date(b.updatedAt) - +new Date(a.updatedAt);
    if (mode === 'rating') {
      const ratingA = ratingOf(a);
      const ratingB = ratingOf(b);
      return ratingB.average - ratingA.average || ratingB.count - ratingA.count;
    }
    if (mode === 'installs') return b.installs - a.installs;
    if (mode === 'validation') {
      const ratioA = validationRatio(a);
      const ratioB = validationRatio(b);
      return ratioB - ratioA || b.tools.length - a.tools.length || recommendationScore(b) - recommendationScore(a);
    }
    return recommendationScore(b) - recommendationScore(a);
  });
}

export function averageRatingOf(variants: Mcp[]): { average: number; count: number } {
  const totals = variants.reduce(
    (acc, mcp) => {
      const rating = ratingOf(mcp);
      return { weighted: acc.weighted + rating.average * rating.count, count: acc.count + rating.count };
    },
    { weighted: 0, count: 0 },
  );
  return {
    average: totals.count ? Number((totals.weighted / totals.count).toFixed(1)) : 0,
    count: totals.count,
  };
}

export function latestSourceUpdate(variants: Mcp[]): string | null {
  const dates = variants
    .map((mcp) => mcp.sourceUpdatedAt)
    .filter((date): date is string => Boolean(date))
    .sort((a, b) => +new Date(b) - +new Date(a));
  return dates[0] ?? null;
}
