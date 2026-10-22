'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../lib/theme';
import { Icon } from './Icon';
import { LinenMark, Logo } from './Logo';
import '../styles/shell.css';

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();
  const exploring = pathname === '/' || pathname.startsWith('/mcp/') || pathname.startsWith('/web/');

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="shell">
      <header className="nav">
        <div className="container nav__inner">
          <Link href="/" className="nav__brand" aria-label="MCPortal, inicio">
            <Logo height={16} />
          </Link>

          <nav className="nav__links" aria-label="Principal">
            <Link href="/" className={exploring ? 'nav__link is-active' : 'nav__link'}>
              Explorar
            </Link>
            <Link
              href="/biblioteca"
              className={pathname.startsWith('/biblioteca') ? 'nav__link is-active' : 'nav__link'}
            >
              Biblioteca
            </Link>
          </nav>

          <div className="nav__actions">
            <Link
              href="/biblioteca"
              className={`btn btn--ghost btn--sm btn--icon nav__library-mobile${pathname.startsWith('/biblioteca') ? ' is-active' : ''}`}
              aria-label="Biblioteca"
              title="Biblioteca"
            >
              <Icon name="inbox" size={16} />
            </Link>
            {pathname !== '/crear' && (
              <Link href="/crear" className="btn btn--primary btn--sm">
                <Icon name="plus" size={15} />
                Conectar
              </Link>
            )}
            <button
              className="btn btn--ghost btn--sm btn--icon"
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="shell__main">{children}</main>

      <footer className="footer">
        <div className="container footer__inner">
          <span className="footer__brand">
            <Logo height={12} />
            <span className="footer__sep" aria-hidden>
              /
            </span>
            <span className="footer__muted">webs conectadas a tu asistente</span>
            <span className="footer__by">
              por <LinenMark height={9} />
            </span>
          </span>
          <div className="footer__meta mono">
            <span className="footer__status">
              <span className="dot footer__ok" /> operativo
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
