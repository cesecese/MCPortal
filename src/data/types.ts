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
}
