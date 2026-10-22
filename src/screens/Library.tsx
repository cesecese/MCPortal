'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '../components/Icon';
import { EmptyState, Menu, SiteIcon } from '../components/primitives';
import { McpCard } from '../components/McpCard';
import { categoryOf } from '../data/categories';
import type { Mcp, Visibility } from '../data/types';
import { cx, formatCompact, formatDuration, relativeTime, validatedTools } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from '../store/toast';
import '../styles/library.css';

type Tab = 'published' | 'draft' | 'preparing' | 'saved';

const TABS: { id: Tab; label: string }[] = [
  { id: 'published', label: 'Publicados' },
  { id: 'draft', label: 'Borradores' },
  { id: 'preparing', label: 'En preparación' },
  { id: 'saved', label: 'Guardados' },
];

/** Re-render periódico mientras haya generaciones en curso. */
function useTick(active: boolean, ms = 1000) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

function statusTag(mcp: Mcp) {
  if (mcp.status === 'draft') return <span className="tag tag--warn">borrador</span>;
  if (mcp.visibility === 'unlisted') return <span className="tag">no listado</span>;
  if (mcp.visibility === 'private') return <span className="tag">privado</span>;
  return <span className="tag tag--ok">público</span>;
}

export function Library() {
  const store = useStore();
  const { listMyMcps, jobs, saved, bySlug } = store;
  const router = useRouter();
  const notify = useToast();
  const [tab, setTab] = useState<Tab>('published');
  const [deleting, setDeleting] = useState<Mcp | null>(null);
  const [publishing, setPublishing] = useState<Mcp | null>(null);
  const [permission, setPermission] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('public');

  useEffect(() => {
    if (!deleting && !publishing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDeleting(null);
        setPublishing(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [deleting, publishing]);

  const published = listMyMcps('published');
  const drafts = listMyMcps('draft');
  const savedMcps = saved.map((slug) => bySlug(slug)).filter((m): m is Mcp => Boolean(m));
  const preparing = jobs;
  const tick = preparing.length > 0;
  useTick(tick);

  const counts: Record<Tab, number> = {
    published: published.length,
    draft: drafts.length,
    preparing: preparing.length,
    saved: savedMcps.length,
  };

  const rows = useMemo(() => {
    if (tab === 'published') return published;
    if (tab === 'draft') return drafts;
    return savedMcps;
  }, [tab, published, drafts, savedMcps]);

  const remove = (mcp: Mcp) => {
    store.remove(mcp.slug);
    setDeleting(null);
    notify('MCP eliminado', { detail: `${mcp.slug} ya no está en tu biblioteca`, icon: 'trash' });
  };

  const duplicate = (mcp: Mcp) => {
    const copy = store.duplicate(mcp.slug);
    if (copy) notify('Copia creada como borrador', { detail: copy.slug, icon: 'duplicate' });
  };

  const unpublish = (mcp: Mcp) => {
    store.unpublish(mcp.slug);
    notify('MCP despublicado', { detail: 'vuelve a la pestaña de borradores', icon: 'eyeOff' });
  };

  const confirmPublish = () => {
    if (!publishing) return;
    const publishedMcp = store.publish(publishing.slug, {
      visibility,
      category: publishing.category,
      tags: publishing.tags,
      license: publishing.license,
      permissionConfirmed: permission,
    });
    if (publishedMcp) {
      notify('MCP publicado', { detail: publishedMcp.slug, icon: 'upload' });
      setPublishing(null);
      setPermission(false);
      setTab('published');
    }
  };

  const openPublish = (mcp: Mcp) => {
    setPublishing(mcp);
    setPermission(false);
    setVisibility(mcp.visibility === 'private' ? 'private' : 'public');
  };

  return (
    <div className="container library">
      <header className="library__head">
        <div>
          <p className="eyebrow">Tu espacio</p>
          <h1>Biblioteca</h1>
          <p className="library__lede">
            Lo que has creado, publicado o guardado. Los borradores y los guardados viven en este navegador.
          </p>
        </div>
        <Link href="/crear" className="btn btn--primary btn--lg">
          <Icon name="plus" size={16} /> Crear MCP
        </Link>
      </header>

      <div className="lib-tabs" role="tablist" aria-label="Secciones de la biblioteca">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={cx('lib-tab', tab === item.id && 'is-active')}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            <span className="lib-tab__count mono">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {tab === 'preparing' ? (
        preparing.length ? (
          <ul className="lib-list">
            {preparing.map((job) => {
              const elapsed = Date.now() - job.startedAt;
              const progress = Math.max(2, Math.min(100, (elapsed / job.durationMs) * 100));
              const left = Math.max(0, Math.ceil((job.durationMs - elapsed) / 1000));
              const validated = job.draft.tools.filter((t) => t.validated).length;
              return (
                <li key={job.id} className="lib-row lib-row--job">
                  <SiteIcon mcp={{ name: job.draft.name, icon: job.draft.icon }} size={44} />
                  <div className="lib-row__main">
                    <div className="lib-row__title">
                      <span className="lib-row__name">{job.draft.name}</span>
                      <span className="tag tag--browser">generando</span>
                    </div>
                    <p className="lib-row__desc mono">{job.url}</p>
                    <div className="lib-progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${progress}%` }} />
                    </div>
                    <p className="lib-row__meta">
                      {validated} herramientas validadas · {left > 0 ? `quedan ~${formatDuration(left)}` : 'cerrando…'}
                    </p>
                  </div>
                  <div className="lib-row__actions">
                    <Link href={`/mcp/${job.slug}`} className="btn btn--ghost btn--sm" aria-disabled>
                      Ver borrador
                    </Link>
                    <button className="btn btn--outline btn--sm" onClick={() => store.cancelGeneration(job.id)}>
                      Cancelar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="clock" title="No hay generaciones en curso" actions={<Link href="/crear" className="btn btn--primary">Empezar una</Link>}>
            Si sales de «Crear» mientras el agente explora, el trabajo sigue aquí y termina como borrador con un aviso.
          </EmptyState>
        )
      ) : rows.length ? (
        <ul className="lib-list">
          {rows.map((mcp) => {
            const tools = validatedTools(mcp);
            const category = categoryOf(mcp.category);
            return (
              <li key={mcp.id} className="lib-row">
                <SiteIcon mcp={mcp} size={44} />
                <div className="lib-row__main">
                  <div className="lib-row__title">
                    <Link href={`/mcp/${mcp.slug}`} className="lib-row__name">
                      {mcp.name}
                    </Link>
                    <span className="mono lib-row__slug">{mcp.slug} · v{mcp.version}</span>
                    {statusTag(mcp)}
                  </div>
                  <p className="lib-row__desc">{mcp.description}</p>
                  <p className="lib-row__meta">
                    {category.label} · {tools.length} {tools.length === 1 ? 'herramienta' : 'herramientas'} ·{' '}
                    {formatCompact(mcp.installs)} instalaciones · actualizado {relativeTime(mcp.updatedAt)}
                  </p>
                </div>
                <div className="lib-row__actions">
                  {tab === 'published' && (
                    <>
                      <Link href={`/mcp/${mcp.slug}`} className="btn btn--ghost btn--sm">
                        Abrir
                      </Link>
                      <Link href={`/crear?editar=${mcp.id}`} className="btn btn--outline btn--sm">
                        Editar
                      </Link>
                      <button className="btn btn--ghost btn--sm" onClick={() => unpublish(mcp)}>
                        Despublicar
                      </button>
                    </>
                  )}
                  {tab === 'draft' && (
                    <>
                      <Link href={`/mcp/${mcp.slug}`} className="btn btn--ghost btn--sm">
                        Abrir
                      </Link>
                      <Link href={`/crear?editar=${mcp.id}`} className="btn btn--primary btn--sm">
                        Continuar edición
                      </Link>
                      <button className="btn btn--outline btn--sm" onClick={() => openPublish(mcp)}>
                        Publicar
                      </button>
                    </>
                  )}
                  {tab === 'saved' && (
                    <>
                      <Link href={`/mcp/${mcp.slug}`} className="btn btn--outline btn--sm">
                        Abrir
                      </Link>
                      <button className="btn btn--ghost btn--sm" onClick={() => store.toggleSaved(mcp.slug)}>
                        Quitar
                      </button>
                    </>
                  )}
                  <Menu
                    label={`Acciones de ${mcp.slug}`}
                    trigger={({ toggle, open }) => (
                      <button className="btn btn--ghost btn--sm btn--icon" onClick={toggle} aria-expanded={open} aria-label="Más acciones">
                        <Icon name="more" size={16} />
                      </button>
                    )}
                    items={[
                      {
                        label: 'Duplicar',
                        icon: 'duplicate',
                        onSelect: () => duplicate(mcp),
                      },
                      {
                        label: store.isStarred(mcp.slug) ? 'Quitar estrella' : 'Marcar con estrella',
                        icon: 'star',
                        onSelect: () => {
                          const starred = !store.isStarred(mcp.slug);
                          store.toggleStar(mcp.slug);
                          notify(starred ? 'Marcado con estrella' : 'Estrella quitada', { detail: mcp.slug, icon: 'star' });
                        },
                      },
                      {
                        label: store.isSaved(mcp.slug) ? 'Quitar de guardados' : 'Guardar para luego',
                        icon: 'inbox',
                        onSelect: () => {
                          const savedNext = !store.isSaved(mcp.slug);
                          store.toggleSaved(mcp.slug);
                          notify(savedNext ? 'Guardado en la biblioteca' : 'Quitado de guardados', { detail: mcp.slug, icon: 'inbox' });
                        },
                      },
                      {
                        label: 'Regenerar desde la web',
                        icon: 'git',
                        onSelect: () => router.push(`/crear?url=${encodeURIComponent(mcp.site)}`),
                      },
                      {
                        label: 'Eliminar',
                        icon: 'trash',
                        danger: true,
                        separatorBefore: true,
                        onSelect: () => setDeleting(mcp),
                      },
                    ]}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={tab === 'saved' ? 'inbox' : tab === 'draft' ? 'edit' : 'upload'}
          title={
            tab === 'saved'
              ? 'Todavía no has guardado nada'
              : tab === 'draft'
                ? 'No hay borradores'
                : 'Aún no has publicado ningún MCP'
          }
          actions={
            <>
              <Link href="/" className="btn btn--outline">
                Explorar el catálogo
              </Link>
              <Link href="/crear" className="btn btn--primary">
                <Icon name="plus" size={16} /> Crear un MCP
              </Link>
            </>
          }
        >
          {tab === 'saved'
            ? 'Guarda un MCP desde su ficha o desde el menú de esta biblioteca para tenerlo a mano.'
            : tab === 'draft'
              ? 'Los borradores se quedan en este navegador hasta que los publiques.'
              : 'De URL a herramientas en unos minutos: el MCP aparecerá aquí y en el catálogo.'}
        </EmptyState>
      )}

      {tab === 'published' && rows.length > 0 && (
        <section className="library__more">
          <div className="section-head">
            <h2>Sugerencias para tu siguiente MCP</h2>
            <Link href="/" className="section-head__meta">
              Ver catálogo <Icon name="arrowRight" size={13} />
            </Link>
          </div>
          <div className="mcp-grid">
            {suggestions(store.mcps, published).map((mcp) => (
              <McpCard key={mcp.id} mcp={mcp} />
            ))}
          </div>
        </section>
      )}

      {deleting && (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="dialog__panel">
            <h2 id="delete-title">¿Eliminar {deleting.slug}?</h2>
            <p>
              Se quita de tu biblioteca y de este navegador. Si estaba publicado, deja de aparecer en el catálogo. No se
              puede deshacer.
            </p>
            <div className="dialog__actions">
              <button className="btn btn--ghost" onClick={() => setDeleting(null)}>
                Cancelar
              </button>
              <button className="btn btn--danger" onClick={() => remove(deleting)}>
                <Icon name="trash" size={15} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {publishing && (
        <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="publish-title">
          <div className="dialog__panel">
            <h2 id="publish-title">Publicar {publishing.slug}</h2>
            <p>Se publicará con las herramientas validadas y la clasificación actual.</p>
            <label className="field">
              <span className="field__label">Visibilidad</span>
              <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}>
                <option value="public">Público</option>
                <option value="unlisted">No listado</option>
                <option value="private">Privado</option>
              </select>
            </label>
            <label className="check">
              <input type="checkbox" checked={permission} onChange={(e) => setPermission(e.target.checked)} />
              <span>Confirmo que tengo permiso para automatizar esta web y publicar estas herramientas.</span>
            </label>
            <div className="dialog__actions">
              <button className="btn btn--ghost" onClick={() => setPublishing(null)}>
                Cancelar
              </button>
              <button className="btn btn--primary" onClick={confirmPublish} disabled={!permission}>
                <Icon name="upload" size={15} /> Publicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tres MCPs populares que el usuario aún no tiene publicados. */
function suggestions(mcps: Mcp[], published: Mcp[]): Mcp[] {
  const mine = new Set(published.map((m) => m.slug));
  return mcps
    .filter((m) => m.status === 'published' && m.visibility === 'public' && !mine.has(m.slug))
    .sort((a, b) => b.installs - a.installs)
    .slice(0, 3);
}
