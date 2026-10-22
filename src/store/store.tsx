'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AUTHORS } from '../data/authors';
import { SEED_MCPS } from '../data/mcps';
import { CURRENT_USER_HANDLE } from '../data/people';
import { toManifest } from '../lib/format';
import { buildGeneration } from '../services/generation';
import { emptyState, loadState, persistState, type StoredState } from '../state/storage';
import type { Manifest } from '../types/contract';
import type {
  Author,
  GenerationJob,
  GenerationOptions,
  Mcp,
  McpStatus,
  PublishOptions,
} from '../types/portal';
import { useToast } from './toast';

const isoNow = () => new Date().toISOString();

/** El manifiesto se regenera tras editar nombres, descripciones o herramientas. */
function syncManifest(mcp: Mcp): Mcp {
  const manifest = JSON.parse(toManifest(mcp)) as Manifest;
  return { ...mcp, manifest: { ...manifest, synthesis: mcp.manifest?.synthesis ?? 'llm' } };
}

interface Store {
  /** Catálogo completo: datos de ejemplo + lo creado en este navegador. */
  mcps: Mcp[];
  bySlug: (slug: string) => Mcp | undefined;
  byId: (id: string) => Mcp | undefined;
  /** Compatibilidad con el prototipo: crea o actualiza un MCP propio. */
  save: (mcp: Mcp) => void;

  hydrated: boolean;
  currentUser: Author;
  profile: Author;
  saved: string[];
  starred: string[];
  jobs: GenerationJob[];

  /* §9: interfaz de servicios del portal */
  listMyMcps: (status?: McpStatus) => Mcp[];
  saveDraft: (mcp: Mcp) => void;
  publish: (slug: string, options: PublishOptions) => Mcp | null;
  /** Publica un borrador ya editado (paso 4 de «Crear») sin depender del estado anterior. */
  publishDraft: (mcp: Mcp, options: PublishOptions) => Mcp | null;
  unpublish: (slug: string) => void;
  duplicate: (slug: string) => Mcp | null;
  remove: (slug: string) => void;
  /** Descarta un borrador recién generado (no afecta a los datos de ejemplo). */
  discardDraft: (slug: string) => void;
  toggleStar: (slug: string) => void;
  toggleSaved: (slug: string) => void;
  isStarred: (slug: string) => boolean;
  isSaved: (slug: string) => boolean;
  updateProfile: (patch: Partial<Author>) => void;

