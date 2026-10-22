/**
 * Construcción de los datos de ejemplo a partir de manifiestos reales (§6.1).
 *
 * Cada MCP de `src/data/mcps.ts` se declara una vez; de aquí salen el manifiesto,
 * la vista de herramientas para el portal y el informe de validación.
 */
import type {
  BrowserStep,
  HttpImpl,
  HttpMethod,
  InputSchema,
  JsonObject,
  JsonSchemaProperty,
  JsonValue,
  Manifest,
  ManifestTool,
} from '../types/contract';
import type {
  CategoryId,
  ImplKind,
  Mcp,
  McpMode,
  McpStatus,
  McpVersion,
  Param,
  ParamType,
  Tool,
  ValidationResult,
  Visibility,
} from '../types/portal';
import { PEOPLE } from './people';

export interface ParamSpec {
  type?: ParamType;
  required?: boolean;
  description?: string;
  format?: string;
  enum?: (string | number)[];
  default?: JsonValue;
  example?: string | number | boolean;
  /** Valor que produce otra herramienta (se rellena en el validador). */
  dependsOn?: { tool: string; path: string };
}

interface BaseToolSpec {
  name: string;
  description: string;
  params?: Record<string, ParamSpec>;
  /** Motivo de descarte: la herramienta queda fuera del manifiesto. */
  failure?: string;
}

export interface HttpToolSpec extends BaseToolSpec {
  method: HttpMethod;
  /** Ruta relativa al sitio o URL absoluta. */
  path: string;
  body?: JsonObject;
  bodyType?: 'json' | 'form';
  headers?: Record<string, string>;
  /** Receta de navegador equivalente para el autorreparador. */
  alt?: { startPath: string; steps: BrowserStep[]; extract?: string };
}

export interface BrowserToolSpec extends BaseToolSpec {
  startPath: string;
  steps: BrowserStep[];
  extract?: string;
}

export type ToolSpec = HttpToolSpec | BrowserToolSpec;

export interface McpSpec {
  id?: string;
  slug: string;
  name: string;
  site: string;
  /** `http` para las webs de demo locales. */
  scheme?: 'http' | 'https';
  icon?: string;
  description: string;
  category: CategoryId;
  tags: string[];
  /** handle del autor (ver people.ts) */
  author: string;
  mode?: McpMode;
  version?: string;
  license?: string;
  official?: boolean;
  verified?: boolean;
  installs?: number;
  stars?: number;
  weekly?: { base: number; trend?: number; seed?: number };
  createdAt?: string;
  updatedAt: string;
  status?: McpStatus;
  visibility?: Visibility;
  exploration?: { steps: number; requests: number; proposed: number; durationSec: number };
  tools: ToolSpec[];
  versions?: McpVersion[];
}

export function isBrowserSpec(spec: ToolSpec): spec is BrowserToolSpec {
  return Array.isArray((spec as BrowserToolSpec).steps);
}

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

/** Serie semanal determinista para las minigráficas. */
export function weeklySeries(base: number, trend = 0, seed = 1, weeks = 12): number[] {
  return Array.from({ length: weeks }, (_, i) => {
    const wobble = Math.sin((i + 1) * (seed % 7 + 1.3)) * 0.18 + Math.cos(i * seed * 0.37) * 0.08;
    return Math.max(0, Math.round(base * (1 + trend * (i / Math.max(1, weeks - 1))) * (1 + wobble)));
  });
}

const FAVICON_COLORS = ['#B5462B', '#1E8C5A', '#2D63C8', '#7A1730', '#0E5AA7', '#C27C0E', '#5A45D4', '#12705A', '#D7192D'];

