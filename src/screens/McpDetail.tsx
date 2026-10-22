'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CommandLine, useCopy } from '../components/Code';
import { ReportDialog } from '../components/CommunityDialogs';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import { Avatar, KindTag, Menu, SiteIcon, Sparkline, Tabs, ValidationMeter } from '../components/primitives';
import { RatingStars } from '../components/Rating';
import { ToolItem } from '../components/ToolItem';
import { ValidationPanel } from '../components/ValidationPanel';
import { VersionHistory } from '../components/VersionHistory';
import { categoryOf } from '../data/categories';
import {
  cx,
  formatNumber,
  implMix,
  installCommand,
  relativeTime,
  toManifest,
  validatedTools,
} from '../lib/format';
import { modeOf, ratingOf, siteKey, siteUrl, validationOf, versionsOf } from '../lib/catalog';
import { usePublicCatalog, useStore } from '../store/store';
import { useToast } from '../store/toast';
import { NotFound } from './NotFound';
import '../styles/detail.css';

type InstallTab = 'cli' | 'manifest';
type DetailTab = 'tools' | 'validation' | 'versions' | 'manifest';

export function McpDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { bySlug } = useStore();
  const catalog = usePublicCatalog();
  const notify = useToast();
  const { copy } = useCopy();
  const [tab, setTab] = useState<InstallTab>('cli');
  const [detailTab, setDetailTab] = useState<DetailTab>('tools');
  const [downloading, setDownloading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const mcp = bySlug(slug);

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
  const httpCount = tools.filter((t) => t.kind === 'http').length;
  const rating = ratingOf(mcp);
  const versions = versionsOf(mcp);
  const validation = validationOf(mcp);
  const sitePath = `/web/${encodeURIComponent(siteKey(mcp.site))}`;

  const download = () => {
    setDownloading(true);
    window.setTimeout(() => {
      setDownloading(false);
      notify('manifest.json descargado', { detail: `${mcp.slug} · ${manifestKb} kB · simulado`, icon: 'download' });
    }, 700);
  };

  return (
    <div className="detail">
      {mcp.status === 'draft' && (
        <div className="detail__banner">
          <div className="container detail__banner-inner">
            <span>
              <Icon name="eyeOff" size={15} /> Borrador · Solo tú puedes ver esta página
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
              {mcp.official && (
                <span className="tag tag--ink">
                  <Icon name="shield" size={11} /> Oficial
                </span>
              )}
              {mcp.visibility === 'unlisted' && (
                <span className="tag">
                  <Icon name="link" size={11} /> No listado
                </span>
              )}
              {mcp.status === 'draft' && <span className="tag tag--warn">Borrador</span>}
            </div>
            <p className="detail__desc">{mcp.description}</p>
            <div className="detail__meta">
              <Link href={sitePath} className="detail__site-link" title="Ver implementaciones de esta web">
                <Icon name="globe" size={14} /> <span className="mono">{mcp.site}</span>
                <Icon name="chevronRight" size={12} />
              </Link>
              {mcp.author && (
                <span className="detail__author">
                  <Avatar name={mcp.author} size={18} /> {mcp.author}
                </span>
              )}
              <span>
                <Icon name="clock" size={14} /> v{mcp.version} · Actualizado {relativeTime(mcp.updatedAt)}
              </span>
            </div>
          </div>
          <div className="detail__actions">
            <a href="#instalar" className="btn btn--primary">
              <Icon name="download" size={16} /> Instalar MCP
            </a>
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
            <dt>Valoraciones</dt>
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
              {validation.validated}/{validation.proposed}
              <ValidationMeter validated={validation.validated} proposed={validation.proposed} />
            </dd>
          </div>
        </dl>

        <div className="detail__grid">
          <div className="detail__main detail__main--tabbed">
            <Tabs
              items={[
                { id: 'tools', label: 'Herramientas', count: tools.length },
                { id: 'validation', label: 'Validación', count: validation.validated },
                { id: 'versions', label: 'Versiones', count: versions.length },
              ]}
              value={detailTab}
              onChange={(id) => setDetailTab(id as DetailTab)}
            />

            {detailTab === 'tools' && (
              <section className="detail__tab-panel" aria-labelledby="tools-title">
                <div className="section-head">
                  <h2 id="tools-title">Herramientas disponibles</h2>
                  <span className="section-head__meta">
                    {httpCount} herramientas HTTP · {tools.length - httpCount} herramientas de navegador
                  </span>
                </div>
                <div>
                  {tools.map((t, i) => (
                    <ToolItem key={t.name} tool={t} defaultOpen={i === 0} />
                  ))}
                </div>
                {failed.length > 0 && isDraft && (
                  <details className="detail__failed">
                    <summary>
                      {failed.length} {failed.length === 1 ? 'herramienta no superó' : 'herramientas no superaron'} la validación · Ver motivo
                    </summary>
                    {failed.map((t) => (
                      <ToolItem key={t.name} tool={t} />
                    ))}
                  </details>
                )}
              </section>
            )}

            {detailTab === 'validation' && <ValidationPanel mcp={mcp} />}

            {detailTab === 'versions' && (
              <section className="detail__tab-panel" aria-labelledby="versions-title">
                <div className="section-head">
                  <h2 id="versions-title">Historial de versiones</h2>
                  <span className="section-head__meta">
                    {versions.length} {versions.length === 1 ? 'versión publicada' : 'versiones publicadas'}
                  </span>
                </div>
                <VersionHistory mcp={mcp} />
              </section>
            )}
          </div>

          <aside className="detail__side">
            <section className="panel" id="instalar" aria-labelledby="install-title">
              <h2 id="install-title" className="panel__title">
                Instala este MCP
              </h2>
              <div className="segmented panel__tabs" role="tablist">
                {(
                  [
                    ['cli', 'CLI'],
                    ['manifest', 'Manifiesto'],
                  ] as [InstallTab, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    className={cx(tab === id && 'is-active')}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === 'cli' && (
                <div className="panel__body">
                  <CommandLine command={installCommand(mcp)} />
                  <p className="panel__hint">
                    Añade este MCP a tu cliente compatible mediante la CLI. Una vez configurado, podrás acceder a sus herramientas desde el cliente. Ejemplo:{' '}
                    <code>
                      mcp__{mcp.slug}__{tools[0]?.name}
                    </code>{' '}
                    y {Math.max(0, tools.length - 1)} más.
                  </p>
                </div>
              )}
              {tab === 'manifest' && (
                <div className="panel__body">
                  <p className="panel__hint">
                    Descarga el manifiesto para configurar el MCP con tu propio entorno de ejecución.
                  </p>
                  <button
                    className={cx('btn btn--primary btn--lg panel__download', downloading && 'is-loading')}
                    onClick={download}
                  >
                    {downloading ? <span className="spinner" /> : <Icon name="download" size={16} />}
                    Descargar manifest.json
                  </button>
                  <p className="panel__hint">
                    {manifestKb} kB · Requiere un runtime compatible. Comando de ejemplo: <code>mcportal serve manifest.json</code>
                  </p>
                </div>
              )}
            </section>

            <section className="panel">
              <h2 className="panel__title">Ficha técnica</h2>
              <dl className="facts">
                <div>
                  <dt>Autor</dt>
                  <dd>{mcp.author}</dd>
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
                  <dd className="mono">STDIO</dd>
                </div>
                <div>
                  <dt>Runtime requerido</dt>
                  <dd className="mono">mcportal-runtime 0.4</dd>
                </div>
                <div>
                  <dt>Tipo de implementación</dt>
                  <dd>
                    {httpCount > 0 && <KindTag kind="http" count={httpCount} />}
                    {tools.length - httpCount > 0 && <KindTag kind="browser" count={tools.length - httpCount} />}
                  </dd>
                </div>
                <div>
                  <dt>Autenticación</dt>
                  <dd>No requerida</dd>
                </div>
                <div>
                  <dt>Permisos</dt>
                  <dd>{modeOf(mcp) === 'read_only' ? 'Solo lectura' : 'Lectura y escritura'}</dd>
                </div>
                <div>
                  <dt>Licencia</dt>
                  <dd className="mono">{mcp.license}</dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="detail__section" aria-labelledby="related-title">
            <div className="section-head">
              <h2 id="related-title">MCPs relacionados</h2>
              <Link href="/" className="section-head__meta detail__more">
                Explorar todos los MCPs <Icon name="arrowRight" size={13} />
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
    </div>
  );
}
