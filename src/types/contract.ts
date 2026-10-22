/**
 * Contrato de MCPortal — MASTER_PROMPT.md §6.
 *
 * Estos tipos son la interfaz entre explorador, sintetizador, validador, runtime,
 * registro y portal. No se cambian sin acuerdo de las personas 1–4.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export interface JsonObject {
  [key: string]: JsonValue;
}

/* ------------------------------------------------------------------ §6.1 */

export type JsonSchemaType = 'string' | 'integer' | 'number' | 'boolean' | 'object' | 'array';

export interface JsonSchemaProperty {
  type: JsonSchemaType;
  description?: string;
  /** p. ej. "date" */
  format?: string;
  enum?: (string | number)[];
  default?: JsonValue;
  items?: JsonSchemaProperty;
}

export interface InputSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'QUERY' | 'HEAD' | 'OPTIONS';

export type BrowserAction = 'fill' | 'select' | 'click' | 'press' | 'check' | 'wait';

export interface BrowserStep {
  action: BrowserAction;
  selector?: string;
  /** Admite plantillas `{param}`. */
  value?: string;
  /** Texto de la tecla cuando `action: "press"`. */
  key?: string;
}

export interface BrowserRecipe {
  kind: 'browser';
  start_url: string;
  steps: BrowserStep[];
  /** Selector CSS del texto que se devuelve. */
  extract?: string;
}

export interface HttpImpl {
  kind: 'http';
  method: HttpMethod;
  url: string;
  body_type?: 'json' | 'form';
  body?: JsonObject;
  headers?: Record<string, string>;
  /** Receta de navegador equivalente (la usa el validador para autorrepararse). */
  alt?: BrowserRecipe;
}

export type ToolImpl = HttpImpl | BrowserRecipe;

export interface ToolDependency {
  /** Parámetro que se rellena. */
  param: string;
  /** Herramienta que lo produce. */
  tool: string;
  /** Ruta del campo en la respuesta de esa herramienta. */
  path: string;
}

export interface ManifestTool {
  name: string;
  description: string;
  input_schema: InputSchema;
  impl: ToolImpl;
  /** Solo validador. */
  examples?: Record<string, JsonValue>;
  /** Solo validador. */
  depends_on?: ToolDependency[];
}

/** Metadatos de registro: los usa el portal, el runtime los ignora. */
export interface ManifestMeta {
  slug?: string;
  display_name?: string;
  version?: string;
  category?: string;
  tags?: string[];
  license?: string;
  author?: string;
  mode?: 'read_only' | 'read_write';
  generated_with?: string;
}

export interface Manifest extends ManifestMeta {
  site: string;
  start_url: string;
  synthesis: 'llm' | 'heuristic';
  validated_at?: string;
  tools: ManifestTool[];
}

/* ------------------------------------------------------------------ §6.2 */

export interface TraceElement {
  id: number;
  tag: string;
  kind: string;
  label: string;
  href: string | null;
  raw_href: string | null;
  type: string | null;
  name: string | null;
  value: string | null;
  required: boolean;
  min: string | null;
  max: string | null;
  options: { value: string; label: string }[] | null;
  form: number | null;
  selector: string | null;
  similar: number;
}

export interface TraceForm {
  index: number;
  method: string;
  action: string;
  hidden: { name: string; value: string }[];
}

export type TraceActionType = 'click' | 'fill' | 'select' | 'goto' | 'back' | 'finish';

export interface TraceAction {
  type: TraceActionType;
  id?: number;
  value?: string;
  submit?: boolean;
  option?: string;
  url?: string;
}

export interface TraceStep {
  i: number;
  action: TraceAction;
  element: TraceElement | null;
  url_before: string;
  url_after: string;
  request_ids: number[];
  error: string | null;
  note: string | null;
  has_main: boolean;
  forms: TraceForm[];
}

export interface CapturedRequest {
  id: number;
  step: number;
  kind: 'fetch' | 'xhr' | 'document';
  method: string;
  url: string;
  status: number;
  request_content_type: string | null;
  post_data: string | null;
  content_type: string | null;
  body: string | null;
  json?: JsonValue | null;
}

