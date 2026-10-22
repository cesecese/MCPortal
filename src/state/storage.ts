import type { Author, GenerationJob, Mcp } from '../types/portal';

const STORAGE_KEY = 'mcportal:state:v4';

export interface StoredState {
  mine: Mcp[];
  removed: string[];
  saved: string[];
  starred: string[];
  jobs: GenerationJob[];
  profile: Partial<Author> | null;
}

export function emptyState(): StoredState {
  return { mine: [], removed: [], saved: [], starred: [], jobs: [], profile: null };
}

/** Solo se llama desde el cliente, después de montar. */
export function loadState(): StoredState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<StoredState>;
    return {
      mine: Array.isArray(parsed.mine) ? parsed.mine : [],
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      starred: Array.isArray(parsed.starred) ? parsed.starred : [],
      jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
      profile: parsed.profile ?? null,
    };
  } catch {
    return emptyState();
  }
}

export function persistState(state: StoredState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* cuota llena o modo privado: el portal sigue funcionando en memoria */
  }
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorado */
  }
}

export const STORAGE_ID = STORAGE_KEY;
