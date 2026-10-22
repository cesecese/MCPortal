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
      kicker: 'De web a MCP',
      title: (
        <>
          Tu web,
          <br />
          <span>al alcance de tu asistente.</span>
        </>
      ),
      body: 'MCPortal transforma webs en herramientas que tu asistente puede utilizar. Un agente explora la página, identifica sus acciones y comprueba cuáles funcionan. Sin necesidad de una API propia.',
      note: 'Tres pasos. Sin código.',
      visual: (
        <div className="flow" aria-label="Una web se convierte en un MCP">
          <div className="flow__node">
            <span className="flow__label mono">Web</span>
            <strong>openlibrary.org</strong>
            <span className="flow__meta">Sin API propia</span>
          </div>
          <div className="flow__arrow" aria-hidden>
            <Icon name="arrowRight" size={18} />
          </div>
          <div className="flow__node flow__node--mcp">
            <span className="flow__label mono">MCP</span>
            <strong>Open Library MCP</strong>
            <span className="tag tag--ok">
              <Icon name="check" size={11} /> 6 herramientas validadas
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'url',
      kicker: 'Paso 1 · Elige una web',
      title: <>Empieza con una URL.</>,
      body: 'Puede ser tu biblioteca, una tienda, el BOE o la web de tu restaurante favorito. Introduce la dirección y MCPortal se encarga de explorarla.',
      note: 'Compatible con webs públicas accesibles sin iniciar sesión.',
      visual: (
        <div className="upload" aria-label="Formulario para pegar una URL">
          <span className="upload__label mono">URL de la web</span>
          <div className="upload__input">
            <Icon name="globe" size={16} />
            <span className="mono">https://openlibrary.org</span>
            <span className="upload__btn">Explorar web</span>
          </div>
          <div className="upload__examples">
            <span className="upload__label mono">Probar con un ejemplo</span>
            <span className="chip">openlibrary.org</span>
            <span className="chip">boe.es</span>
            <span className="chip">shop.mcportal.dev</span>
          </div>
        </div>
      ),
    },
    {
      id: 'explore',
      kicker: 'Paso 2 · Explora y valida',
      title: (
        <>
          La IA descubre
          <br />
          <span>lo que puedes hacer.</span>
        </>
      ),
      body: 'Un agente navega por la web, prueba sus acciones y las convierte en herramientas para tu asistente. Cada herramienta se comprueba contra la web real antes de poder publicarse.',
      note: 'Solo las herramientas que superan la validación pueden publicarse como validadas.',
      visual: (
        <div className="trace" aria-label="Traza de exploración de la web">
          <div className="trace__head">
            <span>
              <span className="dot dot--live" /> Explorando
            </span>
            <span className="mono">openlibrary.org</span>
          </div>
          <ol className="trace__list">
            <li>
              <span className="trace__glyph">›</span>
              <span>fill [3] · Campo «Search» · Valor: «asimov»</span>
            </li>
            <li>
              <span className="trace__glyph trace__glyph--req">⇄</span>
              <span>GET /search.json?q=asimov · 200 OK</span>
            </li>
            <li>
              <span className="trace__glyph">›</span>
              <span>click [9] · Enlace «Foundation»</span>
            </li>
            <li>
              <span className="trace__glyph trace__glyph--req">⇄</span>
              <span>GET /works/OL46125W.json · 200 OK</span>
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
      kicker: 'Paso 3 · Instala y utiliza',
      title: (
        <>
          De la web
          <br />
          <span>a tu asistente.</span>
        </>
      ),
      body: 'Publica tu MCP, descarga su manifiesto o configúralo mediante la CLI. Después, utiliza las herramientas disponibles desde un cliente compatible con MCP.',
      note: 'Para clientes compatibles con el protocolo MCP.',
      visual: (
        <div className="install" aria-label="Instalación del MCP">
          <span className="install__label mono">Instalar MCP</span>
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
                Convertir una web
              </Link>
            </div>
          )}
        </div>

        <p className="onboarding__keys mono" aria-hidden>
          Usa ← → para navegar
        </p>
      </div>
    </div>
  );
}
