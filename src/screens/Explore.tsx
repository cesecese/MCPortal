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
            <p className="eyebrow">De cualquier web a tu asistente</p>
            <h1>
              Convierte cualquier web
              <span className="hero__accent">en un MCP.</span>
            </h1>
            <p className="hero__lede">
              Introduce la URL de una web y deja que un agente la explore. MCPortal descubre y valida sus acciones para
              que puedas utilizarlas desde tu asistente.
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
                placeholder="Busca una web o describe qué quieres hacer…"
                aria-label="Buscar MCPs"
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
                Convertir web en MCP
              </Link>
              <Link href="/como-funciona" className="hero__link">
                Cómo funciona
                <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <p className="hero__note">Sin código · Sin configurar una API · En minutos</p>
          </div>

          <div className="hero__specimen">
            <Specimen mcps={specimens} />
          </div>
        </div>
      </section>

      <section className="container catalog" id="catalog" aria-labelledby="catalog-title">
        <div className="section-head">
          <h2 id="catalog-title">{term ? 'Resultados de búsqueda' : 'Explora los MCPs'}</h2>
          <span className="section-head__meta" aria-live="polite">
            {term
              ? `${results.length} de ${catalog.length} MCPs para «${term}»`
              : `${formatNumber(catalog.length)} MCPs · ${formatNumber(toolCount)} herramientas`}
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
            title={
              !catalog.length
                ? 'El catálogo está esperando sus primeros MCPs'
                : looksLikeUrl
                  ? 'Esta web todavía no tiene un MCP'
                  : `No encontramos «${term}»`
            }
            actions={
              !catalog.length ? (
                <Link href="/crear" className="btn btn--primary">
                  <Icon name="plus" size={15} /> Crear el primer MCP
                </Link>
              ) : looksLikeUrl ? (
                <>
                  <Link href={`/crear?url=${encodeURIComponent(term)}`} className="btn btn--primary">
                    <Icon name="plus" size={15} /> Crear un MCP para esta web
                  </Link>
                  <button className="btn btn--outline" onClick={() => setQuery('')}>
                    Explorar catálogo
                  </button>
                </>
              ) : (
                <>
                  {term && (
                    <button className="btn btn--outline" onClick={() => setQuery('')}>
                      Ver todo
                    </button>
                  )}
                  <Link href="/crear" className="btn btn--primary">
                    <Icon name="plus" size={15} /> Crear un MCP
                  </Link>
                </>
              )
            }
          >
            {!catalog.length
              ? 'Cuando se publiquen los primeros MCPs, aparecerán aquí.'
              : looksLikeUrl
                ? 'Convierte esta web y crea herramientas para utilizarla desde tu asistente.'
                : 'Todavía no hay ningún MCP que coincida con tu búsqueda. Prueba con otros términos o crea uno para la web que necesitas.'}
          </EmptyState>
        )}
      </section>
    </>
  );
}