/** Favicon «capturado» por el explorador: inicial sobre un color estable por dominio. */
export function faviconFor(host: string): string {
  const hash = [...host].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const color = FAVICON_COLORS[hash % FAVICON_COLORS.length];
  const parts = host.split('.');
  const letter = (parts.length > 2 ? parts[parts.length - 2] : parts[0]).charAt(0).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="44" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="34" font-weight="700" fill="#fff">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function schemaType(type: ParamType): JsonSchemaProperty['type'] {
  return type === 'date' ? 'string' : type;
}

function toSchemaProperty(spec: ParamSpec): JsonSchemaProperty {
  const prop: JsonSchemaProperty = { type: schemaType(spec.type ?? 'string') };
  if (spec.description) prop.description = spec.description;
  if (spec.format ?? (spec.type === 'date' ? 'date' : undefined)) prop.format = spec.format ?? 'date';
  if (spec.enum) prop.enum = spec.enum;
  if (spec.default !== undefined) prop.default = spec.default;
  return prop;
}

function toViewParam(name: string, spec: ParamSpec): Param {
  const param: Param = {
    name,
    type: spec.type ?? 'string',
    required: spec.required !== false,
  };
  if (spec.description) param.description = spec.description;
  if (spec.format ?? (spec.type === 'date' ? 'date' : undefined)) param.format = spec.format ?? 'date';
  if (spec.enum) param.enum = spec.enum;
  if (spec.default !== undefined) param.default = spec.default;
  if (spec.example !== undefined) param.example = spec.example;
  return param;
}

function renderStep(step: BrowserStep): string {
  switch (step.action) {
    case 'click':
      return `click ${step.selector ?? ''}`.trim();
    case 'fill':
      return `fill ${step.selector ?? ''} ← ${step.value ?? ''}`.trim();
    case 'select':
      return `select ${step.selector ?? ''} ← ${step.value ?? ''}`.trim();
    case 'press':
      return `press ${step.key ?? step.value ?? ''}`.trim();
    case 'check':
      return `check ${step.selector ?? ''}`.trim();
    case 'wait':
      return `wait ${step.value ?? ''}`.trim();
  }
}

function isoToValidatedAt(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, '').replace('Z', '');
}

function defaultVersions(version: string, updatedAt: string, tools: number, validated: number): McpVersion[] {
  const [major, minor = 0] = version.split('.').map(Number);
  const versions: McpVersion[] = [
    { version, publishedAt: updatedAt, notes: 'Exploración y validación completas. Herramientas estables.', tools, validated },
  ];
  if (minor > 0) {
    const prev = `${major}.${minor - 1}.0`;
    const date = new Date(new Date(updatedAt).getTime() - 1000 * 60 * 60 * 24 * 46).toISOString();
    versions.push({
      version: prev,
      publishedAt: date,
      notes: 'Versión anterior. Algunas herramientas cambiaron de nombre.',
      tools: Math.max(1, tools - 1),
      validated: Math.max(1, validated - 1),
    });
  }
  return versions;
}

/**
 * Convierte una declaración compacta en un `Mcp` completo, con manifiesto
 * conforme a §6.1 y un informe de validación coherente con las herramientas.
 */
