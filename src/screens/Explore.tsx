'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import { EmptyState } from '../components/primitives';
import { Specimen } from '../components/Specimen';
import { categoryOf } from '../data/categories';
import type { Mcp } from '../data/types';
import { formatNumber, validatedTools } from '../lib/format';
import { usePublicCatalog } from '../store/store';
import '../styles/explore.css';

const STEPS = [
  { n: '01', title: 'Explora', body: 'Un agente navega la web como un usuario y registra cada petición.' },
  { n: '02', title: 'Sintetiza', body: 'Las acciones descubiertas se convierten en herramientas tipadas.' },
  { n: '03', title: 'Valida', body: 'Cada herramienta se ejecuta de verdad. Solo pasan las que funcionan.' },
  { n: '04', title: 'Sirve', body: 'Un comando y tu cliente MCP ya puede usar la web como si tuviera API.' },
];

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

function matches(m: Mcp, q: string): boolean {
  if (!q) return true;
  const hay = fold(
    [m.name, m.slug, m.site, m.description, categoryOf(m.category).label, ...m.tags, ...m.tools.flatMap((t) => [t.name, t.description])].join(' '),
  );
  return fold(q)
    .split(/\s+/)
    .every((w) => hay.includes(w));
}

export function Explore() {
  const catalog = usePublicCatalog();
  const params = useSearchParams();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLElement>(null);
  const q = params.get('q') ?? '';

  const setQuery = (value: string) =>
    router.replace(value ? `/?q=${encodeURIComponent(value)}` : '/', { scroll: false });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(
    () => catalog.filter((m) => matches(m, q)).sort((a, b) => b.installs - a.installs),
    [catalog, q],
  );
  const toolCount = useMemo(() => catalog.reduce((n, m) => n + validatedTools(m).length, 0), [catalog]);
  const specimens = catalog.filter((m) => ['openlibrary', 'tienda-demo', 'la-tasca'].includes(m.slug));
  const looksLikeUrl = /\.[a-z]{2,}/i.test(q) && !q.includes(' ');

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">Registro abierto de servidores MCP</p>
            <h1>
              Cualquier web,
              <br />
              <span className="hero__accent">convertida en herramientas</span>
            </h1>
            <p className="hero__lede">
              Pega la URL de una web sin API. Un agente la explora, descubre qué acciones permite y publica un servidor
              MCP con herramientas tipadas y validadas. Se instala con un comando.
            </p>

            <form
              className="search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Icon name="search" size={18} className="search__icon" />
              <input
                ref={searchRef}
                className="search__input"
                type="search"
                value={q}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca una web o una tarea: «reservar mesa», boe.es…"
                aria-label="Buscar MCPs"
              />
              {q ? (
                <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                  <Icon name="x" size={16} />
                </button>
              ) : (
                <kbd className="search__kbd">/</kbd>
              )}
            </form>

            <div className="hero__cta">
              <Link href="/crear" className="btn btn--primary btn--lg">
                <Icon name="plus" size={17} />
                Crear un MCP desde una URL
              </Link>
              <span className="hero__note mono">sin código · unos 3 min</span>
            </div>
          </div>

          <div className="hero__specimen">
            <Specimen mcps={specimens} />
          </div>
        </div>

        <div className="container">
          <ol className="steps-strip">
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className="steps-strip__n mono">{s.n}</span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container catalog" ref={catalogRef} aria-labelledby="catalog-title">
        <div className="section-head">
          <h2 id="catalog-title">{q ? 'Resultados' : 'Catálogo'}</h2>
          <span className="section-head__meta" aria-live="polite">
            {q
              ? `${results.length} de ${catalog.length} MCPs para «${q}»`
              : `${formatNumber(catalog.length)} MCPs · ${formatNumber(toolCount)} herramientas validadas`}
          </span>
        </div>

        {results.length ? (
          <div className="mcp-grid catalog__grid">
            {results.map((m) => (
              <McpCard key={m.id} mcp={m} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search"
            title={`Nadie ha publicado aún un MCP para «${q}»`}
            actions={
              <>
                <button className="btn btn--outline" onClick={() => setQuery('')}>
                  Ver todo el catálogo
                </button>
                <Link href={looksLikeUrl ? `/crear?url=${encodeURIComponent(q)}` : '/crear'} className="btn btn--primary">
                  <Icon name="plus" size={16} /> {looksLikeUrl ? `Crear MCP para ${q}` : 'Crear el primero'}
                </Link>
              </>
            }
          >
            Si la web es pública y no pide login, puedes generarlo en unos minutos y publicarlo para todos.
          </EmptyState>
        )}
      </section>
    </>
  );
}