export interface ExplorationTrace {
  site: string;
  title: string;
  start_url: string;
  policy: string;
  started: number;
  finished: number;
  steps: TraceStep[];
  requests: CapturedRequest[];
  candidates: Candidate[];
  dependencies: Dependency[];
}

/* ------------------------------------------------------------------ §6.3 */

export type CandidateParamType = 'string' | 'integer' | 'number' | 'boolean';
export type ParamLocation = 'path' | 'query' | 'body';
export type ParamSource = 'input' | 'response' | 'literal';

export interface CandidateParam {
  name: string;
  type: CandidateParamType;
  example?: string;
  location: ParamLocation;
  key: string | null;
  source: ParamSource;
  label?: string;
  from_request?: number;
  from_candidate?: string;
  path?: string;
  format?: string;
  enum?: string[];
}

export interface CandidateBrowser {
  start_url: string;
  steps: BrowserStep[];
  extract: string;
  params: CandidateParam[];
}

export interface CandidateLiteral {
  location: ParamLocation;
  key: string | null;
  value: string;
}

export interface Candidate {
  id: string;
  request_ids: number[];
  variants: number;
  step: number;
  trigger: string;
  method: string;
  origin: string;
  path: string;
  query: [string, string][];
  url: string;
  body_type: 'json' | 'form' | 'none';
  body: JsonObject | null;
  params: CandidateParam[];
  literals: CandidateLiteral[];
  status: number;
  content_type: string | null;
  response_preview: string;
  csrf_fields: string[];
  browser?: CandidateBrowser;
}

export interface Dependency {
  from_request: number;
  path: string;
  to_request: number;
  location: ParamLocation;
  key: string | null;
  value: string;
  from_candidate?: string;
  to_candidate?: string;
}

/* ------------------------------------------------------------------ §6.4 */

/** Una línea JSON de `runs/<sitio>/events.jsonl`, consumida por el panel y el portal. */
export type PipelineEvent =
  | { t: number; type: 'run_started'; url: string; cached: boolean }
  | { t: number; type: 'explore_started'; url: string; policy: string; max_steps: number }
  | { t: number; type: 'mode'; read_only: boolean; site: string }
  | { t: number; type: 'warning'; text: string }
  | { t: number; type: 'thought'; text: string }
  | { t: number; type: 'step'; i: number; action: string; url: string; requests: number[]; error: string | null }
  | { t: number; type: 'request'; id: number; step: number; method: string; url: string; status: number; kind: string }
  | { t: number; type: 'blocked'; step: number; method: string; url: string }
  | { t: number; type: 'finish'; summary: string }
  | { t: number; type: 'candidate'; id: string; method: string; url: string; params: string[]; csrf: string[]; browser: boolean }
  | { t: number; type: 'explore_done'; steps: number; requests: number; candidates: number; dependencies: number }
  | { t: number; type: 'tool_proposed'; name: string; kind: 'http' | 'browser'; description: string }
  | { t: number; type: 'candidate_discarded'; candidate_id: string; reason: string }
  | { t: number; type: 'synth_done'; mode: 'llm' | 'heuristic'; proposed: number; discarded: number }
  | { t: number; type: 'validate_retry'; name: string; reason: string; kind: 'http' | 'browser' }
  | {
      t: number;
      type: 'validated';
      name: string;
      ok: boolean;
      kind: 'http' | 'browser';
      reason: string | null;
      swapped: boolean;
      status: number | null;
    }
  | { t: number; type: 'validate_done'; proposed: number; validated: number }
  | { t: number; type: 'done'; proposed: number; validated: number; manifest: string };

export type PipelineEventType = PipelineEvent['type'];

/** Slugs de §6.4: el host con todo lo que no sea [a-z0-9] cambiado por `-`. */
export function slugForSite(url: string): string {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();
  return host.toLowerCase().replace(/[^a-z0-9]/g, '-');
}
