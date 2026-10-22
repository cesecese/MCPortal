'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import { Specimen } from '../components/Specimen';
import { EmptyState } from '../components/primitives';
import { categoryOf } from '../data/categories';
import type { Mcp } from '../data/types';
import { groupBySite, siteKey } from '../lib/catalog';
import { formatNumber, validatedTools } from '../lib/format';
import { usePublicCatalog } from '../store/store';
import '../styles/explore.css';

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
  const q = params.get('q') ?? '';
  const [term, setTerm] = useState(q);

  // La URL puede cambiar por atrás/adelante, pero nunca mientras se escribe.
  useEffect(() => {
    if (document.activeElement !== searchRef.current) setTerm(q);
  }, [q]);

  const setQuery = (value: string) => {
    setTerm(value);
    router.replace(value ? `/?q=${encodeURIComponent(value)}` : '/', { scroll: false });
  };

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
    () => catalog.filter((m) => matches(m, term)).sort((a, b) => b.installs - a.installs),
    [catalog, term],
  );
  const groups = useMemo(() => groupBySite(catalog), [catalog]);
  const toolCount = useMemo(() => catalog.reduce((n, m) => n + validatedTools(m).length, 0), [catalog]);
  const specimens = catalog.filter((m) => ['openlibrary', 'tienda-demo', 'la-tasca'].includes(m.slug));
  const looksLikeUrl = /\.[a-z]{2,}/i.test(term) && !term.includes(' ');

  return (
    <>
      <section className="hero">
        <div className="container hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">Registro de servidores MCP</p>
            <h1>
              Cualquier web,
              <br />
              <span className="hero__accent">ahora un MCP.</span>
            </h1>
            <p className="hero__lede">
              Busca la web que ya usas o pega su dirección. Si no existe, un agente la explora y publica un MCP con
              herramientas validadas para tu asistente.
            </p>

            <form
              className="search"
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <Icon name="search" size={17} className="search__icon" />
              <input
                ref={searchRef}
                className="search__input"
                type="search"
                value={term}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca una web o una tarea"
                aria-label="Buscar webs"
              />
              {term ? (
                <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
                  <Icon name="x" size={16} />
                </button>
              ) : (
                <kbd className="search__kbd">/</kbd>
              )}
            </form>

            <div className="hero__cta">
              <Link href="/crear" className="btn btn--primary">
                <Icon name="plus" size={15} />
                Conectar una web
              </Link>
              <a href="#catalog" className="hero__link">
                Ver catálogo
                <Icon name="arrowRight" size={14} />
              </a>
            </div>
          </div>

          <div className="hero__specimen">
            <Specimen mcps={specimens} />
          </div>
        </div>
      </section>

      <section className="container catalog" id="catalog" aria-labelledby="catalog-title">
        <div className="section-head">
          <h2 id="catalog-title">{term ? 'Resultados' : 'Catálogo'}</h2>
          <span className="section-head__meta" aria-live="polite">
            {term
              ? `${results.length} de ${catalog.length} para «${term}»`
              : `${formatNumber(catalog.length)} MCPs · ${formatNumber(toolCount)} herramientas validadas`}
          </span>
        </div>

        {results.length ? (
          <div className="mcp-index">
            {results.map((m) => (
              <McpCard key={m.id} mcp={m} variants={groups.get(siteKey(m.site)) ?? [m]} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="search"
            title={term ? `No encontramos «${term}»` : 'Todavía no hay MCPs publicados'}
            actions={
              <>
                {term && (
                  <button className="btn btn--outline" onClick={() => setQuery('')}>
                    Ver todo
                  </button>
                )}
                <Link href={looksLikeUrl ? `/crear?url=${encodeURIComponent(term)}` : '/crear'} className="btn btn--primary">
                  <Icon name="plus" size={15} /> {looksLikeUrl ? 'Conectar esta web' : 'Conectar una web'}
                </Link>
              </>
            }
          >
            {looksLikeUrl
              ? 'Todavía no está conectada. Puedes crear su MCP en unos minutos.'
              : 'Prueba con otra búsqueda o conecta la web que necesitas.'}
          </EmptyState>
        )}
      </section>
    </>
  );
}