  startGeneration: (url: URL, options: GenerationOptions) => GenerationJob;
  cancelGeneration: (id: string) => void;
  finalizeGeneration: (id: string) => void;
  getJob: (id: string) => GenerationJob | undefined;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const notify = useToast();
  const [state, setState] = useState<StoredState>(emptyState);
  const [hydrated, setHydrated] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // El servidor pinta los datos de ejemplo; lo guardado se aplica tras hidratar
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState(state);
  }, [state, hydrated]);

  const mcps = useMemo(() => {
    const map = new Map<string, Mcp>();
    for (const mcp of SEED_MCPS) map.set(mcp.id, mcp);
    for (const mcp of state.mine) map.set(mcp.id, mcp);
    return [...map.values()].filter((mcp) => !state.removed.includes(mcp.slug));
  }, [state.mine, state.removed]);

  const upsert = useCallback((mcp: Mcp) => {
    setState((s) => {
      const exists = s.mine.some((m) => m.id === mcp.id);
      return {
        ...s,
        mine: exists ? s.mine.map((m) => (m.id === mcp.id ? mcp : m)) : [mcp, ...s.mine],
        removed: s.removed.filter((slug) => slug !== mcp.slug),
      };
    });
  }, []);

  const save = useCallback(
    (mcp: Mcp) => {
      const next = syncManifest({ ...mcp, updatedAt: isoNow() });
      upsert(next);
    },
    [upsert],
  );

  const saveDraft = useCallback(
    (mcp: Mcp) => {
      const next = syncManifest({ ...mcp, status: 'draft', updatedAt: isoNow() });
      upsert(next);
    },
    [upsert],
  );

  const publish = useCallback(
    (slug: string, options: PublishOptions): Mcp | null => {
      const mcp = mcps.find((m) => m.slug === slug);
      if (!mcp || !options.permissionConfirmed) return null;
      const next = syncManifest({
        ...mcp,
        status: 'published',
        visibility: options.visibility,
        category: options.category,
        tags: options.tags,
        license: options.license,
        updatedAt: isoNow(),
      });
      upsert(next);
      return next;
    },
    [mcps, upsert],
  );

  const publishDraft = useCallback(
    (mcp: Mcp, options: PublishOptions): Mcp | null => {
      if (!options.permissionConfirmed) return null;
      const next = syncManifest({
        ...mcp,
        status: 'published',
        visibility: options.visibility,
        category: options.category,
        tags: options.tags,
        license: options.license,
        updatedAt: isoNow(),
      });
      upsert(next);
      return next;
    },
    [upsert],
  );

  const unpublish = useCallback(
    (slug: string) => {
      const mcp = stateRef.current.mine.find((m) => m.slug === slug) ?? mcps.find((m) => m.slug === slug);
      if (!mcp) return;
      upsert(syncManifest({ ...mcp, status: 'draft', updatedAt: isoNow() }));
    },
    [mcps, upsert],
  );

  const duplicate = useCallback(
    (slug: string): Mcp | null => {
      const mcp = mcps.find((m) => m.slug === slug);
      if (!mcp) return null;
      const now = isoNow();
      const taken = new Set(mcps.map((m) => m.slug));
      let copySlug = `${mcp.slug}-copia`.slice(0, 36);
      let n = 2;
      while (taken.has(copySlug)) copySlug = `${mcp.slug}-copia-${n++}`.slice(0, 40);
      const me = AUTHORS[CURRENT_USER_HANDLE];
      const copy = syncManifest({
        ...structuredClone(mcp),
        id: `m-${Date.now().toString(36)}`,
        slug: copySlug,
        name: `${mcp.name} (copia)`,
        author: me.name,
        authorHandle: me.handle,
        official: false,
        verified: false,
        status: 'draft',
        visibility: 'public',
        installs: 0,
        stars: 0,
        weeklyInstalls: [],
        createdAt: now,
        updatedAt: now,
        versions: [
          { version: mcp.version, publishedAt: now, notes: 'Copia de un MCP existente.', tools: mcp.tools.length, validated: mcp.tools.filter((t) => t.validated).length },
        ],
      });
      upsert(copy);
      return copy;
    },
    [mcps, upsert],
  );

  const remove = useCallback((slug: string) => {
    setState((s) => ({
      ...s,
      mine: s.mine.filter((m) => m.slug !== slug),
      removed: s.removed.includes(slug) ? s.removed : [...s.removed, slug],
    }));
  }, []);

  const discardDraft = useCallback((slug: string) => {
    setState((s) => ({ ...s, mine: s.mine.filter((m) => m.slug !== slug) }));
  }, []);

  const toggleStar = useCallback((slug: string) => {
    setState((s) => ({ ...s, starred: s.starred.includes(slug) ? s.starred.filter((x) => x !== slug) : [slug, ...s.starred] }));
  }, []);

  const toggleSaved = useCallback((slug: string) => {
    setState((s) => ({ ...s, saved: s.saved.includes(slug) ? s.saved.filter((x) => x !== slug) : [slug, ...s.saved] }));
  }, []);

  const updateProfile = useCallback((patch: Partial<Author>) => {
    setState((s) => ({ ...s, profile: { ...(s.profile ?? {}), ...patch } }));
  }, []);

  const finalizeGeneration = useCallback(
    (id: string) => {
      const job = stateRef.current.jobs.find((j) => j.id === id);
      if (!job) return;
      upsert(syncManifest({ ...job.draft, status: 'draft', updatedAt: isoNow() }));
      setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id) }));
      notify(`La generación de ${job.draft.name} ha terminado`, { detail: `${job.draft.tools.filter((t) => t.validated).length} herramientas · guardada como borrador`, icon: 'check' });
    },
    [notify, upsert],
  );

  // Un trabajo sigue avanzando aunque el usuario salga de «Crear» (§8 D).
  useEffect(() => {
    if (!hydrated || state.jobs.length === 0) return;
    const tick = () => {
      const now = Date.now();
      for (const job of stateRef.current.jobs) {
        if (now - job.startedAt >= job.durationMs) finalizeGeneration(job.id);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [hydrated, state.jobs.length, finalizeGeneration]);

  const startGeneration = useCallback((url: URL, options: GenerationOptions): GenerationJob => {
    const run = buildGeneration(url, options);
    const job: GenerationJob = {
      id: `job-${Date.now().toString(36)}`,
      url: url.href,
      slug: run.draft.slug,
      startedAt: Date.now(),
      durationMs: run.durationMs,
      options,
      events: run.events,
      scene: run.scene,
      draft: run.draft,
    };
    setState((s) => ({ ...s, jobs: [job, ...s.jobs] }));
    return job;
  }, []);

  const cancelGeneration = useCallback((id: string) => {
    setState((s) => ({ ...s, jobs: s.jobs.filter((j) => j.id !== id) }));
  }, []);

  const baseUser = AUTHORS[CURRENT_USER_HANDLE];
  const profile = useMemo<Author>(() => {
    const patch = state.profile ?? {};
    return { ...baseUser, ...patch, stats: patch.stats ?? baseUser.stats, activity: patch.activity ?? baseUser.activity };
  }, [baseUser, state.profile]);

  const listMyMcps = useCallback(
    (status?: McpStatus): Mcp[] => {
      if (status === 'preparing') {
        return stateRef.current.jobs.map((job) => ({ ...job.draft, status: 'preparing' as const }));
      }
      return mcps.filter((m) => m.authorHandle === CURRENT_USER_HANDLE && (!status || m.status === status));
    },
    [mcps],
  );

  const value = useMemo<Store>(
    () => ({
      mcps,
      bySlug: (slug) => mcps.find((m) => m.slug === slug),
      byId: (id) => mcps.find((m) => m.id === id),
      save,
      hydrated,
      currentUser: profile,
      profile,
      saved: state.saved,
      starred: state.starred,
      jobs: state.jobs,
      listMyMcps,
      saveDraft,
      publish,
      publishDraft,
      unpublish,
      duplicate,
      remove,
      discardDraft,
      toggleStar,
      toggleSaved,
      isStarred: (slug) => state.starred.includes(slug),
      isSaved: (slug) => state.saved.includes(slug),
      updateProfile,
      startGeneration,
      cancelGeneration,
      finalizeGeneration,
      getJob: (id) => state.jobs.find((j) => j.id === id),
    }),
    [
      mcps,
      save,
      hydrated,
      profile,
      state.saved,
      state.starred,
      state.jobs,
      listMyMcps,
      saveDraft,
      publish,
      publishDraft,
      unpublish,
      duplicate,
      remove,
      discardDraft,
      toggleStar,
      toggleSaved,
      updateProfile,
      startGeneration,
      cancelGeneration,
      finalizeGeneration,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore fuera de StoreProvider');
  return ctx;
}

/** MCPs visibles en el catálogo público. */
export function usePublicCatalog(): Mcp[] {
  const { mcps } = useStore();
  return useMemo(() => mcps.filter((m) => m.status === 'published' && m.visibility === 'public'), [mcps]);
}
