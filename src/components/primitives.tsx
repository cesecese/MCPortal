'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ImplKind, Mcp, Tool } from '../data/types';
import { cx, signature } from '../lib/format';
import { Icon, type IconName } from './Icon';

/** Inicial del sitio dentro del círculo de la «o» de MCPortal. */
export function Monogram({ mcp, size = 40 }: { mcp: Pick<Mcp, 'name'>; size?: number }) {
  return (
    <span className="monogram" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {mcp.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Favicon de la web en una baldosa, como el icono de una app. Sin favicon, el monograma. */
export function SiteIcon({ mcp, size = 44 }: { mcp: Pick<Mcp, 'name' | 'icon'>; size?: number }) {
  if (!mcp.icon) return <Monogram mcp={mcp} size={size} />;
  return (
    <span className="site-icon" style={{ width: size, height: size, borderRadius: Math.round(size * 0.27) }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mcp.icon} alt="" width={size} height={size} decoding="async" />
    </span>
  );
}

export function KindTag({ kind, count }: { kind: ImplKind | 'mixed'; count?: number }) {
  if (kind === 'mixed') {
    return (
      <span className="tag tag--outline" title="Herramientas HTTP y de navegador">
        HTTP + NAV
      </span>
    );
  }
  return (
    <span
      className={cx('tag', kind === 'http' ? 'tag--http' : 'tag--browser')}
      title={kind === 'http' ? 'Petición HTTP directa' : 'Pasos de navegador (Playwright)'}
    >
      <Icon name={kind === 'http' ? 'bolt' : 'window'} size={11} />
      {kind === 'http' ? 'HTTP' : 'NAV'}
      {count !== undefined && <span style={{ opacity: 0.7 }}>{count}</span>}
    </span>
  );
}

/** Segmentos verdes = herramientas validadas sobre las propuestas por el explorador. */
export function ValidationMeter({ validated, proposed }: { validated: number; proposed: number }) {
  const total = Math.max(proposed, validated);
  return (
    <span className="meter" title={`${validated} de ${total} herramientas validadas`}>
      {Array.from({ length: Math.min(total, 12) }, (_, i) => (
        <span key={i} className={i < Math.round((validated / total) * Math.min(total, 12)) ? 'is-on' : ''} />
      ))}
    </span>
  );
}

export function Sparkline({ data, width = 72, height = 22 }: { data: number[]; width?: number; height?: number }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="sparkline">
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].split(',')[0]} cy={pts[pts.length - 1].split(',')[1]} r="2.2" fill="var(--signal)" />
    </svg>
  );
}

interface MenuItem {
  label: string;
  icon: IconName;
  onSelect: () => void;
  danger?: boolean;
  separatorBefore?: boolean;
}

export function Menu({
  trigger,
  items,
  label,
  header,
  align = 'right',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: MenuItem[];
  label: string;
  header?: ReactNode;
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div className={cx('menu__panel', align === 'left' && 'menu__panel--left')} role="menu" aria-label={label}>
          {header && (
            <>
              <div className="menu__header">{header}</div>
              <div className="menu__sep" />
            </>
          )}
          {items.map((item) => (
            <div key={item.label}>
              {item.separatorBefore && <div className="menu__sep" />}
              <button
                role="menuitem"
                className={cx('menu__item', item.danger && 'menu__item--danger')}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  actions,
}: {
  icon: IconName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__glyph">
        <Icon name={icon} size={20} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className="empty__actions">{actions}</div>}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      className={cx('switch', on && 'is-on')}
      onClick={() => onChange(!on)}
    />
  );
}

/** Pestañas de navegación interna, con contador opcional. */
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string; count?: number }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          aria-selected={value === item.id}
          className={cx('tab', value === item.id && 'is-active')}
          onClick={() => onChange(item.id)}
        >
          {item.label}
          {item.count !== undefined && <span className="tab__count mono">{item.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Diálogo modal nativo. Se cierra con Escape o pulsando el fondo. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog__panel">
        <div className="dialog__head">
          <h2>{title}</h2>
          <button className="btn btn--ghost btn--sm btn--icon" onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__foot">{footer}</div>}
      </div>
    </dialog>
  );
}

/** Inicial de una persona o autor. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      role="img"
      aria-label={name}
      title={name}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Paginación mínima: anterior, posición y siguiente. */
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="Paginación">
      <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <Icon name="arrowLeft" size={14} /> Anterior
      </button>
      <span className="pagination__pos mono">
        {String(page).padStart(2, '0')} / {String(pages).padStart(2, '0')}
      </span>
      <button className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        Siguiente <Icon name="arrowRight" size={14} />
      </button>
    </nav>
  );
}

/** Firma de una herramienta: tipo + nombre y parámetros en mono. */
export function ToolSignature({ tool }: { tool: Tool }) {
  return (
    <span className="tool-signature">
      <KindTag kind={tool.kind} />
      <code>{signature(tool)}</code>
      <span className="tool-signature__ret mono">→ JSON</span>
    </span>
  );
}
