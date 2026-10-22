'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { McpBadges } from '../components/Badges';
import { Icon } from '../components/Icon';
import { SiteIcon } from '../components/primitives';
import { formatDate, formatNumber, relativeTime, validatedTools } from '../lib/format';
import {
  averageRatingOf,
  freshnessOf,
  latestSourceUpdate,
  openReportsOf,
  ratingOf,
  recommendedOf,
  siteKey,
  siteUrl,
  sortMcps,
} from '../lib/catalog';
import { usePublicCatalog } from '../store/store';
import { NotFound } from './NotFound';
import '../styles/site.css';

export function SitePage() {
  const { site = '' } = useParams<{ site: string }>();
  const catalog = usePublicCatalog();
  const key = siteKey(decodeURIComponent(site));
  const variants = useMemo(() => catalog.filter((mcp) => siteKey(mcp.site) === key), [catalog, key]);

  if (!variants.length) return <NotFound what="web" />;

  const lead = recommendedOf(variants) ?? variants[0];
  const sorted = sortMcps(variants, 'recommended');
  const recommended = recommendedOf(variants);
  const average = averageRatingOf(variants);
  const sourceDate = latestSourceUpdate(variants);
  const outdated = variants.filter((mcp) => freshnessOf(mcp).outdated);
  const openReports = variants.reduce((total, mcp) => total + openReportsOf(mcp).length, 0);

  return (
    <div className="site-page">
      <div className="container">
        <nav className="crumbs mono" aria-label="Ruta">
          <Link href="/">Explorar</Link>
          <span aria-hidden>/</span>
          <span>Web</span>
          <span aria-hidden>/</span>
          <span aria-current="page">{key}</span>
        </nav>

        <header className="site-head">
          <SiteIcon mcp={lead} size={56} />
          <div className="site-head__copy">
            <p className="eyebrow">Web de origen</p>
            <h1>MCPs para {key}</h1>
            <p className="site-head__sub">
              Explora las implementaciones MCP creadas para esta web y descubre qué puedes hacer con cada una.
            </p>
          </div>
          <div className="site-head__actions">
            <a href={siteUrl(lead.site)} className="btn btn--outline" target="_blank" rel="noreferrer">
              Visitar web original <Icon name="arrowUpRight" size={14} />
            </a>
          </div>
        </header>

        <dl className="site-stats">
          <div>
            <dt>MCPs disponibles</dt>
            <dd>{variants.length}</dd>
          </div>
          <div>
            <dt>Valoración media</dt>
            <dd>
              {average.average.toFixed(1)}
              <span className="site-stats__sub">{formatNumber(average.count)} votos</span>
            </dd>
          </div>
          <div>
            <dt>Última comprobación de la web</dt>
            <dd>
              {sourceDate ? formatDate(sourceDate) : '—'}
              <span className="site-stats__sub">{sourceDate ? relativeTime(sourceDate) : 'sin registrar'}</span>
            </dd>
          </div>
        </dl>

        {outdated.length > 0 && (
          <div className="site-notice">
            <Icon name="alert" size={16} />
            <p>
              <strong>Implementaciones desactualizadas.</strong> Hay {outdated.length} {outdated.length === 1 ? 'MCP' : 'MCPs'} que podrían necesitar una
              actualización para seguir funcionando con la web original.
            </p>
          </div>
        )}

        {openReports > 0 && (
          <div className="site-notice">
            <Icon name="alert" size={16} />
            <p>
              <strong>Incidencias abiertas.</strong> Se han comunicado {openReports} problemas relacionados con las
              implementaciones de esta web.
            </p>
          </div>
        )}

        <section className="site-list-section" aria-labelledby="site-list-title">
          <div className="section-head site-list-head">
            <div>
              <h2 id="site-list-title">Implementaciones disponibles</h2>
              <p className="site-list-head__note">Distintas formas de conectar esta web con tu asistente.</p>
            </div>
          </div>

          <div className="site-list">
            {sorted.map((mcp, index) => {
              const tools = validatedTools(mcp);
              const health = freshnessOf(mcp);
              const isRecommended = recommended?.id === mcp.id && variants.length > 1;
              return (
                <Link
                  key={mcp.id}
                  href={`/mcp/${mcp.slug}`}
                  className={`site-item${isRecommended ? ' is-recommended' : ''}`}
                >
                  <span className="site-item__rank mono">{String(index + 1).padStart(2, '0')}</span>
                  <SiteIcon mcp={mcp} size={38} />
                  <div className="site-item__id">
                    <div className="site-item__title">
                      <h3>{mcp.name}</h3>
                      <McpBadges mcp={mcp} variants={variants} />
                    </div>
                    <span className="site-item__author">
                      por <strong>{mcp.author}</strong>
                      {mcp.official ? ' · Oficial' : ''}
                    </span>
                  </div>
                  <p className="site-item__desc">{mcp.description}</p>
                  <div className="site-item__metrics">
                    <span>
                      <Icon name="star" size={11} filled /> {ratingOf(mcp).average.toFixed(1)}
                    </span>
                    <span>v{mcp.version}</span>
                    <span>{tools.length} herramientas</span>
                    <span title={`Publicado ${formatDate(mcp.updatedAt)}`}>
                      <Icon name="clock" size={11} /> {health.ageDays === 0 ? 'hoy' : `hace ${health.ageDays} d`}
                    </span>
                  </div>
                  <Icon name="arrowRight" size={15} className="site-item__go" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
