'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { CodeBlock, CommandLine, useCopy } from '../components/Code';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import { KindTag, Menu, SiteIcon, Sparkline, ValidationMeter } from '../components/primitives';
import { ToolItem } from '../components/ToolItem';
import { categoryOf } from '../data/categories';
import {
  cx,
  formatDate,
  formatDuration,
  formatNumber,
  implMix,
  installCommand,
  relativeTime,
  toManifest,
  validatedTools,
} from '../lib/format';
import { usePublicCatalog, useStore } from '../store/store';
import { useToast } from '../store/toast';
import { NotFound } from './NotFound';
import '../styles/detail.css';

type InstallTab = 'cli' | 'json' | 'manifest';

export function McpDetail() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { bySlug } = useStore();
  const catalog = usePublicCatalog();
  const router = useRouter();
  const notify = useToast();
  const { copy } = useCopy();
  const [tab, setTab] = useState<InstallTab>('cli');
  const [toolQuery, setToolQuery] = useState('');
  const [downloading, setDownloading] = useState(false);

  const mcp = bySlug(slug);
  const related = useMemo(() => {
    if (!mcp) return [];
    const same = catalog.filter((m) => m.id !== mcp.id && m.category === mcp.category);
    const rest = catalog.filter((m) => m.id !== mcp.id && m.category !== mcp.category).sort((a, b) => b.installs - a.installs);
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
          <SiteIcon mcp={mcp} size={72} />
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
            </div>
            <p className="detail__desc">{mcp.description}</p>
            <div className="detail__meta">
              <span>
                <Icon name="globe" size={14} /> <span className="mono">{mcp.site}</span>
              </span>
              {mcp.author && (
                <span>
                  <Icon name="user" size={14} /> {mcp.author}
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
                  label: 'Regenerar desde la web',
                  icon: 'git',
                  onSelect: () => router.push(`/crear?url=${encodeURIComponent(mcp.site)}`),
                },
                {
                  label: 'Informar de un problema',
                  icon: 'alert',
                  separatorBefore: true,
                  onSelect: () => notify('Gracias, lo revisaremos', { detail: 'informe enviado · simulado', icon: 'alert' }),
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
          <div>
            <dt>Exploración</dt>
            <dd>{formatDuration(mcp.exploration.durationSec)}</dd>
          </div>
        </dl>

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

            <section aria-labelledby="gen-title" className="detail__section">
              <div className="section-head">
                <h2 id="gen-title">Cómo se generó</h2>
                <span className="section-head__meta">exploración autónoma · sin clics humanos</span>
              </div>
              <ol className="pipeline">
                <li>
                  <span className="pipeline__n mono">01</span>
                  <div>
                    <strong>Explorador</strong>
                    <p>
                      {mcp.exploration.steps} acciones en {mcp.site}, {mcp.exploration.requests} peticiones capturadas
                      y atribuidas a cada acción con valores centinela.
                    </p>
                  </div>
                  <span className="pipeline__v mono">{formatDuration(mcp.exploration.durationSec)}</span>
                </li>
                <li>
                  <span className="pipeline__n mono">02</span>
                  <div>
                    <strong>Sintetizador</strong>
                    <p>
                      {mcp.exploration.proposed} herramientas propuestas, con nombres, esquemas y dependencias
                      explícitas.
                    </p>
                  </div>
                  <span className="pipeline__v mono">{mcp.exploration.proposed} propuestas</span>
                </li>
                <li>
                  <span className="pipeline__n mono">03</span>
                  <div>
                    <strong>Validador</strong>
                    <p>Cada herramienta se ejecutó con entradas de ejemplo. Solo se publican las que respondieron bien.</p>
                  </div>
                  <span className="pipeline__v mono pipeline__v--ok">{tools.length} validadas</span>
                </li>
              </ol>
            </section>

            <section aria-labelledby="manifest-title" className="detail__section">
              <div className="section-head">
                <h2 id="manifest-title">manifest.json</h2>
                <span className="section-head__meta">{manifestKb} kB · lo lee el runtime genérico</span>
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

            <section className="panel">
              <h2 className="panel__title">Ficha técnica</h2>
              <dl className="facts">
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
                  <dt>Versión</dt>
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

        {related.length > 0 && (
          <section className="detail__section" aria-labelledby="related-title">
            <div className="section-head">
              <h2 id="related-title">También te puede servir</h2>
              <Link href="/" className="section-head__meta detail__more">
                Todo el catálogo <Icon name="arrowRight" size={13} />
              </Link>
            </div>
            <div className="mcp-grid related">
              {related.map((m) => (
                <McpCard key={m.id} mcp={m} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
