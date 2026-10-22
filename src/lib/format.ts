import type { Mcp, Tool } from '../data/types';

/** Fecha "actual" fija para que los datos de ejemplo no envejezcan. */
export const NOW = new Date('2026-10-22T12:00:00Z').getTime();

const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });
const full = new Intl.NumberFormat('es-ES');

export function formatCompact(n: number): string {
  return n < 1000 ? String(n) : compact.format(n).replace(/\s/g, ' ');
}

export function formatNumber(n: number): string {
  return full.format(n);
}

export function relativeTime(iso: string): string {
  const diff = Math.max(0, NOW - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return d === 1 ? 'ayer' : `hace ${d} días`;
  const m = Math.round(d / 30);
  return m === 1 ? 'hace 1 mes' : `hace ${m} meses`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m} min ${s.toString().padStart(2, '0')} s` : `${s} s`;
}

export function validatedTools(mcp: Mcp): Tool[] {
  return mcp.tools.filter((t) => t.validated);
}

export function implMix(tools: Tool[]): 'http' | 'browser' | 'mixed' {
  const kinds = new Set(tools.map((t) => t.kind));
  if (kinds.size > 1) return 'mixed';
  return kinds.has('browser') ? 'browser' : 'http';
}

export function weeklyTrend(series: number[]): number {
  if (series.length < 8) return 0;
  const last = series.slice(-4).reduce((a, b) => a + b, 0);
  const prev = series.slice(-8, -4).reduce((a, b) => a + b, 0);
  return prev ? (last - prev) / prev : 0;
}

export function signature(tool: Tool): string {
  return `${tool.name}(${tool.params.map((p) => (p.required ? p.name : `${p.name}?`)).join(', ')})`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function installCommand(mcp: Pick<Mcp, 'slug'>): string {
  return `claude mcp add ${mcp.slug} -- npx -y mcportal run ${mcp.slug}`;
}

/** Manifiesto con el contrato de contexto.txt (§4.1), solo con herramientas validadas. */
export function toManifest(mcp: Pick<Mcp, 'site' | 'tools'>): string {
  const origin = mcp.site.startsWith('http') ? mcp.site : `https://${mcp.site}`;
  const tools = mcp.tools
    .filter((t) => t.validated)
    .map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: {
        type: 'object',
        properties: Object.fromEntries(
          t.params.map((p) => [
            p.name,
            p.type === 'date' ? { type: 'string', format: 'date' } : { type: p.type },
          ]),
        ),
        required: t.params.filter((p) => p.required).map((p) => p.name),
      },
      impl:
        t.kind === 'http'
          ? {
              kind: 'http',
              method: t.method,
              url: t.endpoint?.includes('.') && !t.endpoint.startsWith('/') ? `https://${t.endpoint}` : `${origin}${t.endpoint}`,
            }
          : { kind: 'browser', start_url: origin, steps: t.steps },
    }));
  return JSON.stringify({ site: mcp.site, tools }, null, 2);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
