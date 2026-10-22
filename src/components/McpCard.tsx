import Link from 'next/link';
import type { Mcp } from '../data/types';
import { ratingOf } from '../lib/catalog';
import { formatCompact, formatNumber, validatedTools } from '../lib/format';
import { Icon } from './Icon';
import { McpBadges } from './Badges';
import { SiteIcon } from './primitives';
import '../styles/mcp-card.css';

/** Fila del índice: sitio, descripción corta y valoración. Sin tarjeta ni sombra. */
export function McpCard({ mcp, variants = [mcp], static: isStatic }: { mcp: Mcp; variants?: Mcp[]; static?: boolean }) {
  const tools = validatedTools(mcp).length;
  const rating = ratingOf(mcp);
  const body = (
    <>
      <SiteIcon mcp={mcp} size={34} />
      <div className="mcp-row__id">
        <div className="mcp-row__title">
          <h3>{mcp.name}</h3>
          <McpBadges mcp={mcp} variants={variants} max={1} />
        </div>
        <span className="mono mcp-row__site">
          {mcp.site}
          {variants.length > 1 ? ` · ${variants.length} MCPs` : ''}
        </span>
      </div>
      <p className="mcp-row__desc">{mcp.description}</p>
      <div className="mcp-row__meta mono">
        <span className="mcp-row__rating" title={`${formatNumber(rating.count)} valoraciones`}>
          <Icon name="star" size={11} filled />
          {rating.average.toFixed(1)}
          <span className="mcp-row__rating-count">({formatNumber(rating.count)})</span>
        </span>
        <span>
          {tools} {tools === 1 ? 'herramienta' : 'herramientas'}
        </span>
        <span>{formatCompact(mcp.installs)} inst.</span>
      </div>
      {!isStatic && <Icon name="arrowRight" size={15} className="mcp-row__go" />}
    </>
  );

  if (isStatic) return <div className="mcp-row mcp-row--static">{body}</div>;
  return (
    <Link href={`/mcp/${mcp.slug}`} className="mcp-row">
      {body}
    </Link>
  );
}