export function defineMcp(spec: McpSpec): Mcp {
  const origin = `${spec.scheme ?? 'https'}://${spec.site}`;
  const author = PEOPLE[spec.author];
  if (!author) throw new Error(`Autor desconocido: ${spec.author}`);

  const viewTools: Tool[] = [];
  const manifestTools: ManifestTool[] = [];
  const results: ValidationResult[] = [];

  spec.tools.forEach((toolSpec, index) => {
    const params = toolSpec.params ?? {};
    const properties: Record<string, JsonSchemaProperty> = {};
    const required: string[] = [];
    const examples: Record<string, JsonValue> = {};
    const dependsOn: { param: string; tool: string; path: string }[] = [];
    const viewParams: Param[] = [];

    for (const [name, paramSpec] of Object.entries(params)) {
      properties[name] = toSchemaProperty(paramSpec);
      if (paramSpec.required !== false) required.push(name);
      if (paramSpec.example !== undefined) examples[name] = paramSpec.example;
      if (paramSpec.dependsOn) dependsOn.push({ param: name, tool: paramSpec.dependsOn.tool, path: paramSpec.dependsOn.path });
      viewParams.push(toViewParam(name, paramSpec));
    }

    const inputSchema: InputSchema = { type: 'object', properties };
    if (required.length) inputSchema.required = required;

    const browser = isBrowserSpec(toolSpec);
    const kind: ImplKind = browser ? 'browser' : 'http';
    const validated = !toolSpec.failure;

    let impl: ManifestTool['impl'];
    if (isBrowserSpec(toolSpec)) {
      impl = {
        kind: 'browser',
        start_url: `${origin}${toolSpec.startPath}`,
        steps: toolSpec.steps,
        extract: toolSpec.extract ?? 'main',
      };
    } else {
      const httpImpl: HttpImpl = {
        kind: 'http',
        method: toolSpec.method,
        url: isHttpUrl(toolSpec.path) ? toolSpec.path : `${origin}${toolSpec.path}`,
      };
      if (toolSpec.bodyType) httpImpl.body_type = toolSpec.bodyType;
      if (toolSpec.body) httpImpl.body = toolSpec.body;
      if (toolSpec.headers) httpImpl.headers = toolSpec.headers;
      if (toolSpec.alt) {
        httpImpl.alt = {
          kind: 'browser',
          start_url: `${origin}${toolSpec.alt.startPath}`,
          steps: toolSpec.alt.steps,
          extract: toolSpec.alt.extract ?? 'main',
        };
      }
      impl = httpImpl;
    }

    const manifestTool: ManifestTool = {
      name: toolSpec.name,
      description: toolSpec.description,
      input_schema: inputSchema,
      impl,
    };
    if (Object.keys(examples).length) manifestTool.examples = examples;
    if (dependsOn.length) manifestTool.depends_on = dependsOn;

    const view: Tool = {
      name: toolSpec.name,
      description: toolSpec.description,
      kind,
      params: viewParams,
      validated,
      impl,
    };
    if (browser) {
      view.steps = toolSpec.steps.map(renderStep);
    } else {
      view.method = toolSpec.method;
      view.endpoint = isHttpUrl(toolSpec.path) ? toolSpec.path : toolSpec.path;
    }
    if (dependsOn.length) view.dependencies = dependsOn;
    const dependency = viewParams.find((p) => params[p.name]?.dependsOn);
    if (dependency) {
      view.dependsOn = params[dependency.name].dependsOn!.tool;
      view.dependsOnParam = dependency.name;
      view.dependsOnPath = params[dependency.name].dependsOn!.path;
    }
    if (Object.keys(examples).length) view.examples = examples;
    if (toolSpec.failure) view.failure = toolSpec.failure;

    viewTools.push(view);
    results.push({
      name: toolSpec.name,
      kind,
      ok: validated,
      reason: toolSpec.failure ?? null,
      swapped: false,
      status: validated ? 200 : null,
      seconds: Number((1.4 + (index % 4) * 0.8).toFixed(1)),
    });
    if (validated) manifestTools.push(manifestTool);
  });

  const validatedCount = viewTools.filter((t) => t.validated).length;
  const version = spec.version ?? '1.0.0';
  const proposed = spec.exploration?.proposed ?? viewTools.length;

  const manifest: Manifest = {
    site: spec.site,
    start_url: `${origin}/`,
    synthesis: 'llm',
    validated_at: isoToValidatedAt(spec.updatedAt),
    slug: spec.slug,
    display_name: spec.name,
    version,
    category: spec.category,
    tags: spec.tags,
    license: spec.license ?? 'MIT',
    author: spec.author,
    mode: spec.mode ?? 'read_only',
    generated_with: 'mcportal-core 0.1',
    tools: manifestTools,
  };

  const exploration = spec.exploration ?? {
    steps: 8 + viewTools.length * 2,
    requests: 6 + viewTools.length * 5,
    proposed,
    durationSec: 55 + viewTools.length * 14,
  };

  return {
    id: spec.id ?? `m-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    site: spec.site,
    icon: spec.icon ?? faviconFor(spec.site),
    description: spec.description,
    category: spec.category,
    tags: spec.tags,
    author: author.name,
    authorHandle: author.handle,
    official: spec.official,
    verified: spec.verified,
    tools: viewTools,
    manifest,
    mode: spec.mode ?? 'read_only',
    installs: spec.installs ?? 0,
    weeklyInstalls: weeklySeries(
      spec.weekly?.base ?? Math.max(4, Math.round((spec.installs ?? 0) / 18)),
      spec.weekly?.trend ?? 0.2,
      spec.weekly?.seed ?? spec.slug.length,
    ),
    stars: spec.stars ?? 0,
    version,
    license: spec.license ?? 'MIT',
    createdAt: spec.createdAt ?? spec.updatedAt,
    updatedAt: spec.updatedAt,
    status: spec.status ?? 'published',
    visibility: spec.visibility ?? 'public',
    exploration,
    versions: spec.versions ?? defaultVersions(version, spec.updatedAt, viewTools.length, validatedCount),
    validation: {
      validatedAt: spec.updatedAt,
      proposed,
      validated: validatedCount,
      results,
    },
  };
}

