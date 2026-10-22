'use client';

import Link from 'next/link';
import { Icon } from '../components/Icon';
import '../styles/how.css';

const STEPS = [
  {
    n: '01',
    title: 'Pega la URL',
    body: 'Elige la web que ya usas: tu biblioteca, tu tienda, el BOE o la reserva de tu restaurante favorito.',
  },
  {
    n: '02',
    title: 'La convertimos en un MCP',
    body: 'Un agente la explora, descubre qué acciones permite y publica solo las herramientas que funcionan.',
  },
  {
    n: '03',
    title: 'Úsala desde tu asistente',
    body: 'Instala el MCP con un comando y pídele las cosas en lenguaje natural. Sin API ni integraciones.',
  },
];

const EXAMPLES = [
  { icon: 'book', text: '«Busca Cien años de soledad y dime si está disponible.»', site: 'Open Library' },
  { icon: 'calendar', text: '«Mira si hay mesa para cuatro el viernes a las nueve.»', site: 'La Tasca' },
  { icon: 'landmark', text: '«Resume las ayudas publicadas esta semana.»', site: 'BOE' },
] as const;

export function HowItWorks() {
  return (
    <div className="how-page">
      <section className="how-hero">
        <div className="container how-hero__inner">
          <div className="how-hero__copy">
            <p className="eyebrow">Cómo funciona</p>
            <h1>
              Una web que ya usas,
              <br />
              <span>ahora en tu asistente.</span>
            </h1>
            <p className="how-hero__lede">
              MCPortal convierte webs sin API en MCPs: paquetes de acciones que tu asistente puede usar. Tú pones la
              dirección; nosotros hacemos el resto.
            </p>
            <div className="how-hero__actions">
              <Link href="/" className="btn btn--primary">
                Explorar MCPs
                <Icon name="arrowRight" size={15} />
              </Link>
              <Link href="/crear" className="btn btn--outline">
                Conectar una web
              </Link>
            </div>
          </div>

          <aside className="how-card" aria-label="Ejemplo de una web convertida en MCP">
            <div className="how-card__head">
              <span className="mono">ejemplo</span>
              <span className="tag tag--ok">
                <Icon name="check" size={11} /> validado
              </span>
            </div>
            <div className="how-card__pair">
              <span>Web</span>
              <strong>openlibrary.org</strong>
            </div>
            <div className="how-card__down" aria-hidden>
              <span />
              <Icon name="chevronDown" size={14} />
              <span />
            </div>
            <div className="how-card__pair">
              <span>MCP</span>
              <strong>Open Library</strong>
            </div>
            <ul className="how-card__tools">
              <li>
                <Icon name="check" size={12} /> search_books
              </li>
              <li>
                <Icon name="check" size={12} /> get_work
              </li>
              <li>
                <Icon name="check" size={12} /> list_editions
              </li>
            </ul>
            <p className="how-card__note">6 herramientas validadas de 9 propuestas.</p>
          </aside>
        </div>
      </section>

      <section className="container how-steps" aria-labelledby="steps-title">
        <div className="how-section-head">
          <p className="eyebrow">En tres pasos</p>
          <h2 id="steps-title">De la URL a tu asistente</h2>
        </div>
        <ol className="how-steps__list">
          {STEPS.map((step) => (
            <li key={step.n}>
              <span className="how-steps__n mono">{step.n}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container how-examples" aria-labelledby="examples-title">
        <div className="how-section-head">
          <p className="eyebrow">Para qué ayuda</p>
          <h2 id="examples-title">Cosas que puedes pedir</h2>
        </div>
        <ul className="how-examples__list">
          {EXAMPLES.map((example) => (
            <li key={example.site}>
              <Icon name={example.icon} size={18} />
              <blockquote>{example.text}</blockquote>
              <span className="mono">{example.site}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="container how-cta">
        <div>
          <h2>¿Tienes una web en mente?</h2>
          <p>Pega su dirección y mira qué herramientas aparecen.</p>
        </div>
        <Link href="/crear" className="btn btn--primary">
          Conectar una web
          <Icon name="arrowRight" size={15} />
        </Link>
      </section>
    </div>
  );
}
