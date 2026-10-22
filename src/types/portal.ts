/**
 * Tipos propios del portal (no del contrato del core).
 *
 * El registro y la capa de servicios hablan `Manifest` (§6.1); el portal lo
 * envuelve en `Mcp` con lo que necesita para pintar: autor, estadísticas,
 * versiones, informe de validación y estado editorial.
 */
import type {
  JsonValue,
  Manifest,
  PipelineEvent,
  ToolDependency,
  ToolImpl,
} from './contract';

/* ------------------------------------------------------------------ base */

export type CategoryId =
  | 'libros'
  | 'comercio'
  | 'reservas'
  | 'transporte'
  | 'datos'
  | 'desarrollo'
  | 'eventos'
  | 'empleo'
  | 'ciencia'
  | 'cultura'
  | 'administracion'
  | 'internas'
  | 'viajes';

export type McpStatus = 'published' | 'draft' | 'preparing';
export type Visibility = 'public' | 'unlisted' | 'private';
export type McpMode = 'read_only' | 'read_write';
export type ImplKind = 'http' | 'browser';
/** En el manifiesto el tipo es JSON Schema; en la UI se muestra `date` como atajo. */
export type ParamType = 'string' | 'integer' | 'number' | 'boolean' | 'date';

export interface Param {
  name: string;
  type: ParamType;
  required: boolean;
  description?: string;
  format?: string;
  enum?: (string | number)[];
  default?: JsonValue;
  example?: JsonValue;
}

/** Herramienta tal y como la pinta el portal, derivada de `ManifestTool`. */
export interface Tool {
  name: string;
  description: string;
  kind: ImplKind;
  params: Param[];
  /** http */
  method?: string;
  endpoint?: string;
  /** browser: pasos legibles (la receta completa está en `impl`) */
  steps?: string[];
  /** Herramienta de la que depende un parámetro (la primera, para la UI) */
  dependsOn?: string;
  /** Todas las dependencias del manifiesto. */
  dependencies?: ToolDependency[];
  /** Parámetro concreto que depende de otra herramienta. */
  dependsOnParam?: string;
  /** Ruta del campo en la respuesta de la herramienta origen. */
  dependsOnPath?: string;
  /** Entradas de ejemplo (solo validador) */
  examples?: Record<string, JsonValue>;
  validated: boolean;
  /** Motivo por el que no pasó la validación */
  failure?: string;
  impl?: ToolImpl;
}

export interface Exploration {
  steps: number;
  requests: number;
  proposed: number;
  durationSec: number;
}

export interface McpVersion {
  version: string;
  publishedAt: string;
  author: string;
  /** Qué cambió en esta versión (lo pinta el historial). */
  changes: string[];
  downloads: number;
  /** Campos de la ficha del portal. */
  notes?: string;
  tools?: number;
  validated?: number;
}

/** Distribución de votos de 5 a 1 estrellas. */
export interface RatingSummary {
  average: number;
  count: number;
  distribution: [number, number, number, number, number];
}

export type ReportKind = 'broken' | 'tool' | 'outdated' | 'other';

export interface McpReport {
  id: string;
  kind: ReportKind;
  detail: string;
  author: string;
  createdAt: string;
  status: 'open' | 'resolved';
}

export type CommentRole = 'owner' | 'author' | 'contributor';

export interface DiscussionComment {
  id: string;
  author: string;
  role?: CommentRole;
  createdAt: string;
  body: string;
  replies?: DiscussionComment[];
}

export interface UserComment extends DiscussionComment {
  parentId?: string;
}

export interface ValidationResult {
  name: string;
  kind: ImplKind;
  ok: boolean;
  reason: string | null;
  swapped: boolean;
  status: number | null;
  seconds: number;
  preview?: string;
}

export interface ValidationReport {
  validatedAt: string;
  proposed: number;
  validated: number;
  results: ValidationResult[];
}

export interface Mcp {
  id: string;
  slug: string;
  /** Nombre legible del sitio */
  name: string;
  site: string;
  /** Favicon (en public/favicons) o data URI generada */
  icon?: string;
  description: string;
  category: CategoryId;
  tags: string[];
  /** Nombre visible del autor */
  author: string;
  authorHandle: string;
  official?: boolean;
  verified?: boolean;
  tools: Tool[];
  /** Manifiesto validado (§6.1). El runtime solo lee esto. */
  manifest: Manifest;
  mode: McpMode;
  installs: number;
  weeklyInstalls: number[];
  stars: number;
  version: string;
  license: string;
  createdAt: string;
  updatedAt: string;
  status: McpStatus;
  visibility: Visibility;
  exploration: Exploration;
  versions: McpVersion[];
  validation: ValidationReport;
  /** Comunidad (la usa la ficha de la persona 3). */
  rating?: RatingSummary;
  reports?: McpReport[];
  /** Última modificación detectada en la web original. */
  sourceUpdatedAt?: string;
  /** Voto del visitante en esta maqueta, si ya ha valorado. */
  myRating?: number;
}

/* ------------------------------------------------------------------ autor */

export interface AuthorStats {
  published: number;
  drafts: number;
  installs: number;
  stars: number;
  tools: number;
}

export interface AuthorActivity {
  date: string;
  text: string;
  slug?: string;
}

export interface Author {
  handle: string;
  name: string;
  bio: string;
  location?: string;
  joinedAt: string;
  links?: { label: string; href: string }[];
  stats: AuthorStats;
  activity: AuthorActivity[];
}

/* ------------------------------------------------------------------ servicios */

export interface McpFilters {
  q?: string;
  category?: CategoryId;
  impl?: ImplKind | 'mixed';
  mode?: McpMode;
  verified?: boolean;
}

export type McpOrder = 'popular' | 'recent' | 'validated';

export interface McpPage {
  items: Mcp[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublishOptions {
  visibility: Visibility;
  category: CategoryId;
  tags: string[];
  license: string;
  /** Confirmación obligatoria de permiso para automatizar la web. */
  permissionConfirmed: boolean;
}

export interface GenerationOptions {
  hint?: string;
  maxSteps?: number;
  mode: McpMode;
  policy?: 'auto' | 'llm' | 'heuristic';
}

/** Fotograma del navegador simulado (solo presentación; no es contrato). */
export interface SceneFrame {
  step: number;
  path: string;
  observation: string[];
}

export interface GenerationJob {
  id: string;
  url: string;
  slug: string;
  startedAt: number;
  durationMs: number;
  options: GenerationOptions;
  /** Eventos exactos de §6.4, en orden. */
  events: PipelineEvent[];
  scene: SceneFrame[];
  /** Borrador que se materializa al terminar. */
  draft: Mcp;
}

export interface GeneratedRun {
  events: PipelineEvent[];
  scene: SceneFrame[];
  draft: Mcp;
  durationMs: number;
}
