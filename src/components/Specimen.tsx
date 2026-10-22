'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Mcp } from '../data/types';
import { cx, formatDuration, signature, validatedTools } from '../lib/format';
import { Icon } from './Icon';
import { KindTag, SiteIcon } from './primitives';
import '../styles/specimen.css';

interface Line {
  kind: 'act' | 'req' | 'tool';
  text: string;
  meta?: string;
  toolKind?: 'http' | 'browser';
}

const TRACES: Record<string, Line[]> = {
  openlibrary: [
    { kind: 'act', text: 'fill [3] "Search" ← zxq_asimov' },
    { kind: 'req', text: 'GET /search.json?q=zxq_asimov', meta: '200' },
    { kind: 'act', text: 'click [9] link "Foundation"' },
    { kind: 'req', text: 'GET /works/OL46125W.json', meta: '200' },
  ],
  'tienda-demo': [
    { kind: 'act', text: 'click [12] "Añadir al carrito"' },
    { kind: 'req', text: 'POST /api/cart → cart_id', meta: '201' },
    { kind: 'req', text: 'POST /api/cart/{cart_id}/items', meta: '200' },
    { kind: 'act', text: 'click [4] "Finalizar compra"' },
  ],
  'la-tasca': [
    { kind: 'act', text: 'fill [2] date ← 2026-10-24' },
    { kind: 'act', text: 'fill [3] people ← zxq_4' },
    { kind: 'req', text: 'POST /reservar  (csrf)', meta: '302' },
    { kind: 'act', text: 'csrf detectado → navegador' },
  ],
};

export function Specimen({ mcps }: { mcps: Mcp[] }) {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const mcp = mcps[index % mcps.length];
  const tools = mcp ? validatedTools(mcp).slice(0, 4) : [];
  const lines: Line[] = mcp
    ? [
        ...(TRACES[mcp.slug] ?? []),
        ...tools.map((t) => ({ kind: 'tool' as const, text: signature(t), toolKind: t.kind })),
      ]
    : [];
  const done = shown >= lines.length;

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setShown(lines.length);
      return;
    }
    const id = window.setTimeout(
      () => {
        if (done) {
          setIndex((i) => i + 1);
          setShown(0);
        } else {
          setShown((s) => s + 1);
        }
      },
      done ? 3800 : shown === 0 ? 500 : 420,
    );
    return () => window.clearTimeout(id);
  }, [shown, done, lines.length]);

  if (!mcp) return null;
  const trace = lines.filter((l) => l.kind !== 'tool');
  const out = lines.filter((l) => l.kind === 'tool');
  const traceShown = Math.min(shown, trace.length);
  const outShown = Math.max(0, shown - trace.length);

  return (
    <figure className="specimen" aria-label="Ejemplo: de una web a un MCP">
      <div className="specimen__bar">
        <span className="specimen__label">
          <span className={cx('dot', !done && 'dot--live')} style={done ? { color: 'var(--ok)' } : undefined} />
          {done ? 'Validado' : shown === 0 ? 'Explorando' : 'Validando'}
        </span>
        <span className="specimen__url">
          <SiteIcon mcp={mcp} size={20} />
          {mcp.site}
        </span>
      </div>

      <div className="specimen__body">
        <div className="specimen__section">
          <div className="specimen__head">Exploración en directo</div>
          <ol className="specimen__trace">
            {trace.map((l, i) => (
              <li key={`${mcp.slug}-${i}`} className={cx(l.kind, i < traceShown && 'is-in')}>
                <span className="specimen__glyph">{l.kind === 'act' ? '›' : '⇄'}</span>
                <span className="specimen__text">{l.text}</span>
                {l.meta && <span className="specimen__status">{l.meta}</span>}
              </li>
            ))}
          </ol>
        </div>

        <div className="specimen__section">
          <div className="specimen__head">
            Herramientas disponibles
            <span>
              {Math.min(outShown, out.length)}/{out.length}
            </span>
          </div>
          <ul className="specimen__tools">
            {out.map((l, i) => (
              <li key={`${mcp.slug}-t${i}`} className={cx(i < outShown && 'is-in')}>
                <Icon name="check" size={13} />
                <code>{l.text}</code>
                <KindTag kind={l.toolKind ?? 'http'} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <figcaption className="specimen__foot">
        <span>
          {validatedTools(mcp).length} de {mcp.exploration.proposed} herramientas validadas · {formatDuration(mcp.exploration.durationSec)}
        </span>
        <Link href={`/mcp/${mcp.slug}`} className="specimen__open">
          Ver MCP <Icon name="arrowRight" size={13} />
        </Link>
      </figcaption>
    </figure>
  );
}
