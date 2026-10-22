'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AUTHORS } from '../data/authors';
import { SEED_MCPS } from '../data/mcps';
import { CURRENT_USER_HANDLE } from '../data/people';
import { ratingOf, versionsOf } from '../lib/catalog';
import { toManifest } from '../lib/format';
import { buildGeneration } from '../services/generation';
import { emptyState, loadState, persistState, type StoredState } from '../state/storage';
import type { Manifest } from '../types/contract';
import type {
  Author,
  GenerationJob,
  GenerationOptions,
  Mcp,
  McpReport,
  McpStatus,
  PublishOptions,
  RatingSummary,
  ReportKind,
  UserComment,
} from '../types/portal';
import { useToast } from './toast';

const isoNow = () => new Date().toISOString();
const COMMUNITY_KEY = 'mcportal:community:v1';
const COMMENTS_KEY = 'mcportal:comments:v1';

function loadJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function bumpPatch(version: string): string {
  const [major = 0, minor = 0, patch = 0] = version
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  return `${major}.${minor}.${patch + 1}`;
}

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

  /* Comunidad del prototipo anterior: votos, reportes, comentarios y parches. */
  rate: (id: string, score: number) => void;
  report: (id: string, kind: ReportKind, detail: string) => void;
  publishPatch: (id: string, changes: string[]) => void;
  commentsFor: (mcpId: string) => UserComment[];
  addComment: (mcpId: string, body: string, parentId?: string) => void;

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
  const [community, setCommunity] = useState<Record<string, Partial<Mcp>>>({});
  const [comments, setComments] = useState<Record<string, UserComment[]>>({});
  const [commentsHydrated, setCommentsHydrated] = useState(false);
  const commentSeq = useRef(0);

  // El servidor pinta los datos de ejemplo; lo guardado se aplica tras hidratar
  useEffect(() => {
    setState(loadState());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    persistState(state);
  }, [state, hydrated]);

  useEffect(() => {
    const stored = loadJson<Record<string, Partial<Mcp>>>(COMMUNITY_KEY);
    if (stored) setCommunity(stored);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COMMUNITY_KEY, JSON.stringify(community));
    } catch {
      /* ignorado */
    }
  }, [community, hydrated]);

  useEffect(() => {
    const stored = loadJson<Record<string, UserComment[]>>(COMMENTS_KEY);
    if (stored) setComments(stored);
    setCommentsHydrated(true);
  }, []);

  useEffect(() => {
    if (!commentsHydrated) return;
    try {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(comments));
    } catch {
      /* ignorado */
    }
  }, [comments, commentsHydrated]);

  const mcps = useMemo(() => {
    const map = new Map<string, Mcp>();
    for (const mcp of SEED_MCPS) map.set(mcp.id, mcp);
    for (const mcp of state.mine) map.set(mcp.id, mcp);
    return [...map.values()]
      .filter((mcp) => !state.removed.includes(mcp.slug))
      .map((mcp) => (community[mcp.id] ? { ...mcp, ...community[mcp.id] } : mcp));
  }, [state.mine, state.removed, community]);

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

  const rate = useCallback(
    (id: string, score: number) => {
      const mcp = mcps.find((m) => m.id === id);
      if (!mcp) return;
      const base = ratingOf(mcp);
      const previous = mcp.myRating;
      const count = base.count + (previous ? 0 : 1);
      const total = base.average * base.count - (previous ?? 0) + score;
      const distribution = [...base.distribution] as RatingSummary['distribution'];
      if (previous) distribution[5 - previous] = Math.max(0, distribution[5 - previous] - 1);
      distribution[5 - score] += 1;
      setCommunity((current) => ({
        ...current,
        [id]: {
          ...current[id],
          myRating: score,
          rating: { average: Number((total / count).toFixed(1)), count, distribution },
        },
      }));
    },
    [mcps],
  );

  const report = useCallback(
    (id: string, kind: ReportKind, detail: string) => {
      const mcp = mcps.find((m) => m.id === id);
      if (!mcp) return;
      const entry: McpReport = {
        id: `rep-${Date.now()}-${Math.round(Math.random() * 9999)}`,
        kind,
        detail,
        author: 'Tú',
        createdAt: isoNow(),
        status: 'open',
      };
      setCommunity((current) => ({
        ...current,
        [id]: {
          ...current[id],
          reports: [entry, ...(current[id]?.reports ?? mcp.reports ?? [])],
        },
      }));
    },
    [mcps],
  );

  const publishPatch = useCallback(
    (id: string, changes: string[]) => {
      const mcp = mcps.find((m) => m.id === id);
      if (!mcp) return;
      const nextVersion = bumpPatch(mcp.version);
      const publishedAt = isoNow();
      const notes = changes.length
        ? changes.join(' · ')
        : 'Parche comunitario publicado desde la ficha del MCP.';
      const entry = {
        version: nextVersion,
        publishedAt,
        notes,
        tools: mcp.tools.length,
        validated: mcp.tools.filter((tool) => tool.validated).length,
        author: 'Tú',
        changes: changes.length ? changes : [notes],
        downloads: 0,
      };
      setCommunity((current) => ({
        ...current,
        [id]: {
          ...current[id],
          version: nextVersion,
          updatedAt: publishedAt,
          versions: [entry, ...versionsOf(mcp)],
        },
      }));
    },
    [mcps],
  );

  const commentsFor = useCallback((mcpId: string) => comments[mcpId] ?? [], [comments]);

  const addComment = useCallback((mcpId: string, body: string, parentId?: string) => {
    const clean = body.trim();
    if (!clean) return;
    commentSeq.current += 1;
    const entry: UserComment = {
      id: `uc-${Date.now()}-${commentSeq.current}`,
      parentId,
      author: 'Tú',
      createdAt: isoNow(),
      body: clean,
    };
    setComments((current) => ({ ...current, [mcpId]: [...(current[mcpId] ?? []), entry] }));
  }, []);

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
      rate,
      report,
      publishPatch,
      commentsFor,
      addComment,
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
      rate,
      report,
      publishPatch,
      commentsFor,
      addComment,
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
