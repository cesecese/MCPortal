'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';
import { LinenMark, Logo, PortalDot } from './Logo';
import '../styles/shell.css';

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="shell">
      <header className="nav">
        <div className="container nav__inner">
          <Link href="/" className="nav__brand" aria-label="MCPortal, inicio">
            <Logo />
          </Link>
          <div className="nav__actions">
            {pathname !== '/crear' && (
              <Link href="/crear" className="btn btn--primary btn--sm">
                <Icon name="plus" size={16} />
                Crear MCP
              </Link>
            )}
            <button
              className="btn btn--ghost btn--sm btn--icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="shell__main">
        {children}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <span className="footer__brand">
            Webs sin API, convertidas en herramientas. Un proyecto de <LinenMark />
          </span>
          <div className="footer__meta mono">
            <span className="footer__status">
              <PortalDot size={7} className="footer__ok" /> Explorador operativo
            </span>
            <span>runtime 0.4.2</span>
            <span>MCP 2025-06-18</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
