'use client';

import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
export const THEME_KEY = 'mcportal:theme';

/** Se ejecuta en <head> antes de pintar para no parpadear al cargar. */
export const themeBootScript = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const forced = document.documentElement.dataset.theme;
    setTheme(
      forced === 'dark' || forced === 'light'
        ? forced
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light',
    );
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignorado */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
