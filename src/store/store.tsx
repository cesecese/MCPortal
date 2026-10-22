'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SEED_MCPS } from '../data/mcps';
import type { Mcp, McpReport, RatingSummary, ReportKind, UserComment } from '../data/types';
import { NOW } from '../lib/format';
import { ratingOf, versionsOf } from '../lib/catalog';

const STORAGE_KEY = 'mcportal:mcps:v4';
const COMMENTS_KEY = 'mcportal:comments:v1';

/** Los MCPs creados en la maqueta viven solo en este navegador. */
function loadStored(): Mcp[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Mcp[]) : null;
  } catch {
    return null;
  }
}

function loadComments(): Record<string, UserComment[]> | null {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserComment[]>) : null;
  } catch {
    return null;
  }
}

interface Store {
  mcps: Mcp[];
  bySlug: (slug: string) => Mcp | undefined;
  byId: (id: string) => Mcp | undefined;
  save: (mcp: Mcp) => void;
  rate: (id: string, score: number) => void;
  report: (id: string, kind: ReportKind, detail: string) => void;
  publishPatch: (id: string, changes: string[]) => void;
  commentsFor: (mcpId: string) => UserComment[];
  addComment: (mcpId: string, body: string, parentId?: string) => void;
}

const StoreContext = createContext<Store | null>(null);

function bumpPatch(version: string): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return `${major}.${minor}.${patch + 1}`;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // El servidor pinta los datos de ejemplo; lo guardado se aplica tras hidratar
  const [mcps, setMcps] = useState<Mcp[]>(SEED_MCPS);
  const [hydrated, setHydrated] = useState(false);
  const [comments, setComments] = useState<Record<string, UserComment[]>>({});
  const [commentsHydrated, setCommentsHydrated] = useState(false);
  const commentSeq = useRef(0);

  useEffect(() => {
    const stored = loadStored();
    if (stored) setMcps(stored);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mcps));
    } catch {
      /* ignorado */
    }
  }, [mcps, hydrated]);

  useEffect(() => {
    const stored = loadComments();
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

  const save = useCallback((mcp: Mcp) => {
    const next = { ...mcp, updatedAt: new Date(NOW).toISOString() };
    setMcps((list) => (list.some((m) => m.id === mcp.id) ? list.map((m) => (m.id === mcp.id ? next : m)) : [next, ...list]));
  }, []);

  const rate = useCallback((id: string, score: number) => {
    setMcps((list) =>
      list.map((mcp) => {
        if (mcp.id !== id) return mcp;
        const base = ratingOf(mcp);
        const previous = mcp.myRating;
        const count = base.count + (previous ? 0 : 1);
        const total = base.average * base.count - (previous ?? 0) + score;
        const distribution = [...base.distribution] as RatingSummary['distribution'];
        if (previous) distribution[5 - previous] = Math.max(0, distribution[5 - previous] - 1);
        distribution[5 - score] += 1;
        return {
          ...mcp,
          myRating: score,
          rating: {
            average: Number((total / count).toFixed(1)),
            count,
            distribution,
          },
        };
      }),
    );
  }, []);

  const report = useCallback((id: string, kind: ReportKind, detail: string) => {
    const entry: McpReport = {
      id: `rep-${Date.now()}-${Math.round(Math.random() * 9999)}`,
      kind,
      detail,
      author: 'Tú',
      createdAt: new Date(NOW).toISOString(),
      status: 'open',
    };
    setMcps((list) => list.map((mcp) => (mcp.id === id ? { ...mcp, reports: [entry, ...(mcp.reports ?? [])] } : mcp)));
  }, []);

  const publishPatch = useCallback((id: string, changes: string[]) => {
    setMcps((list) =>
      list.map((mcp) => {
        if (mcp.id !== id) return mcp;
        const nextVersion = bumpPatch(mcp.version);
        const history = versionsOf(mcp);
        const publishedAt = new Date(NOW).toISOString();
        return {
          ...mcp,
          version: nextVersion,
          updatedAt: publishedAt,
          versions: [
            {
              version: nextVersion,
              publishedAt,
              author: 'Tú',
              changes: changes.length ? changes : ['Parche comunitario publicado desde la ficha del MCP.'],
              downloads: 0,
            },
            ...history,
          ],
        };
      }),
    );
  }, []);

  const commentsFor = useCallback((mcpId: string) => comments[mcpId] ?? [], [comments]);

  const addComment = useCallback((mcpId: string, body: string, parentId?: string) => {
    const clean = body.trim();
    if (!clean) return;
    commentSeq.current += 1;
    const entry: UserComment = {
      id: `uc-${Date.now()}-${commentSeq.current}`,
      parentId,
      author: 'Tú',
      createdAt: new Date(NOW).toISOString(),
      body: clean,
    };
    setComments((current) => ({ ...current, [mcpId]: [...(current[mcpId] ?? []), entry] }));
  }, []);

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
    }),
    [mcps, save, rate, report, publishPatch, commentsFor, addComment],
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
