import Link from 'next/link';
import type { Mcp } from '../data/types';
import { ratingOf } from '../lib/catalog';
import { formatCompact, validatedTools } from '../lib/format';
import { Icon } from './Icon';
import { McpBadges } from './Badges';
import { SiteIcon } from './primitives';
import '../styles/mcp-card.css';

/** Fila del índice: web, qué permite hacer y dos señales (valoración y uso). */
export function McpCard({ mcp, variants = [mcp], static: isStatic }: { mcp: Mcp; variants?: Mcp[]; static?: boolean }) {
  const tools = validatedTools(mcp).length;
  const rating = ratingOf(mcp);
  const isNew = mcp.status === 'draft' || mcp.installs === 0;
  const body = (
    <>
      <SiteIcon mcp={mcp} size={34} />
      <div className="mcp-row__main">
        <div className="mcp-row__title">
          <h3>{mcp.name}</h3>
          <McpBadges mcp={mcp} variants={variants} max={1} />
        </div>
        <p className="mcp-row__desc">{mcp.description}</p>
        <span className="mono mcp-row__site">{mcp.site}</span>
      </div>
      <div className="mcp-row__meta mono">
        {isNew ? (
          <span className="mcp-row__new">Nuevo</span>
        ) : (
          <>
            <span className="mcp-row__rating" title={`${rating.average} de 5`}>
              <Icon name="star" size={11} filled />
              {rating.average.toFixed(1)}
            </span>
            <span title={`${tools} acciones disponibles`}>{formatCompact(mcp.installs)} usos</span>
          </>
        )}
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
