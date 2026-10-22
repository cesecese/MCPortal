'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { McpBadges } from '../components/Badges';
import { CodeBlock, CommandLine, useCopy } from '../components/Code';
import { Comments } from '../components/Comments';
import { PatchDialog, ReportDialog } from '../components/CommunityDialogs';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import { Avatar, KindTag, Menu, SiteIcon, Sparkline, ValidationMeter } from '../components/primitives';
import { RatingPanel, RatingStars } from '../components/Rating';
import { ToolItem } from '../components/ToolItem';
import { VersionHistory } from '../components/VersionHistory';
import { categoryOf } from '../data/categories';
import type { ReportKind } from '../data/types';
import {
  cx,
  formatDate,
  formatNumber,
  implMix,
  installCommand,
  relativeTime,
  toManifest,
  validatedTools,
} from '../lib/format';
import {
  freshnessOf,
  openReportsOf,
  ratingOf,
  reportsOf,
  siteKey,
  siteUrl,
  siteVariants,
  versionsOf,
} from '../lib/catalog';
import { usePublicCatalog, useStore } from '../store/store';
import { useToast } from '../store/toast';
import { NotFound } from './NotFound';
import '../styles/detail.css';

type InstallTab = 'cli' | 'json' | 'manifest';

const REPORT_LABEL: Record<ReportKind, string> = {
  broken: 'No funciona',
  tool: 'Herramienta con errores',
  outdated: 'Web desactualizada',
  other: 'Otro problema',
};

