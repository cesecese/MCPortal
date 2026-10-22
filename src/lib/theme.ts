import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'mcportal:theme';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function applyStoredTheme() {
  const t = stored();
  if (t) document.documentElement.dataset.theme = t;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? systemTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme === 'dark' ? '#0f0f11' : '#f4f3ee');
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignorado */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
