import Link from 'next/link';
import type { Mcp } from '../data/types';
import { formatCompact, validatedTools } from '../lib/format';
import { SiteIcon } from './primitives';
import '../styles/mcp-card.css';

/** Tarjeta del catálogo: inicial, nombre del sitio, descripción, herramientas e instalaciones. */
export function McpCard({ mcp, static: isStatic }: { mcp: Mcp; static?: boolean }) {
  const tools = validatedTools(mcp).length;
  const body = (
    <>
      <div className="mcp-card__head">
        <SiteIcon mcp={mcp} size={48} />
        <div className="mcp-card__id">
          <h3 className="mcp-card__name">{mcp.name}</h3>
          <span className="mcp-card__site mono">{mcp.site}</span>
        </div>
      </div>
      <p className="mcp-card__desc">{mcp.description}</p>
      <dl className="mcp-card__stats mono">
        <div>
          <dd>{tools}</dd>
          <dt>{tools === 1 ? 'herramienta' : 'herramientas'}</dt>
        </div>
        <div>
          <dd>{formatCompact(mcp.installs)}</dd>
          <dt>instalaciones</dt>
        </div>
      </dl>
    </>
  );

  if (isStatic) return <div className="mcp-card">{body}</div>;
  return (
    <Link href={`/mcp/${mcp.slug}`} className="mcp-card">
      {body}
    </Link>
  );
}