export function McpDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { bySlug, rate } = useStore();
  const catalog = usePublicCatalog();
  const router = useRouter();
  const notify = useToast();
  const { copy } = useCopy();
  const [tab, setTab] = useState<InstallTab>('cli');
  const [toolQuery, setToolQuery] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [patchOpen, setPatchOpen] = useState(false);

  const mcp = bySlug(slug);
  const siteMcps = useMemo(() => {
    if (!mcp) return [];
    return siteVariants(mcp, catalog);
  }, [catalog, mcp]);

  const related = useMemo(() => {
    if (!mcp) return [];
    const ownSite = siteKey(mcp.site);
    const same = catalog.filter(
      (m) => m.id !== mcp.id && siteKey(m.site) !== ownSite && m.category === mcp.category,
    );
    const rest = catalog
      .filter((m) => m.id !== mcp.id && siteKey(m.site) !== ownSite && m.category !== mcp.category)
      .sort((a, b) => b.installs - a.installs);
    return [...same, ...rest].slice(0, 3);
  }, [catalog, mcp]);

  if (!mcp) return <NotFound what="MCP" />;

  const isDraft = mcp.status === 'draft';
  const tools = validatedTools(mcp);
  const failed = mcp.tools.filter((t) => !t.validated);
  const manifest = toManifest(mcp);
  const manifestKb = (new Blob([manifest]).size / 1024).toFixed(1).replace('.', ',');
  const category = categoryOf(mcp.category);
  const q = toolQuery.trim().toLowerCase();
  const visibleTools = q ? tools.filter((t) => `${t.name} ${t.description}`.toLowerCase().includes(q)) : tools;
  const httpCount = tools.filter((t) => t.kind === 'http').length;
  const rating = ratingOf(mcp);
  const health = freshnessOf(mcp);
  const reports = reportsOf(mcp);
  const openReports = openReportsOf(mcp);
  const versions = versionsOf(mcp);
  const otherVariants = siteMcps.filter((item) => item.id !== mcp.id);
  const sitePath = `/web/${encodeURIComponent(siteKey(mcp.site))}`;

  const jsonConfig = JSON.stringify(
    { mcpServers: { [mcp.slug]: { command: 'npx', args: ['-y', 'mcportal', 'run', mcp.slug] } } },
    null,
    2,
  );

  const download = () => {
    setDownloading(true);
    window.setTimeout(() => {
      setDownloading(false);
      notify('manifest.json descargado', { detail: `${mcp.slug} · ${manifestKb} kB · simulado`, icon: 'download' });
    }, 700);
  };

  const submitRating = (score: number) => {
    rate(mcp.id, score);
    notify('Valoración guardada', {
      detail: `${score} de 5 estrellas · gracias por ayudar al resto`,
      icon: 'star',
    });
  };

  return (
    <div className="detail">
      {mcp.status === 'draft' && (
        <div className="detail__banner">
          <div className="container detail__banner-inner">
            <span>
              <Icon name="eyeOff" size={15} /> Borrador · solo tú puedes ver esta página
            </span>
            <Link href={`/crear?editar=${mcp.id}`} className="btn btn--primary btn--sm">
              <Icon name="edit" size={14} /> Continuar edición
            </Link>
          </div>
        </div>
      )}

      <div className="container">
        <nav className="crumbs mono" aria-label="Ruta">
          <Link href="/">Explorar</Link>
          <span aria-hidden>/</span>
          <span>{category.label}</span>
          <span aria-hidden>/</span>
          <span aria-current="page">{mcp.name}</span>
        </nav>

        <header className="detail__head">
          <SiteIcon mcp={mcp} size={56} />
          <div className="detail__title">
            <div className="detail__name-row">
              <h1>{mcp.name}</h1>
              <span className="tag tag--outline">
                {mcp.slug} · v{mcp.version}
              </span>
              {mcp.official && (
                <span className="tag tag--ink">
                  <Icon name="shield" size={11} /> oficial
                </span>
              )}
              {mcp.visibility === 'unlisted' && (
                <span className="tag">
                  <Icon name="link" size={11} /> no listado
                </span>
              )}
              <McpBadges mcp={mcp} variants={siteMcps} />
            </div>
            <p className="detail__desc">{mcp.description}</p>
            <div className="detail__meta">
              <Link href={sitePath} className="detail__site-link" title="Ver todas las implementaciones de esta web">
                <Icon name="globe" size={14} /> <span className="mono">{mcp.site}</span>
                <Icon name="chevronRight" size={12} />
              </Link>
              {mcp.author && (
                <span className="detail__author">
                  <Avatar name={mcp.author} size={18} /> {mcp.author}
                  <span className="tag tag--outline">Autor</span>
                </span>
              )}
              <span>
                <Icon name="clock" size={14} /> Actualizado {relativeTime(mcp.updatedAt)}
              </span>
            </div>
          </div>
          <div className="detail__actions">
            <a href="#instalar" className="btn btn--primary">
              <Icon name="download" size={16} /> Instalar
            </a>
            <button className="btn btn--outline" onClick={() => setPatchOpen(true)}>
              <Icon name="git" size={15} /> Parchear
            </button>
            <Menu
              label="Más acciones"
              trigger={({ toggle, open }) => (
                <button className="btn btn--outline btn--icon" onClick={toggle} aria-expanded={open} aria-label="Más acciones">
                  <Icon name="more" size={16} />
                </button>
              )}
              items={[
                { label: 'Copiar enlace', icon: 'link', onSelect: () => copy(window.location.href, 'Enlace copiado') },
                { label: 'Descargar manifest.json', icon: 'download', onSelect: download },
                {
                  label: 'Ver todas las implementaciones',
                  icon: 'layers',
                  onSelect: () => router.push(sitePath),
                },
                {
                  label: 'Crear una alternativa',
                  icon: 'plus',
                  onSelect: () => router.push(`/crear?url=${encodeURIComponent(siteUrl(mcp.site))}`),
                },
                {
                  label: 'Regenerar desde la web',
                  icon: 'git',
                  onSelect: () => router.push(`/crear?url=${encodeURIComponent(mcp.site)}`),
                },
                {
                  label: 'Informar de un problema',
                  icon: 'alert',
                  separatorBefore: true,
                  onSelect: () => setReportOpen(true),
                },
              ]}
            />
          </div>
        </header>

        <dl className="detail__stats">
          <div>
            <dt>Instalaciones</dt>
            <dd>
              {formatNumber(mcp.installs)}
              <Sparkline data={mcp.weeklyInstalls} width={64} height={18} />
            </dd>
          </div>
          <div>
            <dt>Valoración</dt>
            <dd>
              {rating.average.toFixed(1)}
              <span className="detail__stat-sub">
                <RatingStars value={rating.average} size={12} />
                <span>{formatNumber(rating.count)}</span>
              </span>
            </dd>
          </div>
          <div>
            <dt>Herramientas</dt>
            <dd>
              {tools.length}
              <span className="detail__stat-sub">
                <KindTag kind={implMix(tools)} />
              </span>
            </dd>
          </div>
          <div>
            <dt>Validación</dt>
            <dd>
              {tools.length}/{mcp.exploration.proposed}
              <ValidationMeter validated={tools.length} proposed={mcp.exploration.proposed} />
            </dd>
          </div>
        </dl>

        <div className="detail__health">
          <section className={cx('health-card', health.outdated && 'health-card--warn')} aria-labelledby="update-title">
            <div className="health-card__head">
              <h2 id="update-title">Actualización</h2>
              <span className={cx('tag', health.outdated ? 'tag--warn' : 'tag--ok')}>
                {health.outdated ? 'Desactualizado' : 'Al día'}
              </span>
            </div>
            <div className="health-card__dates">
              <div>
                <span>Último MCP</span>
                <strong className="mono">v{mcp.version}</strong>
                <small>
                  {formatDate(mcp.updatedAt)} · {relativeTime(mcp.updatedAt)}
                </small>
              </div>
              <div>
                <span>Web original</span>
                <strong className="mono">{mcp.sourceUpdatedAt ? formatDate(mcp.sourceUpdatedAt) : '—'}</strong>
                <small>
                  {mcp.sourceUpdatedAt ? `${relativeTime(mcp.sourceUpdatedAt)} · última detección` : 'sin comprobaciones'}
                </small>
              </div>
            </div>
            <p className="health-card__note">
              {health.outdated
                ? health.reason === 'source'
                  ? `La web se actualizó ${health.sourceGapDays} días después de la última versión del MCP. Conviene revisar las herramientas antes de instalarlo.`
                  : `Hace ${health.ageDays} días que no se publica una versión. El MCP necesita una revalidación contra la web.`
                : mcp.sourceUpdatedAt
                  ? 'No se han detectado cambios en la web desde la última publicación conocida.'
                  : 'No hay una fecha de actualización de la web registrada para este MCP.'}
            </p>
            <div className="health-card__foot">
              <span className={cx('health-card__status', openReports.length > 0 && 'is-danger')}>
                <Icon name={openReports.length ? 'alert' : 'check'} size={13} />
                {openReports.length
                  ? `${openReports.length} ${openReports.length === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`
                  : 'Sin incidencias abiertas'}
              </span>
              <div className="health-card__actions">
                <button className="btn btn--ghost btn--sm" onClick={() => setReportOpen(true)}>
                  Reportar
                </button>
                <button className="btn btn--outline btn--sm" onClick={() => setPatchOpen(true)}>
                  <Icon name="git" size={13} /> Proponer parche
                </button>
              </div>
            </div>
            {reports.length > 0 && (
              <details className="health-card__reports">
                <summary>
                  {reports.length} {reports.length === 1 ? 'informe' : 'informes'} · ver detalle
                </summary>
                <ul>
                  {reports.slice(0, 4).map((item) => (
                    <li key={item.id}>
                      <div>
                        <strong>{REPORT_LABEL[item.kind]}</strong>
                        <p>{item.detail}</p>
                        <span className="mono">
                          {item.author} · {relativeTime(item.createdAt)}
                        </span>
                      </div>
                      <span className={cx('tag', item.status === 'open' ? 'tag--danger' : 'tag--ok')}>
                        {item.status === 'open' ? 'abierto' : 'resuelto'}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <RatingPanel mcp={mcp} onRate={submitRating} />
        </div>

        <div className="detail__grid">
          <div className="detail__main">
            <section aria-labelledby="tools-title">
              <div className="section-head">
                <h2 id="tools-title">Herramientas</h2>
                <span className="section-head__meta">
                  {httpCount} HTTP · {tools.length - httpCount} navegador
                </span>
              </div>
              {tools.length > 4 && (
                <div className="detail__tool-search">
                  <Icon name="search" size={15} />
                  <input
                    className="input"
                    placeholder="Filtrar herramientas"
                    value={toolQuery}
                    onChange={(e) => setToolQuery(e.target.value)}
                    aria-label="Filtrar herramientas"
                  />
                </div>
              )}
              <div>
                {visibleTools.map((t, i) => (
                  <ToolItem key={t.name} tool={t} defaultOpen={i === 0 && !q} />
                ))}
                {!visibleTools.length && <p className="detail__none">Ninguna herramienta coincide con «{toolQuery}».</p>}
              </div>
              {failed.length > 0 && isDraft && (
                <details className="detail__failed">
                  <summary>
                    {failed.length} {failed.length === 1 ? 'herramienta descartada' : 'herramientas descartadas'} por el
                    validador
                  </summary>
                  {failed.map((t) => (
                    <ToolItem key={t.name} tool={t} />
                  ))}
                </details>
              )}
            </section>

            <section aria-labelledby="versions-title" className="detail__section">
              <div className="section-head">
                <h2 id="versions-title">Historial de versiones</h2>
                <div className="detail__section-actions">
                  <span className="section-head__meta">
                    {versions.length} {versions.length === 1 ? 'publicación' : 'publicaciones'}
                  </span>
                  <button className="btn btn--outline btn--sm" onClick={() => setPatchOpen(true)}>
                    <Icon name="git" size={13} /> Proponer parche
                  </button>
                </div>
              </div>
              <VersionHistory mcp={mcp} />
            </section>

            <section aria-labelledby="manifest-title" className="detail__section">
              <div className="section-head">
                <h2 id="manifest-title">manifest.json</h2>
                <span className="section-head__meta">contrato del runtime</span>
              </div>
              <div className="detail__manifest">
                <CodeBlock code={manifest} title="manifest.json" maxHeight={360} lineNumbers />
              </div>
            </section>
          </div>

          <aside className="detail__side">
            <section className="panel" id="instalar" aria-labelledby="install-title">
              <h2 id="install-title" className="panel__title">
                Instalar
              </h2>
              <div className="segmented panel__tabs" role="tablist">
                {(
                  [
                    ['cli', 'CLI'],
                    ['json', 'Config JSON'],
                    ['manifest', 'Manifiesto'],
                  ] as [InstallTab, string][]
                ).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={tab === id} className={cx(tab === id && 'is-active')} onClick={() => setTab(id)}>
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'cli' && (
                <div className="panel__body">
                  <CommandLine command={installCommand(mcp)} />
                  <p className="panel__hint">
                    Registra el servidor en tu cliente MCP. En su panel de herramientas verás{' '}
                    <code>
                      mcp__{mcp.slug}__{tools[0]?.name}
                    </code>{' '}
                    y {Math.max(0, tools.length - 1)} más.
                  </p>
                </div>
              )}
              {tab === 'json' && (
                <div className="panel__body">
                  <CodeBlock code={jsonConfig} title=".mcp.json" />
                  <p className="panel__hint">Formato estándar <code>mcpServers</code>, válido para cualquier cliente MCP por stdio.</p>
                </div>
              )}
              {tab === 'manifest' && (
                <div className="panel__body">
                  <button className={cx('btn btn--primary btn--lg panel__download', downloading && 'is-loading')} onClick={download}>
                    {downloading ? <span className="spinner" /> : <Icon name="download" size={16} />}
                    Descargar manifest.json
                  </button>
                  <p className="panel__hint">
                    {manifestKb} kB. Ejecútalo con tu propio runtime: <code>mcportal serve manifest.json</code>
                  </p>
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="contribute-title">
              <h2 id="contribute-title" className="panel__title">
                Contribuir
              </h2>
              <p className="panel__hint">
                Este MCP lo mantiene <strong>{mcp.author}</strong>. Puedes corregirlo con un parche o publicar una
                alternativa completa para la misma web.
              </p>
              <button className="btn btn--outline panel__download" onClick={() => setPatchOpen(true)}>
                <Icon name="git" size={15} /> Proponer un parche
              </button>
              <Link
                href={`/crear?url=${encodeURIComponent(siteUrl(mcp.site))}`}
                className="btn btn--ghost panel__download"
              >
                <Icon name="plus" size={15} /> Crear una alternativa
              </Link>
            </section>

            <section className="panel">
              <h2 className="panel__title">Ficha técnica</h2>
              <dl className="facts">
                <div>
                  <dt>Autor</dt>
                  <dd>
                    {mcp.author} <span className="tag tag--outline">Propietario</span>
                  </dd>
                </div>
                <div>
                  <dt>Web de origen</dt>
                  <dd>
                    <a href={siteUrl(mcp.site)} className="detail__external" target="_blank" rel="noreferrer">
                      {mcp.site} <Icon name="arrowUpRight" size={11} />
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Transporte</dt>
                  <dd className="mono">stdio</dd>
                </div>
                <div>
                  <dt>Runtime</dt>
                  <dd className="mono">mcportal-runtime 0.4</dd>
                </div>
                <div>
                  <dt>Implementación</dt>
                  <dd>
                    {httpCount > 0 && <KindTag kind="http" count={httpCount} />}
                    {tools.length - httpCount > 0 && <KindTag kind="browser" count={tools.length - httpCount} />}
                  </dd>
                </div>
                <div>
                  <dt>Necesita navegador</dt>
                  <dd>{tools.length - httpCount > 0 ? 'Sí · Chromium headless' : 'No'}</dd>
                </div>
                <div>
                  <dt>Autenticación</dt>
                  <dd>Ninguna</dd>
                </div>
                <div>
                  <dt>Licencia</dt>
                  <dd className="mono">{mcp.license}</dd>
                </div>
                <div>
                  <dt>Versiones</dt>
                  <dd className="mono">{versions.length}</dd>
                </div>
                <div>
                  <dt>Última versión</dt>
                  <dd className="mono">
                    {mcp.version} · {formatDate(mcp.updatedAt)}
                  </dd>
                </div>
              </dl>
            </section>

            {mcp.tags.length > 0 && (
              <section className="panel">
                <h2 className="panel__title">Etiquetas</h2>
                <div className="detail__tags">
                  {mcp.tags.map((t) => (
                    <Link key={t} href={`/?q=${encodeURIComponent(t)}`} className="chip">
                      {t}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>

        <Comments mcp={mcp} />

        {otherVariants.length > 0 && (
          <section className="detail__section" aria-labelledby="alternatives-title">
            <div className="section-head">
              <h2 id="alternatives-title">Alternativas en {mcp.site}</h2>
              <Link href={sitePath} className="section-head__meta detail__more">
                Comparar {siteMcps.length} implementaciones <Icon name="arrowRight" size={13} />
              </Link>
            </div>
            <p className="detail__alternatives-note">
              {mcp.name} no es la única implementación para esta web. Revisa la valoración, la fecha de actualización
              y las incidencias de cada una antes de elegir.
            </p>
            <div className="mcp-index">
              {otherVariants.map((m) => (
                <McpCard key={m.id} mcp={m} variants={siteMcps} />
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="detail__section" aria-labelledby="related-title">
            <div className="section-head">
              <h2 id="related-title">Relacionados</h2>
              <Link href="/" className="section-head__meta detail__more">
                Todo el catálogo <Icon name="arrowRight" size={13} />
              </Link>
            </div>
            <div className="mcp-index">
              {related.map((m) => (
                <McpCard key={m.id} mcp={m} />
              ))}
            </div>
          </section>
        )}
      </div>

      <ReportDialog mcp={mcp} open={reportOpen} onClose={() => setReportOpen(false)} />
      <PatchDialog mcp={mcp} open={patchOpen} onClose={() => setPatchOpen(false)} />
    </div>
  );
}
