'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CommandLine } from '../components/Code';
import { Icon } from '../components/Icon';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/primitives';
import { cx } from '../lib/format';
import '../styles/how.css';

type Variant =
  | 'logo'
  | 'statement'
  | 'highlight'
  | 'manifesto'
  | 'question'
  | 'solution'
  | 'process-intro'
  | 'users';

interface Slide {
  id: string;
  kicker: string;
  title?: ReactNode;
  body?: string;
  visual?: ReactNode;
  variant?: Variant;
}

export function HowItWorks() {
  const router = useRouter();
  const slides: Slide[] = [
    {
      id: 'cover',
      kicker: 'Portada',
      variant: 'logo',
    },
    {
      id: 'data',
      kicker: 'El dato',
      title: 'El 57% de las solicitudes de HTML son de bots',
      body: 'Informe Cloudflare',
      variant: 'highlight',
      visual: (
        <div className="stat" aria-label="57,5% de solicitudes HTML de bots frente a 42,5% de humanos">
          <div className="stat__bar" role="img" aria-label="57,5% bots, 42,5% humanos">
            <span className="stat__segment stat__segment--bots" style={{ width: '57.5%' }} />
            <span className="stat__segment stat__segment--humans" style={{ width: '42.5%' }} />
          </div>
          <div className="stat__legend">
            <div>
              <span className="stat__dot stat__dot--bots" />
              <strong className="mono">57,5%</strong>
              <span>bots</span>
            </div>
            <div>
              <span className="stat__dot stat__dot--humans" />
              <strong className="mono">42,5%</strong>
              <span>humanos</span>
            </div>
          </div>
          <div className="stat__milestones">
            <div>
              <span className="mono">27 abr 2026</span>
              <strong className="mono">50%</strong>
              <span>los bots superan a los humanos</span>
            </div>
            <div>
              <span className="mono">jun 2026</span>
              <strong className="mono">57,5%</strong>
              <span>de las solicitudes HTML son de bots</span>
            </div>
          </div>
          <p className="stat__source mono">Cloudflare Radar · solicitudes HTML en su red</p>
        </div>
      ),
    },
    {
      id: 'past',
      kicker: 'El pasado',
      title: 'Hasta ahora, las webs estaban diseñadas para las personas.',
      visual: (
        <div className="legacy" aria-label="Una web tradicional diseñada para personas">
          <div className="legacy__bar">
            <span className="legacy__dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="legacy__url mono">https://tu-empresa.com</span>
            <span className="legacy__person">
              <Icon name="user" size={12} /> persona
            </span>
          </div>
          <div className="legacy__body">
            <div className="legacy__nav mono">
              <span>Inicio</span>
              <span>Servicios</span>
              <span>Contacto</span>
            </div>
            <div className="legacy__hero">
              <span className="legacy__eyebrow mono">Bienvenido</span>
              <strong>Tu web de siempre</strong>
              <span className="legacy__btn">Empezar</span>
            </div>
            <span className="legacy__cursor">
              <Icon name="arrowUpRight" size={15} /> clic
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'future',
      kicker: 'El futuro',
      title: 'Cada vez más, serán los agentes de IA quienes utilicen las webs.',
      visual: (
        <div className="agent-web" aria-label="Un agente de IA utilizando una web">
          <div className="agent-web__bar">
            <span className="legacy__dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="agent-web__url mono">openlibrary.org</span>
            <span className="tag tag--ink">
              <Icon name="bolt" size={11} /> agente
            </span>
          </div>
          <div className="agent-web__body">
            <span className="agent-web__label mono">La web, utilizada por un agente</span>
            <span className="agent-web__line" />
            <span className="agent-web__line agent-web__line--short" />
            <div className="agent-web__chips">
              <span className="tag">buscar</span>
              <span className="tag">consultar</span>
              <span className="tag">reservar</span>
            </div>
            <span className="agent-web__bolt" aria-hidden>
              <Icon name="bolt" size={26} filled />
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'shift',
      kicker: 'El problema',
      title: (
        <>
          La web está evolucionando
          <span>para los agentes.</span>
        </>
      ),
      body: 'Pero la mayoría de las herramientas todavía no están preparadas.',
      variant: 'manifesto',
      visual: (
        <div className="manifesto-tools" aria-label="Herramientas actuales no preparadas">
          <span className="manifesto-tools__label mono">Herramientas actuales</span>
          <div className="manifesto-tools__grid">
            <span>
              <Icon name="inbox" size={16} /> Correo
            </span>
            <span>
              <Icon name="briefcase" size={16} /> CRM
            </span>
            <span>
              <Icon name="bag" size={16} /> Tienda
            </span>
            <span>
              <Icon name="calendar" size={16} /> Reservas
            </span>
          </div>
          <span className="tag tag--warn">
            <Icon name="alert" size={11} /> no preparadas
          </span>
        </div>
      ),
    },
    {
      id: 'enterprise',
      kicker: 'La brecha',
      title: 'Las grandes compañías ya están desarrollando sus propias integraciones.',
      visual: (
        <div className="build" aria-label="Equipo de ingeniería desarrollando integraciones propias">
          <div className="build__head">
            <span className="mono">Equipo de ingeniería</span>
            <span className="tag tag--outline">integración propia</span>
          </div>
          <div className="build__body">
            <div className="build__team">
              <Avatar name="Dev" size={24} />
              <Avatar name="Equipo" size={24} />
              <Avatar name="Ingeniería" size={24} />
            </div>
            <div className="build__code mono">
              <span>connect(web, agent)</span>
              <span className="build__muted">// desarrollo y mantenimiento</span>
              <span className="build__cursor" aria-hidden />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'sme',
      kicker: 'Las pymes',
      title: '¿Qué ocurre con las pequeñas y medianas empresas?',
      body: 'Muchas siguen dependiendo de herramientas que no están preparadas para trabajar con agentes de IA y no cuentan con los recursos técnicos necesarios para desarrollar sus propias integraciones.',
      variant: 'question',
      visual: (
        <div className="inequality" aria-label="Diferencia de recursos entre grandes compañías y pymes">
          <div className="inequality__row">
            <div className="inequality__head">
              <span className="mono">Grandes compañías</span>
              <span className="tag tag--ok">
                <Icon name="check" size={11} /> equipo técnico
              </span>
            </div>
            <div className="inequality__track">
              <span style={{ width: '100%' }} />
            </div>
          </div>
          <div className="inequality__row">
            <div className="inequality__head">
              <span className="mono">PYMES</span>
              <span className="tag tag--warn">
                <Icon name="alert" size={11} /> recursos limitados
              </span>
            </div>
            <div className="inequality__track inequality__track--short">
              <span style={{ width: '36%' }} />
            </div>
          </div>
          <p className="inequality__note mono">Capacidad para desarrollar integraciones propias</p>
        </div>
      ),
    },
    {
      id: 'solution',
      kicker: 'La solución',
      title: 'MCPortal convierte cualquier web en una herramienta que los agentes de IA pueden utilizar.',
      variant: 'solution',
      visual: (
        <div className="transform" aria-label="Una web convertida en herramienta para agentes">
          <div className="transform__web">
            <span className="transform__bar mono">tu-empresa.com</span>
            <div className="transform__page">
              <span className="mono">Web</span>
              <strong>para personas</strong>
              <span className="transform__line" />
              <span className="transform__line transform__line--short" />
            </div>
          </div>
          <div className="transform__arrow">
            <span className="mono">MCPortal</span>
            <Icon name="arrowRight" size={16} />
          </div>
          <div className="transform__tool">
            <span className="tag tag--ink">
              <Icon name="bolt" size={11} /> agente
            </span>
            <strong>Herramienta</strong>
            <div className="transform__chips">
              <span className="tag">buscar</span>
              <span className="tag">reservar</span>
              <span className="tag">comprar</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'how',
      kicker: 'El producto',
      title: 'Cómo funciona MCPortal',
      variant: 'process-intro',
      visual: (
        <div className="process-map" aria-label="Los tres pasos de MCPortal">
          <div className="process-map__step">
            <span className="process-map__n mono">01</span>
            <span className="process-map__icon">
              <Icon name="globe" size={18} />
            </span>
            <strong>URL</strong>
            <span className="mono">una web</span>
          </div>
          <Icon name="arrowRight" size={16} className="process-map__arrow" />
          <div className="process-map__step">
            <span className="process-map__n mono">02</span>
            <span className="process-map__icon">
              <Icon name="search" size={18} />
            </span>
            <strong>Exploración</strong>
            <span className="mono">interacciones</span>
          </div>
          <Icon name="arrowRight" size={16} className="process-map__arrow" />
          <div className="process-map__step">
            <span className="process-map__n mono">03</span>
            <span className="process-map__icon">
              <Icon name="layers" size={18} />
            </span>
            <strong>MCP</strong>
            <span className="mono">herramientas</span>
          </div>
        </div>
      ),
    },
    {
      id: 'step-url',
      kicker: 'Paso 1',
      title: '1. Introduce la URL de una web.',
      body: 'Indica qué página quieres conectar con tu agente de IA.',
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
      id: 'step-explore',
      kicker: 'Paso 2',
      title: '2. Nuestra IA explora la web.',
      body: 'Analiza la página e identifica las interacciones y funcionalidades que pueden convertirse en herramientas para un agente.',
      visual: (
        <div className="trace" aria-label="Exploración de la web e interacciones identificadas">
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
          <div className="trace__capabilities">
            <span className="trace__cap-label mono">Interacciones</span>
            <span className="tag">Buscar</span>
            <span className="tag">Ver ficha</span>
            <span className="tag">Consultar autor</span>
          </div>
          <div className="trace__foot">
            <Icon name="check" size={13} /> Interacciones identificadas
          </div>
        </div>
      ),
    },
    {
      id: 'step-mcp',
      kicker: 'Paso 3',
      title: 'De la web a un servidor MCP',
      body: 'MCPortal transforma lo que ha descubierto en un servidor MCP que permite a los agentes utilizar las funcionalidades identificadas.',
      visual: (
        <div className="deliver" aria-label="La web se convierte en un servidor MCP">
          <div className="deliver__flow">
            <span className="deliver__node mono">openlibrary.org</span>
            <Icon name="arrowRight" size={14} />
            <span className="deliver__node deliver__node--mcp">
              <Icon name="layers" size={12} /> MCP
            </span>
          </div>
          <div className="install" aria-label="Instalación del MCP generado">
            <span className="install__label mono">Instalar</span>
            <CommandLine command="npx -y mcportal add openlibrary" />
            <div className="install__file">
              <Icon name="download" size={16} />
              <strong>manifest.json</strong>
              <span className="mono">4,2 kB</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'users',
      kicker: '¿Quién necesita MCPortal?',
      title: 'Dos tipos de usuarios. Una misma solución.',
      variant: 'users',
      visual: (
        <div className="users" aria-label="Empresas y usuarios finales">
          <article className="users__card users__card--companies">
            <div className="users__head">
              <span className="users__label mono">Empresas</span>
              <span className="tag tag--ink">Oportunidad principal</span>
            </div>
            <ul>
              <li>
                <Icon name="check" size={12} />
                <span>Quieren incorporar la IA a sus procesos y herramientas.</span>
              </li>
              <li>
                <Icon name="check" size={12} />
                <span>Necesitan automatizar tareas utilizando los sistemas que ya tienen.</span>
              </li>
              <li>
                <Icon name="check" size={12} />
                <span>
                  No siempre cuentan con los recursos técnicos para desarrollar integraciones o crear herramientas desde
                  cero.
                </span>
              </li>
            </ul>
          </article>

          <article className="users__card">
            <div className="users__head">
              <span className="users__label mono">Usuarios finales</span>
              <span className="tag tag--outline">Segundo público</span>
            </div>
            <ul>
              <li>
                <Icon name="check" size={12} />
                <span>Quieren que sus asistentes de IA puedan interactuar con las páginas web que utilizan.</span>
              </li>
              <li>
                <Icon name="check" size={12} />
                <span>Necesitan conectar sus herramientas favoritas sin desarrollar sus propias integraciones.</span>
              </li>
            </ul>
          </article>
        </div>
      ),
    },
    {
      id: 'vision',
      kicker: 'Visión',
      title: 'Un ecosistema de integraciones para agentes de IA',
      body: 'Facilitar que las integraciones se puedan descubrir, compartir y mejorar, en lugar de tener que empezar desde cero cada vez.',
      visual: (
        <div className="vision-net" aria-label="Ecosistema de integraciones para agentes de IA">
          <span className="vision-net__ring" aria-hidden />
          <div className="vision-net__center">
            <Logo height={14} />
            <span className="mono">MCPs</span>
            <span className="tag tag--outline">Visión</span>
          </div>
          <div className="vision-net__node vision-net__node--top">
            <Avatar name="Dev" size={22} />
            <span>Descubrir</span>
          </div>
          <div className="vision-net__node vision-net__node--right">
            <Avatar name="Equipo" size={22} />
            <span>Compartir</span>
          </div>
          <div className="vision-net__node vision-net__node--bottom">
            <Avatar name="Empresa" size={22} />
            <span>Mejorar</span>
          </div>
          <div className="vision-net__node vision-net__node--left">
            <Avatar name="Comunidad" size={22} />
            <span>Comunidad</span>
          </div>
        </div>
      ),
    },
    {
      id: 'demo',
      kicker: 'Demo',
      title: 'Veamos cómo funciona',
      variant: 'statement',
    },
  ];

  const last = slides.length - 1;
  const [index, setIndex] = useState(0);
  const slide = slides[index];

  const goTo = (next: number) => setIndex(Math.min(Math.max(next, 0), last));

  const goNext = () => {
    if (index === last) {
      router.push('/');
      return;
    }
    setIndex((current) => Math.min(current + 1, last));
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        if (index === last) router.push('/');
        else setIndex((current) => Math.min(current + 1, last));
      }
      if (event.key === 'ArrowLeft') setIndex((current) => Math.max(current - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, last, router]);

  return (
    <div className="onboarding">
      <div className="container onboarding__inner">
        <div className="onboarding__top">
          <p className="eyebrow">Cómo funciona</p>
          <span className="onboarding__count mono">
            {String(index + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}
          </span>
        </div>

        <div className="onboarding__progress" aria-label="Diapositivas de la presentación">
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
          className={cx('onboarding__slide', slide.variant && `onboarding__slide--${slide.variant}`)}
          key={slide.id}
          aria-live="polite"
          aria-label={`Diapositiva ${index + 1} de ${slides.length}`}
        >
          {slide.variant === 'logo' ? (
            <div className="logo-slide">
              <Logo height={56} />
            </div>
          ) : (
            <>
              <div className="onboarding__copy">
                {slide.kicker && slide.id !== 'demo' && <p className="eyebrow">{slide.kicker}</p>}
                {slide.title && <h1>{slide.title}</h1>}
                {slide.body && <p className="onboarding__lede">{slide.body}</p>}
              </div>
              {slide.visual && <div className="onboarding__visual">{slide.visual}</div>}
            </>
          )}
        </section>

        <div className="onboarding__foot">
          {index > 0 ? (
            <button className="btn btn--ghost" onClick={() => goTo(index - 1)}>
              <Icon name="arrowLeft" size={15} /> Anterior
            </button>
          ) : (
            <span />
          )}

          <button className="btn btn--primary" onClick={goNext}>
            {index === 0 ? 'Empezar' : 'Siguiente'}
            <Icon name="arrowRight" size={15} />
          </button>
        </div>

        <p className="onboarding__keys mono" aria-hidden>
          Usa ← → para moverte
        </p>
      </div>
    </div>
  );
}
