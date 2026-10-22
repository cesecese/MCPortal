import type { HttpMethod, InputSchema, JsonSchemaProperty, Manifest, ManifestTool } from '../types/contract';
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
  return `./mcportal install ${mcp.slug}`;
}

/** Origen real del sitio (las webs de demo locales van por http). */
export function originOf(mcp: Pick<Mcp, 'site'>): string {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(mcp.site);
  return `${local ? 'http' : 'https'}://${mcp.site}`;
}

/** Manifiesto §6.1 con las herramientas validadas e incluidas en la revisión. */
export function toManifest(mcp: Mcp): string {
  const origin = originOf(mcp);
  const tools: ManifestTool[] = mcp.tools
    .filter((t) => t.validated)
    .map((t) => {
      const properties: Record<string, JsonSchemaProperty> = {};
      for (const param of t.params) {
        const prop: JsonSchemaProperty = { type: param.type === 'date' ? 'string' : param.type };
        if (param.description) prop.description = param.description;
        const format = param.format ?? (param.type === 'date' ? 'date' : undefined);
        if (format) prop.format = format;
        if (param.enum) prop.enum = param.enum;
        if (param.default !== undefined) prop.default = param.default;
        properties[param.name] = prop;
      }
      const inputSchema: InputSchema = { type: 'object', properties };
      const required = t.params.filter((p) => p.required).map((p) => p.name);
      if (required.length) inputSchema.required = required;

      const impl: ManifestTool['impl'] =
        t.impl ??
        (t.kind === 'http'
          ? {
              kind: 'http',
              method: (t.method as HttpMethod) ?? 'GET',
              url: t.endpoint?.startsWith('http') ? t.endpoint : `${origin}${t.endpoint ?? ''}`,
            }
          : {
              kind: 'browser',
              start_url: `${origin}/`,
              steps: [],
              extract: 'main',
            });

      const tool: ManifestTool = {
        name: t.name,
        description: t.description,
        input_schema: inputSchema,
        impl,
      };
      if (t.examples) tool.examples = t.examples;
      const dependencies =
        t.dependencies ??
        (t.dependsOn
          ? [
              {
                param: t.dependsOnParam ?? t.params.find((p) => p.name === 'cart_id')?.name ?? 'id',
                tool: t.dependsOn,
                path: t.dependsOnPath ?? '',
              },
            ]
          : []);
      if (dependencies.length) tool.depends_on = dependencies;
      return tool;
    });

  const manifest: Manifest = {
    site: mcp.site,
    start_url: mcp.manifest?.start_url ?? `${origin}/`,
    synthesis: mcp.manifest?.synthesis ?? 'llm',
    validated_at:
      mcp.manifest?.validated_at ?? mcp.updatedAt.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', ''),
    slug: mcp.slug,
    display_name: mcp.name,
    version: mcp.version,
    category: mcp.category,
    tags: mcp.tags,
    license: mcp.license,
    author: mcp.authorHandle,
    mode: mcp.mode,
    generated_with: mcp.manifest?.generated_with ?? 'mcportal-core 0.1',
    tools,
  };
  return JSON.stringify(manifest, null, 2);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
