'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CommandLine } from '../components/Code';
import { Icon } from '../components/Icon';
import { cx } from '../lib/format';
import '../styles/how.css';

export function HowItWorks() {
  const slides = [
    {
      id: 'intro',
      kicker: 'Onboarding',
      title: (
        <>
          Cualquier web,
          <br />
          <span>ahora un MCP.</span>
        </>
      ),
      body: 'MCPortal convierte una web que ya usas en herramientas que tu asistente entiende: buscar, reservar o consultar. Sin API, sin desarrollo y sin cambiar de web.',
      note: 'En tres pasos.',
      visual: (
        <div className="flow" aria-label="Una web se convierte en un MCP">
          <div className="flow__node">
            <span className="flow__label mono">Web</span>
            <strong>openlibrary.org</strong>
            <span className="flow__meta">sin API</span>
          </div>
          <div className="flow__arrow" aria-hidden>
            <Icon name="arrowRight" size={18} />
          </div>
          <div className="flow__node flow__node--mcp">
            <span className="flow__label mono">MCP</span>
            <strong>Open Library</strong>
            <span className="tag tag--ok">
              <Icon name="check" size={11} /> 6 herramientas
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'url',
      kicker: 'Paso 1 · Sube tu web',
      title: (
        <>
          Pega la URL.
          <br />
          <span>Nosotros hacemos el resto.</span>
        </>
      ),
      body: 'Elige la web que ya usas: tu biblioteca, tu tienda, el BOE o la reserva de tu restaurante favorito. No hace falta que tenga API.',
      note: 'Funciona con webs públicas, sin login.',
      visual: (
        <div className="upload" aria-label="Formulario para pegar una URL">
          <span className="upload__label mono">URL de la web</span>
          <div className="upload__input">
            <Icon name="globe" size={16} />
            <span className="mono">https://openlibrary.org</span>
            <span className="upload__btn">Explorar</span>
          </div>
          <div className="upload__examples">
            <span className="upload__label mono">Ejemplos</span>
            <span className="chip">shop.mcportal.dev</span>
            <span className="chip">reservas.latascalavapies.es</span>
            <span className="chip">boe.es</span>
          </div>
        </div>
      ),
    },
    {
      id: 'explore',
      kicker: 'Paso 2 · La IA explora tu web',
      title: (
        <>
          La IA navega
          <br />
          <span>como lo harías tú.</span>
        </>
      ),
      body: 'Un agente recorre la web, prueba las acciones y descubre qué se puede hacer. Después valida cada herramienta contra la web real.',
      note: 'Solo se publican las herramientas que responden.',
      visual: (
        <div className="trace" aria-label="Traza de exploración de la web">
          <div className="trace__head">
            <span>
              <span className="dot dot--live" /> explorando
            </span>
            <span className="mono">openlibrary.org</span>
          </div>
          <ol className="trace__list">
            <li>
              <span className="trace__glyph">›</span>
              <span>fill [3] &quot;Search&quot; ← &quot;asimov&quot;</span>
            </li>
            <li>
              <span className="trace__glyph trace__glyph--req">⇄</span>
              <span>GET /search.json?q=asimov</span>
              <span className="trace__status">200</span>
            </li>
            <li>
              <span className="trace__glyph">›</span>
              <span>click [9] link &quot;Foundation&quot;</span>
            </li>
            <li>
              <span className="trace__glyph trace__glyph--req">⇄</span>
              <span>GET /works/OL46125W.json</span>
              <span className="trace__status">200</span>
            </li>
          </ol>
          <div className="trace__foot">
            <Icon name="check" size={13} /> 6 de 9 herramientas validadas
          </div>
        </div>
      ),
    },
    {
      id: 'install',
      kicker: 'Paso 3 · Descárgalo y úsalo',
      title: (
        <>
          Tu MCP,
          <br />
          <span>listo para usar.</span>
        </>
      ),
      body: 'Descarga el manifest o instálalo con un comando. Tu asistente ya puede buscar, reservar o consultar por ti.',
      note: 'Compatible con cualquier cliente MCP.',
      visual: (
        <div className="install" aria-label="Instalación del MCP">
          <span className="install__label mono">Instalar</span>
          <CommandLine command="npx -y mcportal add openlibrary" />
          <div className="install__file">
            <Icon name="download" size={16} />
            <strong>manifest.json</strong>
            <span className="mono">4,2 kB</span>
          </div>
        </div>
      ),
    },
  ];

  const last = slides.length - 1;
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  const goTo = (next: number) => setIndex(Math.min(Math.max(next, 0), last));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setIndex((current) => Math.min(current + 1, last));
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last]);

  return (
    <div className="onboarding">
      <div className="container onboarding__inner">
        <div className="onboarding__top">
          <p className="eyebrow">Cómo funciona</p>
          <span className="onboarding__count mono">
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
        </div>

        <div className="onboarding__progress" aria-label="Diapositivas de introducción">
          {slides.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-current={i === index ? 'step' : undefined}
              aria-label={`Ir a la diapositiva ${i + 1}: ${item.kicker}`}
              className={cx('onboarding__bar', i === index && 'is-active', i < index && 'is-done')}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <section
          className="onboarding__slide"
          key={slide.id}
          aria-live="polite"
          aria-label={`Diapositiva ${index + 1} de ${slides.length}`}
        >
          <div className="onboarding__copy">
            <p className="eyebrow">{slide.kicker}</p>
            <h1>{slide.title}</h1>
            <p className="onboarding__lede">{slide.body}</p>
            <p className="onboarding__note">{slide.note}</p>
          </div>
          <div className="onboarding__visual">{slide.visual}</div>
        </section>

        <div className="onboarding__foot">
          {index > 0 ? (
            <button className="btn btn--ghost" onClick={() => goTo(index - 1)}>
              <Icon name="arrowLeft" size={15} /> Anterior
            </button>
          ) : (
            <span />
          )}

          {index < last ? (
            <button className="btn btn--primary" onClick={() => goTo(index + 1)}>
              {index === 0 ? 'Empezar' : 'Siguiente'}
              <Icon name="arrowRight" size={15} />
            </button>
          ) : (
            <div className="onboarding__ctas">
              <Link href="/" className="btn btn--primary">
                Explorar MCPs <Icon name="arrowRight" size={15} />
              </Link>
              <Link href="/crear" className="btn btn--outline">
                Conectar una web
              </Link>
            </div>
          )}
        </div>

        <p className="onboarding__keys mono" aria-hidden>
          Usa ← → para moverte
        </p>
      </div>
    </div>
  );
}
