'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { SEED_MCPS } from '../data/mcps';
import type { Mcp } from '../data/types';
import { NOW } from '../lib/format';

const STORAGE_KEY = 'mcportal:mcps:v3';

/** Los MCPs creados en la maqueta viven solo en este navegador. */
function loadStored(): Mcp[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Mcp[]) : null;
  } catch {
    return null;
  }
}

interface Store {
  mcps: Mcp[];
  bySlug: (slug: string) => Mcp | undefined;
  byId: (id: string) => Mcp | undefined;
  save: (mcp: Mcp) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  // El servidor pinta los datos de ejemplo; lo guardado se aplica tras hidratar
  const [mcps, setMcps] = useState<Mcp[]>(SEED_MCPS);
  const [hydrated, setHydrated] = useState(false);

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

  const save = useCallback((mcp: Mcp) => {
    const next = { ...mcp, updatedAt: new Date(NOW).toISOString() };
    setMcps((list) => (list.some((m) => m.id === mcp.id) ? list.map((m) => (m.id === mcp.id ? next : m)) : [next, ...list]));
  }, []);

  const value = useMemo<Store>(
    () => ({
      mcps,
      bySlug: (slug) => mcps.find((m) => m.slug === slug),
      byId: (id) => mcps.find((m) => m.id === id),
      save,
    }),
    [mcps, save],
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
