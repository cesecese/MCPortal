export type ImplKind = 'http' | 'browser';

export type ParamType = 'string' | 'integer' | 'number' | 'boolean' | 'date';

export interface Param {
  name: string;
  type: ParamType;
  required: boolean;
}

export interface Tool {
  name: string;
  description: string;
  kind: ImplKind;
  params: Param[];
  /** http: método y plantilla de URL */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint?: string;
  /** browser: pasos de Playwright en forma legible */
  steps?: string[];
  /** Herramienta de la que necesita un valor (p. ej. cart_id de create_cart) */
  dependsOn?: string;
  validated: boolean;
  /** Motivo por el que falló la validación */
  failure?: string;
}

export type CategoryId =
  | 'libros'
  | 'comercio'
  | 'reservas'
  | 'transporte'
  | 'datos'
  | 'desarrollo'
  | 'eventos'
  | 'empleo'
  | 'ciencia';

export type McpStatus = 'published' | 'draft';

export type Visibility = 'public' | 'unlisted';

export interface Exploration {
  steps: number;
  requests: number;
  proposed: number;
  durationSec: number;
}

/** Distribución de votos de 5 a 1 estrellas. */
export interface RatingSummary {
  average: number;
  count: number;
  distribution: [number, number, number, number, number];
}

export interface McpVersion {
  version: string;
  publishedAt: string;
  author?: string;
  /** Formato del portal: lista de cambios publicada. */
  changes?: string[];
  downloads?: number;
  /** Formato del registro: resumen de la versión. */
  notes?: string;
  tools?: number;
  validated?: number;
}

/** Resultado de validar una herramienta concreta contra la web. */
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

/** Informe que produce el validador y consume la pestaña Validación. */
export interface ValidationReport {
  validatedAt: string;
  proposed: number;
  validated: number;
  results: ValidationResult[];
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

export interface Mcp {
  id: string;
  slug: string;
  /** Nombre legible del sitio */
  name: string;
  site: string;
  /** Favicon de la web (en public/favicons) */
  icon?: string;
  description: string;
  category: CategoryId;
  tags: string[];
  /** Firma libre: la web es anónima */
  author: string;
  tools: Tool[];
  installs: number;
  weeklyInstalls: number[];
  version: string;
  license: string;
  updatedAt: string;
  status: McpStatus;
  visibility: Visibility;
  exploration: Exploration;
  official?: boolean;
  /** Última modificación detectada en la web original. */
  sourceUpdatedAt?: string;
  rating?: RatingSummary;
  versions?: McpVersion[];
  validation?: ValidationReport;
  reports?: McpReport[];
  /** Voto del visitante en esta maqueta, si ya ha valorado. */
  myRating?: number;
}
